'use server';
/**
 * Server actions for user-defined address labels (Idea 1).
 * Stored in `address_labels` { userId, address(lowercased), label, surface }.
 * The key is lowercased so EVM (case-insensitive) lookups always match; the
 * pill still displays the original-case address. Mirrors renameContract.
 */
import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/current-user';
import { revalidatePath } from 'next/cache';

export interface ActionResponse {
  success?: string;
  error?: string;
}

const isEvm    = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a);
const isNative = (a: string) => /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(a);

export async function setAddressLabel(address: string, label: string): Promise<ActionResponse> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { error: 'Unauthorized' };
  }

  const raw   = (address ?? '').trim();
  const clean = (label ?? '').trim().slice(0, 60);
  if (!raw || !(isEvm(raw) || isNative(raw))) return { error: 'Invalid address (use 0x… or r…).' };
  if (!clean) return { error: 'Label cannot be empty.' };

  const key     = raw.toLowerCase();
  const surface = isEvm(raw) ? 'evm' : 'native';
  const db = await getDb();
  await db.collection('address_labels').updateOne(
    { userId: user._id, address: key },
    { $set: { label: clean, surface, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true },
  );

  revalidatePath('/dashboard/labels');
  return { success: 'Label saved.' };
}

export async function deleteAddressLabel(address: string): Promise<ActionResponse> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { error: 'Unauthorized' };
  }

  const key = (address ?? '').trim().toLowerCase();
  if (!key) return { error: 'Invalid address.' };

  const db = await getDb();
  await db.collection('address_labels').deleteOne({ userId: user._id, address: key });

  revalidatePath('/dashboard/labels');
  return { success: 'Label removed.' };
}
