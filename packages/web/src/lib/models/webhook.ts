/**
 * Webhook model -- outbound webhook endpoints and delivery log.
 *
 * webhook_endpoints: user-registered HTTPS endpoints that receive signed
 *   event payloads when matching activity is detected.
 *
 * webhook_deliveries: TTL 30d -- every delivery attempt (success or failure).
 *
 * Security note: `secret` is stored in plain text in MongoDB.
 * Atlas encrypts at rest (AES-256). The secret is NEVER returned in API
 * responses -- only secretPrefix is exposed for identification.
 * For future PB hardening: encrypt with AES-256-GCM + WEBHOOK_SECRET_KEY env var.
 */
import type { Collection, ObjectId } from 'mongodb';
import { getDb } from '../db';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface WebhookEndpoint {
  _id:                ObjectId;
  userId:             ObjectId;
  url:                string;
  secret:             string;     // plain text -- Atlas encrypts at rest; NEVER expose in API
  secretHash:         string;     // SHA-256(secret) -- to detect rotation
  secretPrefix:       string;     // first 8 chars of secret -- display only
  description?:       string;
  active:             boolean;
  createdAt:          Date;
  contractAddresses?: string[];   // empty/absent = all user contracts
  eventNames?:        string[];   // empty/absent = all events
}

export type WebhookEndpointInsert = Omit<WebhookEndpoint, '_id'>;

export type DeliveryStatus = 'pending' | 'success' | 'failed' | 'retrying';

export interface WebhookDelivery {
  _id:             ObjectId;
  endpointId:      ObjectId;
  userId:          ObjectId;
  contractAddress: string;
  eventName:       string;
  payload:         Record<string, unknown>;
  attempt:         number;
  status:          DeliveryStatus;
  httpStatus?:     number;
  errorMessage?:   string;        // max 200 chars
  createdAt:       Date;
  deliveredAt?:    Date;
  nextRetryAt?:    Date;
}

export type WebhookDeliveryInsert = Omit<WebhookDelivery, '_id'>;

// ── Collection accessors ──────────────────────────────────────────────────────

export async function webhookEndpointsCollection(): Promise<Collection<WebhookEndpoint>> {
  const db = await getDb();
  return db.collection<WebhookEndpoint>('webhook_endpoints');
}

export async function webhookDeliveriesCollection(): Promise<Collection<WebhookDelivery>> {
  const db = await getDb();
  return db.collection<WebhookDelivery>('webhook_deliveries');
}

// ── Safe public representation (never exposes secret or secretHash) ───────────

export function toPublicWebhook(ep: WebhookEndpoint) {
  const { secret: _s, secretHash: _h, ...pub } = ep;
  return pub;
}
