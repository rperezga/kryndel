/**
 * Outbound webhook delivery -- called after dispatching alerts.
 *
 * deliverWebhooks:
 *   1. Queries active webhook_endpoints for the userId that optionally match
 *      contractAddress + eventName filters.
 *   2. For each endpoint: generates signed payload and attempts fetch.
 *   3. Logs result to webhook_deliveries (success, failed, retrying).
 *
 * Signature format:
 *   Header X-Kryndel-Signature: sha256=<hmac-sha256-hex>
 *   Header X-Kryndel-Timestamp: <unix ms>
 *
 * Retry backoff (minutes): [1, 5, 30, 120, 480] for attempts 2-6.
 * After attempt 6 (total): status = 'failed'.
 *
 * Secret storage: plain text in MongoDB (Atlas encrypts at rest).
 * The `secret` field is NEVER returned in API responses.
 */
import { createHmac }      from 'node:crypto';
import { ObjectId, type Db } from 'mongodb';
import type { ContractActivity } from '@kryndel/core';

// ── Retry backoff ─────────────────────────────────────────────────────────────

const RETRY_BACKOFF_MIN = [1, 5, 30, 120, 480]; // minutes for attempts 2-6
const MAX_ATTEMPTS = 6;

function nextRetryAt(attempt: number): Date | undefined {
  const idx = attempt - 2; // attempt 2 -> index 0
  if (idx < 0 || idx >= RETRY_BACKOFF_MIN.length) return undefined;
  const minutes = RETRY_BACKOFF_MIN[idx];
  return new Date(Date.now() + minutes * 60 * 1000);
}

// ── Sign payload ──────────────────────────────────────────────────────────────

function signDelivery(payload: string, secret: string): { signature: string; timestamp: number } {
  const timestamp = Date.now();
  const signature = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
  return { signature, timestamp };
}

// ── Main delivery function ────────────────────────────────────────────────────

export async function deliverWebhooks(
  db: Db,
  contractAddress: string,
  activity: ContractActivity,
  userId: ObjectId,
): Promise<void> {
  const normalizedAddress = contractAddress.toLowerCase();
  const eventName = activity.kind === 'event' ? (activity.name ?? 'unknown') : (activity.txType ?? 'unknown');

  // JSON-/Mongo-safe view of the activity for the payload: drop the raw provider
  // log (verbose, and may contain bigints that break JSON.stringify / Mongo insert)
  // and keep the decoded, serializable fields.
  const safeData: Record<string, unknown> = {
    kind:     activity.kind,
    event:    eventName,
    contract: normalizedAddress,
    txHash:   activity.txHash ?? null,
    ...(activity.kind === 'event' ? { args: activity.args ?? {} } : { txType: activity.txType }),
  };

  // Find matching active endpoints for this user
  const endpoints = await db.collection('webhook_endpoints').find({
    userId,
    active: true,
    $or: [
      { contractAddresses: { $size: 0 } },
      { contractAddresses: [] },
      { contractAddresses: normalizedAddress },
    ],
  }).toArray();

  // Further filter by eventNames if set
  const matching = endpoints.filter((ep) => {
    const contractAddresses = (ep as { contractAddresses?: string[] }).contractAddresses ?? [];
    const eventNames        = (ep as { eventNames?: string[] }).eventNames ?? [];

    // Filter by contractAddress
    if (contractAddresses.length > 0 && !contractAddresses.includes(normalizedAddress)) return false;
    // Filter by eventName
    if (eventNames.length > 0 && !eventNames.includes(eventName)) return false;
    return true;
  });

  if (matching.length === 0) return;

  const deliveries = matching.map(async (ep) => {
    const endpointId = ep._id as ObjectId;
    const secret     = (ep as unknown as { secret: string }).secret;
    const url        = (ep as unknown as { url: string }).url;
    const deliveryId = new ObjectId().toHexString();

    const payloadObj = {
      event:       eventName,
      contract:    normalizedAddress,
      timestamp:   Date.now(),
      deliveryId,
      data:        safeData,
    };
    const payloadStr = JSON.stringify(payloadObj);
    const { signature, timestamp } = signDelivery(payloadStr, secret);

    const now = new Date();

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type':          'application/json',
          'X-Kryndel-Signature':   signature,
          'X-Kryndel-Timestamp':   String(timestamp),
        },
        body:    payloadStr,
        signal:  AbortSignal.timeout(10_000), // 10s timeout
      });

      await db.collection('webhook_deliveries').insertOne({
        endpointId,
        userId,
        contractAddress: normalizedAddress,
        eventName,
        payload:         payloadObj,
        attempt:         1,
        status:          res.ok ? 'success' : 'failed',
        httpStatus:      res.status,
        errorMessage:    res.ok ? undefined : `HTTP ${res.status}`.slice(0, 200),
        createdAt:       now,
        deliveredAt:     res.ok ? now : undefined,
      });
    } catch (err) {
      const errorMessage = ((err as Error).message ?? 'Unknown error').slice(0, 200);
      const retryAt      = nextRetryAt(2); // first retry = attempt 2

      await db.collection('webhook_deliveries').insertOne({
        endpointId,
        userId,
        contractAddress: normalizedAddress,
        eventName,
        payload:         payloadObj,
        attempt:         1,
        status:          'retrying',
        errorMessage,
        createdAt:       now,
        nextRetryAt:     retryAt,
      });

      console.error(`[webhook-deliverer] delivery failed for ${url}:`, errorMessage);
    }
  });

  await Promise.allSettled(deliveries);
}

