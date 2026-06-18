/**
 * API Key authentication helper for v1 API routes.
 *
 * requireApiKey(req) reads "Authorization: Bearer <key>", hashes it,
 * looks up the api_keys collection, verifies the key is active and the
 * user has the Pro plan, updates lastUsedAt async (non-blocking), and
 * returns { userId, keyId, user }.
 *
 * Throws a Response (401 or 403) on failure — API route handlers can
 * simply: try { ctx = await requireApiKey(req) } catch(e) { return e as Response }
 *
 * Security (PB-core):
 *   - Never expose internal error details in 401/403 responses.
 *   - lastUsedAt is updated fire-and-forget — never blocks the request.
 */
import type { NextRequest } from 'next/server';
import type { ObjectId } from 'mongodb';
import { getDb } from './db';
import { hashKey, isValidRawKey } from './models/api-key';
import type { KUser } from './models/user';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ApiKeyContext {
  userId: ObjectId;
  keyId:  ObjectId;
  user:   KUser;
}

// ── Helper ────────────────────────────────────────────────────────────────────

function unauthorized(msg = 'Unauthorized'): Response {
  return new Response(JSON.stringify({ error: { message: msg, code: 'UNAUTHORIZED' } }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

function forbidden(msg = 'Forbidden'): Response {
  return new Response(JSON.stringify({ error: { message: msg, code: 'FORBIDDEN' } }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Authenticate a request via API key (Authorization: Bearer <key>).
 * Throws a Response on failure; returns ApiKeyContext on success.
 */
export async function requireApiKey(req: NextRequest | Request): Promise<ApiKeyContext> {
  const authHeader = (req as Request).headers.get('authorization') ?? '';
  const rawKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!rawKey || !isValidRawKey(rawKey)) {
    throw unauthorized('Missing or invalid API key.');
  }

  const db      = await getDb();
  const keyHash = hashKey(rawKey);

  const keyDoc = await db.collection('api_keys').findOne({ keyHash, active: true });
  if (!keyDoc) {
    throw unauthorized('Invalid or revoked API key.');
  }

  // Fetch user and verify plan
  const user = await db.collection<KUser>('users').findOne({ _id: keyDoc.userId });
  if (!user) {
    throw unauthorized('User not found.');
  }

  if (user.plan !== 'pro') {
    throw forbidden('API key access requires a Pro plan.');
  }

  // Update lastUsedAt fire-and-forget -- never block the request
  void db.collection('api_keys').updateOne(
    { _id: keyDoc._id },
    { $set: { lastUsedAt: new Date() } },
  ).catch((err) => console.error('[api-auth] lastUsedAt update failed:', err));

  return {
    userId: keyDoc.userId as ObjectId,
    keyId:  keyDoc._id as ObjectId,
    user:   user as KUser,
  };
}
