'use server';

import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/current-user';
import { PLAN_LIMITS, type Plan } from '@/lib/models/user';
import { validateAddress } from '@/lib/validate';
import { revalidatePath } from 'next/cache';

export interface ActionResponse {
  success?: string;
  error?: string;
}

/**
 * Toggle contract active state.
 */
export async function toggleContractActive(address: string, active: boolean): Promise<ActionResponse> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { error: 'Unauthorized' };
  }

  const db = await getDb();
  await db.collection('contracts').updateOne(
    { userId: user._id, address: address.toLowerCase() },
    { $set: { active, updatedAt: new Date() } }
  );

  revalidatePath('/dashboard/contracts');
  return { success: 'Contract active status updated.' };
}

/**
 * Delete contract and cascade delete its alert rules.
 */
export async function deleteContract(address: string): Promise<ActionResponse> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { error: 'Unauthorized' };
  }

  const db = await getDb();
  const addr = address.toLowerCase();

  const del = await db.collection('contracts').deleteOne({
    userId: user._id,
    address: addr,
  });

  if (del.deletedCount === 0) {
    return { error: 'Contract not found.' };
  }

  // Cascade delete alert rules
  await db.collection('alert_rules').deleteMany({
    userId: user._id,
    contractAddress: addr,
  });

  revalidatePath('/dashboard/contracts');
  return { success: 'Contract removed successfully.' };
}

/**
 * Watch / Add a new contract.
 */
export async function addContractAction(
  address: string,
  surface: string,
  name: string
): Promise<ActionResponse> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { error: 'Unauthorized' };
  }

  const cleanAddress = address.trim().toLowerCase();
  const cleanName = name.trim().slice(0, 80);

  if (!cleanAddress || !validateAddress(cleanAddress)) {
    return { error: 'Invalid contract address.' };
  }
  if (!['evm', 'native'].includes(surface)) {
    return { error: 'Invalid network.' };
  }

  const db = await getDb();
  const plan: Plan = user.plan === 'pro' ? 'pro' : 'free';
  const limit = PLAN_LIMITS[plan].maxContracts;

  const existing = await db.collection('contracts').findOne({
    userId: user._id,
    address: cleanAddress,
    surface,
  });
  if (existing) {
    return { error: 'Contract already exists in your dashboard.' };
  }

  const now = new Date();
  const doc = {
    userId: user._id,
    address: cleanAddress,
    surface,
    name: cleanName || cleanAddress.slice(0, 10) + '…',
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection('contracts').insertOne(doc);

  const count = await db.collection('contracts').countDocuments({ userId: user._id });
  if (count > limit) {
    await db.collection('contracts').deleteOne({ _id: result.insertedId });
    return {
      error: `${plan} plan allows up to ${limit} contracts. Upgrade to Pro for more.`,
    };
  }

  revalidatePath('/dashboard/contracts');
  return { success: 'Contract successfully added!' };
}
