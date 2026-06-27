'use server';

import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/current-user';
import { PLAN_LIMITS, type Plan } from '@/lib/models/user';
import { revalidatePath } from 'next/cache';

export interface ActionResponse {
  success?: string;
  error?: string;
}

const R_ADDR = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;

/** Add an XRPL issuer account to watch with Sentinel. */
export async function addIssuerAction(address: string, label: string): Promise<ActionResponse> {
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
  const limit = PLAN_LIMITS[plan].maxIssuers;

  const existing = await db.collection('issuers').findOne({ userId: user._id, address: addr });
  if (existing) return { error: 'You are already watching this issuer.' };

  const now = new Date();
  const result = await db.collection('issuers').insertOne({
    userId: user._id,
    address: addr,
    label: cleanLabel || `${addr.slice(0, 6)}…${addr.slice(-4)}`,
    active: true,
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
