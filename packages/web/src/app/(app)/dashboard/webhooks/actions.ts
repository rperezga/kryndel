'use server';

import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/current-user';
import { assertSafePublicUrl } from '@/lib/ssrf';
import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { randomBytes, createHash, createHmac } from 'node:crypto';

export interface ActionResponse {
  success?: string;
  error?: string;
  secret?: string; // only shown once on webhook creation
}

/**
 * Register a new signed outbound webhook endpoint.
 * Requires Pro plan.
 */
export async function createWebhookEndpointAction(
  url: string,
  description?: string,
  contractAddresses?: string[],
  eventNames?: string[]
): Promise<ActionResponse> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { error: 'Unauthorized' };
  }

  // 1. Verify Pro plan
  if (user.plan !== 'pro') {
    return { error: 'Registering custom webhook endpoints requires a Pro plan. Upgrade to Pro.' };
  }

  // 2. Validate URL
  const cleanUrl = String(url ?? '').trim();
  if (!cleanUrl) {
    return { error: 'Webhook URL is required.' };
  }
  if (!cleanUrl.startsWith('https://')) {
    return { error: 'Webhook URL must use secure HTTPS protocol.' };
  }

  // SSRF guard validation
  try {
    await assertSafePublicUrl(cleanUrl);
  } catch (err: any) {
    return { error: `SSRF validation failed: ${err.message}` };
  }

  const db = await getDb();

  // 3. Check 10-endpoint limit
  const count = await db.collection('webhook_endpoints').countDocuments({
    userId: user._id,
    active: true,
  });
  if (count >= 10) {
    return { error: 'Maximum 10 active webhook endpoints allowed.' };
  }

  // 4. Generate secret & metadata
  const rawSecret = randomBytes(32).toString('hex');
  const secretHash = createHash('sha256').update(rawSecret).digest('hex');
  const secretPrefix = rawSecret.slice(0, 8);

  const cleanDesc = String(description ?? '').trim().slice(0, 200) || undefined;
  const cleanContracts = Array.isArray(contractAddresses)
    ? contractAddresses.map((addr) => String(addr).trim().toLowerCase()).filter(Boolean)
    : [];
  const cleanEvents = Array.isArray(eventNames)
    ? eventNames.map((e) => String(e).trim()).filter(Boolean)
    : [];

  const now = new Date();
  const doc = {
    userId: user._id,
    url: cleanUrl,
    secret: rawSecret, // plain text -- Atlas encrypts at rest
    secretHash,
    secretPrefix,
    description: cleanDesc,
    active: true,
    createdAt: now,
    contractAddresses: cleanContracts,
    eventNames: cleanEvents,
  };

  try {
    await db.collection('webhook_endpoints').insertOne(doc);
    revalidatePath('/dashboard/webhooks');
    return {
      success: 'Webhook endpoint registered successfully.',
      secret: rawSecret, // Shown once
    };
  } catch (err: any) {
    return { error: `Failed to create webhook: ${err.message}` };
  }
}

/**
 * Soft-delete a webhook endpoint (active = false).
 */
export async function deleteWebhookEndpointAction(id: string): Promise<ActionResponse> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { error: 'Unauthorized' };
  }

  if (!id || !ObjectId.isValid(id)) {
    return { error: 'Invalid ID provided.' };
  }

  const db = await getDb();
  try {
    const result = await db.collection('webhook_endpoints').updateOne(
      { _id: new ObjectId(id), userId: user._id },
      { $set: { active: false } }
    );

    if (result.matchedCount === 0) {
      return { error: 'Webhook endpoint not found.' };
    }

    revalidatePath('/dashboard/webhooks');
    return { success: 'Webhook endpoint deleted successfully.' };
  } catch (err: any) {
    return { error: `Failed to delete webhook: ${err.message}` };
  }
}

/**
 * Replay a past webhook delivery attempt in real time.
 * Generates a fresh payload with a new deliveryId and timestamp,
 * signs it using the endpoint's secret, and registers the outcome.
 */
export async function replayWebhookAction(deliveryId: string): Promise<ActionResponse> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { error: 'Unauthorized' };
  }

  // 1. Verify Pro plan
  if (user.plan !== 'pro') {
    return { error: 'Replaying delivery logs requires a Pro plan.' };
  }

  if (!deliveryId || !ObjectId.isValid(deliveryId)) {
    return { error: 'Invalid delivery ID.' };
  }

  const db = await getDb();

  // 2. Fetch original delivery attempt
  const delivery = await db.collection('webhook_deliveries').findOne({
    _id: new ObjectId(deliveryId),
    userId: user._id,
  });

  if (!delivery) {
    return { error: 'Delivery log not found.' };
  }

  // 3. Fetch active target endpoint
  const endpoint = await db.collection('webhook_endpoints').findOne({
    _id: delivery.endpointId,
    userId: user._id,
    active: true,
  });

  if (!endpoint) {
    return { error: 'Target webhook endpoint is inactive or has been deleted.' };
  }

  // 4. Validate URL safety (SSRF)
  try {
    await assertSafePublicUrl(endpoint.url);
  } catch (err: any) {
    return { error: `SSRF validation failed: ${err.message}` };
  }

  // 5. Build fresh payload
  const newDeliveryId = new ObjectId().toHexString();
  const payloadObj = {
    ...(delivery.payload ?? {}),
    timestamp: Date.now(),
    deliveryId: newDeliveryId,
    isReplay: true,
  };
  const payloadStr = JSON.stringify(payloadObj);

  // 6. Sign payload
  const timestamp = Date.now();
  const signature = `sha256=${createHmac('sha256', endpoint.secret).update(payloadStr).digest('hex')}`;

  // 7. Dispatch HTTP POST
  let success = false;
  let httpStatus = 0;
  let errorMessage: string | undefined;
  const now = new Date();

  try {
    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Kryndel-Signature': signature,
        'X-Kryndel-Timestamp': String(timestamp),
      },
      body: payloadStr,
      signal: AbortSignal.timeout(10_000), // 10s timeout
    });

    success = res.ok;
    httpStatus = res.status;
    if (!res.ok) {
      errorMessage = `HTTP ${res.status}`;
    }
  } catch (err: any) {
    errorMessage = ((err as Error).message ?? 'Unknown fetch error').slice(0, 200);
  }

  // 8. Log new attempt in webhook_deliveries
  try {
    await db.collection('webhook_deliveries').insertOne({
      endpointId: endpoint._id,
      userId: user._id,
      contractAddress: delivery.contractAddress,
      eventName: delivery.eventName,
      payload: payloadObj,
      attempt: 1,
      status: success ? 'success' : 'failed',
      httpStatus: httpStatus || undefined,
      errorMessage,
      createdAt: now,
      deliveredAt: success ? now : undefined,
    });

    revalidatePath('/dashboard/webhooks');
    return { success: success ? 'Webhook replayed successfully.' : `Replay completed with error: ${errorMessage}` };
  } catch (err: any) {
    return { error: `Failed to save delivery log: ${err.message}` };
  }
}
