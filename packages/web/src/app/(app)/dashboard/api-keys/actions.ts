'use server';
/**
 * Server Actions for /dashboard/api-keys.
 * Separated from page.tsx so the module-level 'use server' doesn't conflict
 * with non-async exports (dynamic, metadata) in the Server Component.
 */
import { revalidatePath } from 'next/cache';
import { auth }           from '@/auth';
import { getDb }          from '@/lib/db';
import { usersCollection } from '@/lib/models/index';
import { generateRawKey, hashKey, keyPrefix } from '@/lib/models/api-key';
import { ObjectId }       from 'mongodb';

const MAX_KEYS = 5;

export interface CreateKeyState {
  error?:  string;
  rawKey?: string; // shown once, then gone
}

export async function createApiKey(
  _prev: CreateKeyState,
  formData: FormData,
): Promise<CreateKeyState> {
  const session = await auth();
  if (!session?.user?.email) return { error: 'Unauthorized' };

  const users = await usersCollection();
  const user  = await users.findOne({ email: session.user.email.toLowerCase() });
  if (!user) return { error: 'Unauthorized' };
  if (user.plan !== 'pro') return { error: 'Pro plan required.' };

  const name = String(formData.get('name') ?? '').trim().slice(0, 80);
  if (!name) return { error: 'Name is required.' };

  const db    = await getDb();
  const count = await db.collection('api_keys').countDocuments({ userId: user._id, active: true });
  if (count >= MAX_KEYS) return { error: `Maximum ${MAX_KEYS} API keys reached.` };

  const rawKey = generateRawKey();
  await db.collection('api_keys').insertOne({
    userId:    user._id,
    name,
    keyHash:   hashKey(rawKey),
    keyPrefix: keyPrefix(rawKey),
    active:    true,
    createdAt: new Date(),
  });

  revalidatePath('/dashboard/api-keys');
  return { rawKey };
}

export async function revokeApiKey(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.email) return;

  const users = await usersCollection();
  const user  = await users.findOne({ email: session.user.email.toLowerCase() });
  if (!user) return;

  const id = String(formData.get('id') ?? '');
  if (!ObjectId.isValid(id)) return;

  const db = await getDb();
  await db.collection('api_keys').updateOne(
    { _id: new ObjectId(id), userId: user._id },
    { $set: { active: false } },
  );

  revalidatePath('/dashboard/api-keys');
}
