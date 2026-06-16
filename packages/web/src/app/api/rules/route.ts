/**
 * GET  /api/rules  — list authenticated user's alert rules
 * POST /api/rules  — create an alert rule
 *   Free plan: 1 rule/contract, telegram channel only
 */
import { type NextRequest, NextResponse } from 'next/server';
import { requireUser }  from '@/lib/current-user';
import { getDb }        from '@/lib/db';
import { PLAN_LIMITS }  from '@/lib/models/user';
import { ObjectId }     from 'mongodb';

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
  const filter          = body?.filter ?? undefined;

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

  const plan   = user.plan ?? 'free';
  const limits = PLAN_LIMITS[plan];

  // PA.4 gating — channel must be allowed on this plan
  if (!limits.channels.includes(channel)) {
    return NextResponse.json(
      { error: `Channel '${channel}' is not available on the ${plan} plan. Upgrade to Pro.` },
      { status: 403 },
    );
  }

  // Webhook URL must be https:// (SSRF guard — app/CLAUDE.md security rules)
  if (channel === 'webhook' && !target.startsWith('https://')) {
    return NextResponse.json(
      { error: 'Webhook target must be an https:// URL.' },
      { status: 400 },
    );
  }

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

  // PA.4 gating — max rules per contract
  const ruleCount = await db.collection('alert_rules').countDocuments({
    userId: user._id, contractAddress,
  });
  if (ruleCount >= limits.maxRulesPerContract) {
    return NextResponse.json(
      { error: `${plan} plan allows ${limits.maxRulesPerContract} rule(s) per contract.` },
      { status: 403 },
    );
  }

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
  return NextResponse.json(
    { rule: { _id: result.insertedId, ...doc }, created: true },
    { status: 201 },
  );
}
