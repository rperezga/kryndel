'use server';

import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/current-user';
import { PLAN_LIMITS, type Plan } from '@/lib/models/user';
import { validateAddress } from '@/lib/validate';
import { fetchVerifiedAbi, countEvents } from '@/lib/fetch-abi';
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
 * Rename a contract's label (the `name` field).
 */
export async function renameContract(address: string, name: string): Promise<ActionResponse> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { error: 'Unauthorized' };
  }

  const cleanName = name.trim().slice(0, 80);
  if (!cleanName) {
    return { error: 'Label cannot be empty.' };
  }

  const db = await getDb();
  const res = await db.collection('contracts').updateOne(
    { userId: user._id, address: address.toLowerCase() },
    { $set: { name: cleanName, updatedAt: new Date() } },
  );

  if (res.matchedCount === 0) {
    return { error: 'Contract not found.' };
  }

  revalidatePath('/dashboard/contracts');
  return { success: 'Label updated.' };
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

  // Best-effort: auto-fetch a verified ABI from the explorer so the contract's
  // events decode by name from the start (no manual upload). Null on failure.
  const autoAbi = surface === 'evm' ? await fetchVerifiedAbi(cleanAddress) : null;

  const now = new Date();
  const doc = {
    userId: user._id,
    address: cleanAddress,
    surface,
    name: cleanName || cleanAddress.slice(0, 10) + '…',
    ...(autoAbi ? { abi: autoAbi, abiSource: 'auto' } : {}),
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

/**
 * Auto-fetch a verified ABI from the explorer (Blockscout) and store it on the
 * contract so its custom events decode by name (cascade level 1 of the decoder).
 * The worker picks up the change on the next reconcile and decodes live events
 * with it — no manual ABI upload needed.
 */
export async function autoFetchAbi(address: string): Promise<ActionResponse> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { error: 'Unauthorized' };
  }

  const addr = (address ?? '').trim().toLowerCase();
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) {
    return { error: 'Auto-fetch is only available for EVM contracts.' };
  }

  const abi = await fetchVerifiedAbi(addr);
  if (!abi) {
    return { error: 'No verified ABI found for this contract on the explorer.' };
  }

  const db = await getDb();
  const res = await db.collection('contracts').updateOne(
    { userId: user._id, address: addr },
    { $set: { abi, abiSource: 'auto', updatedAt: new Date() } },
  );
  if (res.matchedCount === 0) return { error: 'Contract not found.' };

  revalidatePath('/dashboard/contracts');
  return { success: `Verified ABI fetched — ${countEvents(abi)} events now decode by name.` };
}
