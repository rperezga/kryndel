'use server';

import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/current-user';
import { PLAN_LIMITS, type Plan } from '@/lib/models/user';
import { assertSafePublicUrl } from '@/lib/ssrf';
import { revalidatePath } from 'next/cache';

export interface ActionResponse {
  success?: string;
  error?: string;
}

const R_ADDR = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;

/** Add an XRPL issuer account to watch with Sentinel. */
export async function addIssuerAction(
  address: string,
  label: string,
  channel?: string,
  target?: string,
): Promise<ActionResponse> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { error: 'Unauthorized' };
  }

  const addr = (address ?? '').trim();
  const cleanLabel = (label ?? '').trim().slice(0, 80);
  if (!R_ADDR.test(addr)) {
    return { error: 'Enter a valid XRPL classic address (starts with “r”).' };
  }

  const db = await getDb();
  const plan: Plan = user.plan === 'pro' ? 'pro' : 'free';
  const limits = PLAN_LIMITS[plan];
  const limit = limits.maxIssuers;

  // Optional alert destination (where security alerts are delivered).
  const ch = (channel ?? '').trim();
  const tg = (target ?? '').trim();
  let alert: { alertChannel: string; alertTarget: string } | undefined;
  if (ch && ch !== 'none') {
    if (!['telegram', 'discord', 'webhook'].includes(ch)) return { error: 'Invalid alert channel.' };
    if (!limits.channels.includes(ch)) {
      return { error: `The ${ch} channel is not available on the ${plan} plan. Upgrade to Pro.` };
    }
    if (!tg) return { error: 'An alert destination is required for the selected channel.' };
    if (ch === 'telegram') {
      if (!/^-?\d{5,15}$/.test(tg)) return { error: 'Telegram Chat ID must be an integer (e.g. -1001234567890).' };
    } else {
      try {
        await assertSafePublicUrl(tg);
      } catch (e) {
        return { error: e instanceof Error ? e.message : 'Invalid webhook URL.' };
      }
    }
    alert = { alertChannel: ch, alertTarget: tg };
  }

  const existing = await db.collection('issuers').findOne({ userId: user._id, address: addr });
  if (existing) return { error: 'You are already watching this issuer.' };

  const now = new Date();
  const result = await db.collection('issuers').insertOne({
    userId: user._id,
    address: addr,
    label: cleanLabel || `${addr.slice(0, 6)}…${addr.slice(-4)}`,
    active: true,
    ...(alert ?? {}),
    createdAt: now,
    updatedAt: now,
  });

  const count = await db.collection('issuers').countDocuments({ userId: user._id });
  if (count > limit) {
    await db.collection('issuers').deleteOne({ _id: result.insertedId });
    return { error: `${plan.toUpperCase()} plan allows up to ${limit} watched issuer${limit === 1 ? '' : 's'}. Upgrade to Pro for more.` };
  }

  revalidatePath('/dashboard/sentinel');
  return { success: 'Issuer added — Sentinel is now watching it.' };
}

/** Stop watching an issuer. */
export async function deleteIssuerAction(address: string): Promise<ActionResponse> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { error: 'Unauthorized' };
  }
  const db = await getDb();
  const del = await db.collection('issuers').deleteOne({ userId: user._id, address: (address ?? '').trim() });
  if (del.deletedCount === 0) return { error: 'Issuer not found.' };
  revalidatePath('/dashboard/sentinel');
  return { success: 'Issuer removed.' };
}

/** Pause / resume watching an issuer. */
export async function toggleIssuerActiveAction(address: string, active: boolean): Promise<ActionResponse> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { error: 'Unauthorized' };
  }
  const db = await getDb();
  await db.collection('issuers').updateOne(
    { userId: user._id, address: (address ?? '').trim() },
    { $set: { active, updatedAt: new Date() } },
  );
  revalidatePath('/dashboard/sentinel');
  return { success: active ? 'Watching resumed.' : 'Watching paused.' };
}
