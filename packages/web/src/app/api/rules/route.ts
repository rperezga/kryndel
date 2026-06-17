/**
 * GET  /api/rules  — list authenticated user's alert rules
 * POST /api/rules  — create an alert rule
 *   Free plan: 1 rule/contract, telegram channel only
 *
 * Security (AUDIT-PA-2026-06-16):
 *   • A2: assertSafePublicUrl() for webhook/discord targets — DNS-aware SSRF
 *         guard that blocks private IPs, link-local (incl. cloud metadata),
 *         and hostnames that resolve into those ranges.
 *   • M1: insert-then-verify keeps the plan gate atomic against concurrent
 *         requests (rolls the new doc back if a parallel insert pushed the
 *         user past the limit).
 *   • M4: sanitizeKeys() strips `$` / `.` from the user-supplied `filter`
 *         object before it lands in MongoDB.
 *   • B4: plan narrowed to the literal union before indexing PLAN_LIMITS.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { requireUser }            from '@/lib/current-user';
import { getDb }                  from '@/lib/db';
import { PLAN_LIMITS, type Plan } from '@/lib/models/user';
import { assertSafePublicUrl, sanitizeKeys } from '@/lib/ssrf';

export const dynamic = 'force-dynamic';

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  let user;
  try { user = await requireUser(); } catch (e) { return e as Response; }

  const db = await getDb();
  const rules = await db
    .collection('alert_rules')
    .find({ userId: user._id })
    .sort({ createdAt: -1 })
    .toArray();

  return NextResponse.json({ rules });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch (e) { return e as Response; }

  const body = await req.json().catch(() => null) as {
    contractAddress?: string;
    surface?: string;
    eventName?: string;
    channel?: string;
    target?: string;
    filter?: Record<string, unknown>;
  } | null;

  const contractAddress = body?.contractAddress?.trim().toLowerCase();
  const surface         = body?.surface   ?? 'evm';
  const eventName       = body?.eventName?.trim() ?? '';
  const channel         = body?.channel   ?? 'telegram';
  const target          = body?.target?.trim() ?? '';
  const rawFilter       = body?.filter ?? undefined;

  // Basic validation
  if (!contractAddress) {
    return NextResponse.json({ error: 'contractAddress is required.' }, { status: 400 });
  }
  if (!eventName) {
    return NextResponse.json({ error: 'eventName is required.' }, { status: 400 });
  }
  if (!target) {
    return NextResponse.json({ error: 'target is required.' }, { status: 400 });
  }

  // B4: narrow `plan` to the union before indexing PLAN_LIMITS.
  const plan: Plan = user.plan === 'pro' ? 'pro' : 'free';
  const limits     = PLAN_LIMITS[plan];

  // PA.4 gating — channel must be allowed on this plan
  if (!limits.channels.includes(channel)) {
    return NextResponse.json(
      { error: `Channel '${channel}' is not available on the ${plan} plan. Upgrade to Pro.` },
      { status: 403 },
    );
  }

  // A2: DNS-aware SSRF guard for webhook/discord targets
  if (channel === 'webhook' || channel === 'discord') {
    try {
      await assertSafePublicUrl(target);
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
  }

  // M4: sanitize the user-supplied `filter` object — strip $/. from keys
  // recursively, otherwise an attacker could embed MongoDB operators that
  // would be honoured if `filter` is ever passed to a `.find()` query.
  const filter = rawFilter && typeof rawFilter === 'object'
    ? sanitizeKeys(rawFilter) as Record<string, unknown>
    : undefined;

  const db = await getDb();

  // Verify this user owns the contract
  const contract = await db.collection('contracts').findOne({
    userId: user._id, address: contractAddress,
  });
  if (!contract) {
    return NextResponse.json(
      { error: 'Contract not found. Add it to your dashboard first.' },
      { status: 404 },
    );
  }

  // M1: insert-then-verify. The pre-insert count was a TOCTOU window.
  // Insert first, count after — if the count exceeds the limit, roll the
  // new doc back. Two concurrent requests still race, but only one wins.
  const now = new Date();
  const doc = {
    userId: user._id,
    contractAddress,
    surface,
    eventName,
    channel,
    target,
    ...(filter && Object.keys(filter).length ? { filter } : {}),
    active:    true,
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection('alert_rules').insertOne(doc);

  const ruleCount = await db.collection('alert_rules').countDocuments({
    userId: user._id, contractAddress,
  });
  if (ruleCount > limits.maxRulesPerContract) {
    await db.collection('alert_rules').deleteOne({ _id: result.insertedId });
    return NextResponse.json(
      { error: `${plan} plan allows ${limits.maxRulesPerContract} rule(s) per contract.` },
      { status: 403 },
    );
  }

  return NextResponse.json(
    { rule: { _id: result.insertedId, ...doc }, created: true },
    { status: 201 },
  );
}
