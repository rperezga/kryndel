'use server';
/**
 * Server Action — register a contract for the authenticated user.
 *
 * 2026-06-17 PA-SMOKE fix: extracted from the inline closure that used to
 * fetch /api/contracts (which silently lost the session cookie). Now does
 * the auth check and MongoDB write directly.
 *
 * Invariants (mirror AUDIT-PA findings):
 *   • A1  requireUser()  — anonymous submissions rejected.
 *   • B4  plan narrowing before indexing PLAN_LIMITS.
 *   • M1  insert-then-verify atomic gate against the Free plan limit.
 *   • Idempotent on (userId, address, surface).
 */
import { redirect } from 'next/navigation';
import { getDb }    from '@/lib/db';
import { requireUser } from '@/lib/current-user';
import { PLAN_LIMITS, type Plan } from '@/lib/models/user';
import { validateAddress } from '@/lib/validate';

export async function addContract(formData: FormData): Promise<void> {
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect('/login');
  }

  const address = (formData.get('address') as string ?? '').trim().toLowerCase();
  const surface = (formData.get('surface') as string) ?? 'evm';
  const name    = (formData.get('name')    as string ?? '').trim().slice(0, 80);

  if (!address || !validateAddress(address)) {
    redirect('/dashboard/add-contract?error=' + encodeURIComponent('Invalid contract address.'));
  }
  if (!['evm', 'native'].includes(surface)) {
    redirect('/dashboard/add-contract?error=' + encodeURIComponent('Invalid network.'));
  }

  const db = await getDb();

  const plan: Plan = user.plan === 'pro' ? 'pro' : 'free';
  const limit      = PLAN_LIMITS[plan].maxContracts;

  const existing = await db.collection('contracts').findOne({
    userId: user._id, address, surface,
  });
  if (existing) redirect('/dashboard');

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
    redirect('/dashboard/add-contract?error=' + encodeURIComponent(
      `${plan} plan allows up to ${limit} contracts. Upgrade to Pro for more.`,
    ));
  }

  redirect('/dashboard');
}