// ── Retry loop ────────────────────────────────────────────────────────────────

export async function processRetries(db: Db): Promise<void> {
  const now = new Date();

  // Find deliveries due for retry
  const pending = await db.collection('webhook_deliveries').find({
    status:       'retrying',
    nextRetryAt:  { $lte: now },
  }).limit(100).toArray();

  if (pending.length === 0) return;

  console.log(`[webhook-deliverer] processing ${pending.length} retries`);

  const retries = pending.map(async (delivery) => {
    const attempt    = ((delivery as { attempt?: number }).attempt ?? 1) + 1;
    const endpointId = (delivery as unknown as { endpointId: ObjectId }).endpointId;

    const endpoint = await db.collection('webhook_endpoints').findOne({ _id: endpointId, active: true });
    if (!endpoint) {
      // Endpoint deleted/revoked -- mark failed
      await db.collection('webhook_deliveries').updateOne(
        { _id: (delivery as { _id: ObjectId })._id },
        { $set: { status: 'failed', errorMessage: 'Endpoint deleted.' } },
      );
      return;
    }

    const secret  = (endpoint as unknown as { secret: string }).secret;
    const url     = (endpoint as unknown as { url: string }).url;
    const payload = (delivery as unknown as { payload: Record<string, unknown> }).payload;
    const payloadStr = JSON.stringify(payload);
    const { signature, timestamp } = signDelivery(payloadStr, secret);

    const retryNow = new Date();

    try {
      const res = await fetch(url, {
        method:  'POST',
        headers: {
          'Content-Type':          'application/json',
          'X-Kryndel-Signature':   signature,
          'X-Kryndel-Timestamp':   String(timestamp),
        },
        body:    payloadStr,
        signal:  AbortSignal.timeout(10_000),
      });

      if (res.ok) {
        await db.collection('webhook_deliveries').updateOne(
          { _id: (delivery as { _id: ObjectId })._id },
          { $set: { status: 'success', httpStatus: res.status, attempt, deliveredAt: retryNow } },
        );
      } else {
        const nextStatus = attempt >= MAX_ATTEMPTS ? 'failed' : 'retrying';
        const retryAt    = attempt < MAX_ATTEMPTS ? nextRetryAt(attempt + 1) : undefined;
        await db.collection('webhook_deliveries').updateOne(
          { _id: (delivery as { _id: ObjectId })._id },
          {
            $set: {
              status:       nextStatus,
              httpStatus:   res.status,
              attempt,
              errorMessage: `HTTP ${res.status}`.slice(0, 200),
              nextRetryAt:  retryAt,
            },
          },
        );
      }
    } catch (err) {
      const errorMessage = ((err as Error).message ?? 'Unknown error').slice(0, 200);
      const nextStatus   = attempt >= MAX_ATTEMPTS ? 'failed' : 'retrying';
      const retryAt      = attempt < MAX_ATTEMPTS ? nextRetryAt(attempt + 1) : undefined;

      await db.collection('webhook_deliveries').updateOne(
        { _id: (delivery as { _id: ObjectId })._id },
        { $set: { status: nextStatus, attempt, errorMessage, nextRetryAt: retryAt } },
      );
    }
  });

  await Promise.allSettled(retries);
}
