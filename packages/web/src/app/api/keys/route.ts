/**
 * POST /api/keys  -- create API key (Pro only, max 5)
 * GET  /api/keys  -- list API keys for current user
 *
 * Session-auth (uses requireUser, NOT requireApiKey).
 * Security (PB-core): name validated + truncated; raw key shown once.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { requireUser }    from '@/lib/current-user';
import { getDb }          from '@/lib/db';
import { generateRawKey, hashKey, keyPrefix } from '@/lib/models/api-key';

export const dynamic = 'force-dynamic';

const MAX_KEYS = 5;

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  let user;
  try { user = await requireUser(); } catch (e) { return e as Response; }

  const db   = await getDb();
  const keys = await db
    .collection('api_keys')
    .find({ userId: user._id })
    .sort({ createdAt: -1 })
    .toArray();

  // Never expose keyHash in responses
  const safe = keys.map(({ keyHash: _h, ...k }) => k);

  return NextResponse.json({ keys: safe });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch (e) { return e as Response; }

  if (user.plan !== 'pro') {
    return NextResponse.json(
      { error: { message: 'API keys require a Pro plan.', code: 'PLAN_REQUIRED' } },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null) as { name?: string } | null;
  const name = String(body?.name ?? '').trim().slice(0, 80);
  if (!name) {
    return NextResponse.json(
      { error: { message: 'name is required.', code: 'VALIDATION_ERROR' } },
      { status: 400 },
    );
  }

  const db    = await getDb();
  const count = await db.collection('api_keys').countDocuments({ userId: user._id, active: true });
  if (count >= MAX_KEYS) {
    return NextResponse.json(
      { error: { message: `Maximum ${MAX_KEYS} API keys per account.`, code: 'LIMIT_EXCEEDED' } },
      { status: 403 },
    );
  }

  const rawKey = generateRawKey();
  const now    = new Date();

  const doc = {
    userId:    user._id,
    name,
    keyHash:   hashKey(rawKey),
    keyPrefix: keyPrefix(rawKey),
    active:    true,
    createdAt: now,
  };

  const result = await db.collection('api_keys').insertOne(doc);

  return NextResponse.json(
    {
      key: {
        _id:       result.insertedId,
        userId:    user._id,
        name,
        keyPrefix: doc.keyPrefix,
        active:    true,
        createdAt: now,
      },
      rawKey,  // shown ONCE — client must copy
    },
    { status: 201 },
  );
}
