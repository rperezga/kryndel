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
  const eventName      = (formData.get('eventName')      as string ?? '').trim();
  const target         = (formData.get('target')         as string ?? '').trim();
  const filterArgName  = (formData.get('filterArgName')  as string ?? '').trim();
  const filterOp       = (formData.get('filterOp')       as string ?? '').trim();
  const filterValue    = (formData.get('filterValue')    as string ?? '').trim();

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

  // Validate optional arg filter — only if filterArgName is provided
  // Operators come from a closed enum (user-submitted but validated here) so they
  // are safe to store as-is; values from filterValue are stored as strings.
  const OP_MAP: Record<string, string> = {
    '>': '$gt', '<': '$lt', '>=': '$gte', '<=': '$lte', '=': '$eq',
  };
  let filter: Record<string, unknown> | undefined;
  if (filterArgName) {
    if (!/^[a-zA-Z_]\w{0,63}$/.test(filterArgName)) {
      redirect(`/dashboard/rules?contract=${encodeURIComponent(contractAddressIn)}&error=` +
        encodeURIComponent('Invalid argument name (letters, digits, underscore; max 64 chars).'));
    }
    if (!filterValue) {
      redirect(`/dashboard/rules?contract=${encodeURIComponent(contractAddressIn)}&error=` +
        encodeURIComponent('Filter value is required when an argument name is set.'));
    }
    const mongoOp = OP_MAP[filterOp];
    if (!mongoOp) {
      redirect(`/dashboard/rules?contract=${encodeURIComponent(contractAddressIn)}&error=` +
        encodeURIComponent('Invalid filter operator.'));
    }
    filter = { [filterArgName]: { [mongoOp]: filterValue } };
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
    ...(filter ? { filter } : {}),
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
