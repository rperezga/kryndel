'use server';
/**
 * Server Action — create a Telegram alert rule for the authenticated user.
 *
 * 2026-06-17 PA-SMOKE fix: extracted from the inline closure that used to
 * fetch /api/rules (which silently lost the session cookie). Now does the
 * auth check and MongoDB write directly. Mirrors the /api/rules POST logic.
 *
 * Invariants (mirror AUDIT-PA findings):
 *   • A1  requireUser()  — anonymous submissions rejected.
 *   • B4  plan narrowing before indexing PLAN_LIMITS.
 *   • M1  insert-then-verify atomic gate against the Free plan limit.
 *   • Contract ownership re-verified inside the action (race-safe).
 */
import { redirect }  from 'next/navigation';
import { getDb }     from '@/lib/db';
import { requireUser } from '@/lib/current-user';
import { PLAN_LIMITS, type Plan } from '@/lib/models/user';

export async function addRule(
  contractAddressIn: string,
  formData: FormData,
): Promise<void> {
  let actor;
  try {
    actor = await requireUser();
  } catch {
    redirect('/login');
  }

  const contractAddress = (contractAddressIn ?? '').toLowerCase();
  const eventName = (formData.get('eventName') as string ?? '').trim();
  const target    = (formData.get('target')    as string ?? '').trim();

  if (!eventName) {
    redirect(`/dashboard/rules?contract=${encodeURIComponent(contractAddressIn)}&error=` +
      encodeURIComponent('Event name is required.'));
  }
  if (!/^[0-9A-Za-z_\-x*]{1,80}$/.test(eventName) && !/^0x[0-9a-fA-F]{64}$/.test(eventName)) {
    redirect(`/dashboard/rules?contract=${encodeURIComponent(contractAddressIn)}&error=` +
      encodeURIComponent('Invalid event name.'));
  }
  if (!/^-?\d{5,15}$/.test(target)) {
    redirect(`/dashboard/rules?contract=${encodeURIComponent(contractAddressIn)}&error=` +
      encodeURIComponent('Telegram Chat ID must be an integer (e.g. -1001234567890).'));
  }

  const db = await getDb();

  const owned = await db.collection('contracts').findOne({
    userId: actor._id, address: contractAddress,
  });
  if (!owned) redirect('/dashboard');

  const plan: Plan = actor.plan === 'pro' ? 'pro' : 'free';
  const limits     = PLAN_LIMITS[plan];

  const now = new Date();
  const doc = {
    userId:          actor._id,
    contractAddress,
    surface:         (owned.surface as string) ?? 'evm',
    eventName,
    channel:         'telegram',
    target,
    active:          true,
    createdAt:       now,
    updatedAt:       now,
  };

  const result = await db.collection('alert_rules').insertOne(doc);

  const ruleCount = await db.collection('alert_rules').countDocuments({
    userId: actor._id, contractAddress,
  });
  if (ruleCount > limits.maxRulesPerContract) {
    await db.collection('alert_rules').deleteOne({ _id: result.insertedId });
    redirect(`/dashboard/rules?contract=${encodeURIComponent(contractAddressIn)}&error=` +
      encodeURIComponent(`${plan} plan allows ${limits.maxRulesPerContract} rule(s) per contract.`));
  }

  redirect(`/dashboard/rules?contract=${encodeURIComponent(contractAddressIn)}`);
}
