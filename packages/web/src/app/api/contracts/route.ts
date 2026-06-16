/**
 * GET  /api/contracts  — list authenticated user's watched contracts
 * POST /api/contracts  — register a new contract to watch (Free: max 3)
 */
import { type NextRequest, NextResponse } from 'next/server';
import { requireUser }        from '@/lib/current-user.js';
import { getDb }              from '@/lib/db.js';
import { PLAN_LIMITS }        from '@/lib/models/user.js';
import { validateAddress }    from '@/lib/validate.js';
import { ObjectId }           from 'mongodb';

export const dynamic = 'force-dynamic';

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  let user;
  try { user = await requireUser(); } catch (e) { return e as Response; }

  const db = await getDb();
  const contracts = await db
    .collection('contracts')
    .find({ userId: user._id })
    .sort({ createdAt: -1 })
    .toArray();

  return NextResponse.json({ contracts });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch (e) { return e as Response; }

  const body = await req.json().catch(() => null) as {
    address?: string;
    surface?: string;
    name?: string;
  } | null;

  const address = body?.address?.trim().toLowerCase();
  const surface = body?.surface ?? 'evm';
  const name    = body?.name?.trim().slice(0, 80) ?? '';

  // Validate
  if (!address || !validateAddress(address)) {
    return NextResponse.json({ error: 'Invalid contract address.' }, { status: 400 });
  }
  if (!['evm', 'native'].includes(surface)) {
    return NextResponse.json({ error: 'surface must be evm or native.' }, { status: 400 });
  }

  const db = await getDb();

  // Free plan: max 3 contracts
  const limit = PLAN_LIMITS[user.plan ?? 'free'].maxContracts;
  const count = await db.collection('contracts').countDocuments({ userId: user._id });
  if (count >= limit) {
    return NextResponse.json(
      { error: `Free plan allows up to ${limit} contracts. Upgrade to Pro for more.` },
      { status: 403 },
    );
  }

  // Idempotent: if this user already watches this contract, return it
  const existing = await db.collection('contracts').findOne({
    userId: user._id, address, surface,
  });
  if (existing) {
    return NextResponse.json({ contract: existing, created: false }, { status: 200 });
  }

  const now = new Date();
  const doc = {
    userId:    user._id,
    address,
    surface,
    name:      name || address.slice(0, 10) + '…',
    active:    true,
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection('contracts').insertOne(doc);
  return NextResponse.json(
    { contract: { _id: result.insertedId, ...doc }, created: true },
    { status: 201 },
  );
}
