/**
 * GET  /api/contracts  — list authenticated user's watched contracts
 * POST /api/contracts  — register a new contract to watch (Free: max 3)
 *
 * Security (AUDIT-PA-2026-06-16):
 *   • M1: insert-then-verify keeps the Free plan limit atomic against
 *         concurrent requests (rolls the new doc back if a parallel insert
 *         pushed the user past the limit).
 *   • B4: plan narrowed to the literal union before indexing PLAN_LIMITS.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { requireUser }            from '@/lib/current-user';
import { getDb }                  from '@/lib/db';
import { PLAN_LIMITS, type Plan } from '@/lib/models/user';
import { validateAddress }        from '@/lib/validate';

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

  if (!address || !validateAddress(address)) {
    return NextResponse.json({ error: 'Invalid contract address.' }, { status: 400 });
  }
  if (!['evm', 'native'].includes(surface)) {
    return NextResponse.json({ error: 'surface must be evm or native.' }, { status: 400 });
  }

  const db = await getDb();

  // B4: narrow plan before indexing PLAN_LIMITS
  const plan: Plan = user.plan === 'pro' ? 'pro' : 'free';
  const limit      = PLAN_LIMITS[plan].maxContracts;

  // Idempotent: if this user already watches this contract, return it
  const existing = await db.collection('contracts').findOne({
    userId: user._id, address, surface,
  });
  if (existing) {
    return NextResponse.json({ contract: existing, created: false }, { status: 200 });
  }

  // M1: insert-then-verify (atomic plan gate) ─────────────────────────────────
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

  const count = await db.collection('contracts').countDocuments({ userId: user._id });
  if (count > limit) {
    await db.collection('contracts').deleteOne({ _id: result.insertedId });
    return NextResponse.json(
      { error: `${plan} plan allows up to ${limit} contracts. Upgrade to Pro for more.` },
      { status: 403 },
    );
  }

  return NextResponse.json(
    { contract: { _id: result.insertedId, ...doc }, created: true },
    { status: 201 },
  );
}
