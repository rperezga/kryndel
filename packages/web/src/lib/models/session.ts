/**
 * Session model — server-side auth sessions for magic link login.
 *
 * The actual session token lives in a httpOnly cookie on the client.
 * The DB stores only the SHA-256 hash of that token.
 * Expired sessions are removed automatically via MongoDB TTL index on `expiresAt`.
 */
import { createHash, randomBytes } from 'node:crypto';
import type { Collection, ObjectId } from 'mongodb';
import { getDb } from '../db.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KSession {
  _id:       ObjectId;
  userId:    ObjectId;
  tokenHash: string;  // SHA-256(token) — never store the token in plain text
  expiresAt: Date;    // TTL index — MongoDB removes the doc automatically after this
  createdAt: Date;
}

export type KSessionInsert = Omit<KSession, '_id'>;

/** Session duration: 30 days rolling. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Hash a token for safe storage. Never store raw tokens in DB. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Generate a cryptographically random session token (64 hex chars = 256 bits). */
export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

// ── Collection accessor ───────────────────────────────────────────────────────

export async function sessionsCollection(): Promise<Collection<KSession>> {
  const db = await getDb();
  return db.collection<KSession>('sessions');
}
