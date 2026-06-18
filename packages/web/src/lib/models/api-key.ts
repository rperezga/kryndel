/**
 * API Key model — Kryndel Cloud machine-to-machine auth.
 *
 * Stored in MongoDB collection `api_keys`.
 * Only Pro users can create API keys (max 5 per user).
 *
 * Security (AUDIT-PA-2026-06-16 / PB-core):
 *   - Raw key shown ONCE at creation time, never stored.
 *   - keyHash = SHA-256(rawKey) — stored for lookup.
 *   - keyPrefix = "kr_live_" + first 8 hex chars — for display only.
 */
import { createHash, randomBytes } from 'node:crypto';
import type { Collection, ObjectId } from 'mongodb';
import { getDb } from '../db';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ApiKey {
  _id:         ObjectId;
  userId:      ObjectId;
  name:        string;
  keyHash:     string;    // SHA-256 hex of raw key — never expose
  keyPrefix:   string;    // "kr_live_XXXXXXXX" — safe to display
  active:      boolean;
  lastUsedAt?: Date;
  createdAt:   Date;
}

export type ApiKeyInsert = Omit<ApiKey, '_id'>;

// ── Collection accessor ───────────────────────────────────────────────────────

export async function apiKeysCollection(): Promise<Collection<ApiKey>> {
  const db = await getDb();
  return db.collection<ApiKey>('api_keys');
}

// ── Generation helpers ────────────────────────────────────────────────────────

const PREFIX = 'kr_live_';

/**
 * Generate a new raw API key.
 * Format: kr_live_<40 hex chars> (20 random bytes -> hex)
 */
export function generateRawKey(): string {
  return PREFIX + randomBytes(20).toString('hex');
}

/** SHA-256 hex of a raw key. */
export function hashKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

/** Display prefix -- first 8 chars after "kr_live_". */
export function keyPrefix(rawKey: string): string {
  const hexPart = rawKey.slice(PREFIX.length, PREFIX.length + 8);
  return PREFIX + hexPart;
}

/** Validate raw key format. */
export function isValidRawKey(rawKey: string): boolean {
  return /^kr_live_[0-9a-f]{40}$/.test(rawKey);
}
