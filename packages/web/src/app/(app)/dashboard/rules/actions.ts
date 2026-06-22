'use server';

import { getDb } from '@/lib/db';
import { requireUser } from '@/lib/current-user';
import { PLAN_LIMITS, type Plan } from '@/lib/models/user';
import { assertSafePublicUrl, sanitizeKeys } from '@/lib/ssrf';
import { matchesRule } from '@kryndel/core';
import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

function escapeMarkdownV2(s: string): string {
  return s.replace(/[\\_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

export interface ActionResponse {
  success?: string;
  error?: string;
}

/**
 * Add / Watch a new alert rule.
 */
export async function addRuleAction(
  contractAddress: string,
  name: string,
  eventName: string,
  channel: string,
  target: string,
  filterArgName?: string,
  filterOp?: string,
  filterValue?: string
): Promise<ActionResponse> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { error: 'Unauthorized' };
  }

  const cleanAddr = (contractAddress ?? '').trim().toLowerCase();
  const cleanEvent = (eventName ?? '').trim();
  const cleanTarget = (target ?? '').trim();
  const cleanName = (name ?? '').trim();

  if (!cleanEvent) {
    return { error: 'Event name is required.' };
  }
  if (!/^[0-9A-Za-z_\-x*]{1,80}$/.test(cleanEvent) && !/^0x[0-9a-fA-F]{64}$/.test(cleanEvent)) {
    return { error: 'Invalid event name.' };
  }
  if (!cleanTarget) {
    return { error: 'Destination target is required.' };
  }

  // Validate target based on channel
  if (channel === 'telegram') {
    if (!/^-?\d{5,15}$/.test(cleanTarget)) {
      return { error: 'Telegram Chat ID must be an integer (e.g. -1001234567890).' };
    }
  } else if (channel === 'webhook' || channel === 'discord' || channel === 'slack') {
    try {
      await assertSafePublicUrl(cleanTarget);
    } catch (e: any) {
      return { error: e.message };
    }
  } else if (channel === 'email') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanTarget)) {
      return { error: 'Invalid destination email address.' };
    }
  } else {
    return { error: `Channel '${channel}' is not supported.` };
  }

  // B4: Plan limits check
  const plan: Plan = user.plan === 'pro' ? 'pro' : 'free';
  const limits = PLAN_LIMITS[plan];

  if (!limits.channels.includes(channel)) {
    return { error: `Channel '${channel}' is not available on the ${plan} plan. Upgrade to Pro.` };
  }

  // Handle optional argument filters
  let filter: Record<string, any> | undefined;
  if (filterArgName?.trim()) {
    const cleanArg = filterArgName.trim();
    if (!/^[a-zA-Z_]\w{0,63}$/.test(cleanArg)) {
      return { error: 'Invalid argument name (letters, digits, underscore; max 64 chars).' };
    }
    if (!filterValue?.trim()) {
      return { error: 'Filter value is required when an argument name is set.' };
    }
    const OP_MAP: Record<string, string> = {
      '>': '$gt', '<': '$lt', '>=': '$gte', '<=': '$lte', '=': '$eq',
    };
    const mongoOp = OP_MAP[filterOp ?? '='];
    if (!mongoOp) {
      return { error: 'Invalid filter operator.' };
    }
    filter = { [cleanArg]: { [mongoOp]: filterValue.trim() } };
  }

  const db = await getDb();

  // Verify contract is owned by user
  const contract = await db.collection('contracts').findOne({
    userId: user._id,
    address: cleanAddr,
  });
  if (!contract) {
    return { error: 'Contract not found in your dashboard.' };
  }

  // M1: Insert-then-verify atomic rule limits gate
  const now = new Date();
  const doc = {
    userId: user._id,
    contractAddress: cleanAddr,
    surface: contract.surface ?? 'evm',
    eventName: cleanEvent,
    name: cleanName || `${cleanEvent} Alert`,
    channel,
    target: cleanTarget,
    ...(filter ? { filter } : {}),
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection('alert_rules').insertOne(doc);

  const ruleCount = await db.collection('alert_rules').countDocuments({
    userId: user._id,
    contractAddress: cleanAddr,
  });

  if (ruleCount > limits.maxRulesPerContract) {
    await db.collection('alert_rules').deleteOne({ _id: result.insertedId });
    return {
      error: `${plan.toUpperCase()} plan allows up to ${limits.maxRulesPerContract} rule(s) per contract. Upgrade to Pro for more.`,
    };
  }

  revalidatePath('/dashboard/rules');
  return { success: 'Alert rule configured successfully!' };
}

/**
 * Delete a rule.
 */
export async function deleteRuleAction(id: string): Promise<ActionResponse> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { error: 'Unauthorized' };
  }

  if (!ObjectId.isValid(id)) {
    return { error: 'Invalid rule ID.' };
  }

  const db = await getDb();
  const del = await db.collection('alert_rules').deleteOne({
    _id: new ObjectId(id),
    userId: user._id,
  });

  if (del.deletedCount === 0) {
    return { error: 'Rule not found.' };
  }

  revalidatePath('/dashboard/rules');
  return { success: 'Rule deleted successfully.' };
}

/**
 * Toggle a rule active/muted status.
 */
export async function toggleRuleActiveAction(id: string, active: boolean): Promise<ActionResponse> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { error: 'Unauthorized' };
  }

  if (!ObjectId.isValid(id)) {
    return { error: 'Invalid rule ID.' };
  }

  const db = await getDb();
  const res = await db.collection('alert_rules').updateOne(
    { _id: new ObjectId(id), userId: user._id },
    { $set: { active, updatedAt: new Date() } }
  );

  if (res.matchedCount === 0) {
    return { error: 'Rule not found.' };
  }

  revalidatePath('/dashboard/rules');
  return { success: `Rule ${active ? 'activated' : 'muted'} successfully.` };
}

/**
 * Preview rule matches over historical events in the last 24 hours.
 */
export async function previewMatchesAction(
  contractAddress: string,
  eventName: string,
  filterArgName?: string,
  filterOp?: string,
  filterValue?: string
): Promise<{ count: number; error?: string }> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { count: 0, error: 'Unauthorized' };
  }

  const addr = (contractAddress ?? '').trim().toLowerCase();
  const cleanEvent = (eventName ?? '').trim();

  if (!addr || !cleanEvent) {
    return { count: 0 };
  }

  const db = await getDb();

  // Verify contract is owned by user
  const contract = await db.collection('contracts').findOne({
    userId: user._id,
    address: addr,
  });
  if (!contract) {
    return { count: 0, error: 'Contract not found.' };
  }

  // Build temporary rule object to run matchesRule
  let filter: Record<string, any> | undefined;
  if (filterArgName?.trim()) {
    const cleanArg = filterArgName.trim();
    const OP_MAP: Record<string, string> = {
      '>': '$gt', '<': '$lt', '>=': '$gte', '<=': '$lte', '=': '$eq',
    };
    const mongoOp = OP_MAP[filterOp ?? '='];
    if (mongoOp && filterValue?.trim()) {
      filter = { [cleanArg]: { [mongoOp]: filterValue.trim() } };
    }
  }

  const tempRule = {
    id: 'temp',
    contract: addr,
    event: cleanEvent,
    channel: 'telegram' as const,
    target: 'temp',
    filter,
  };

  const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Query events in last 24h
  const events = await db.collection('events').find({
    $or: [{ contractAddress: addr }, { contract: addr }],
    indexedAt: { $gte: past24h },
  }).toArray();

  let matchCount = 0;
  for (const ev of events) {
    const formattedEvent = {
      name: ev.name,
      args: ev.args,
      contractAddress: ev.contractAddress || ev.contract,
    };
    // If rule event is '*' (match any) or matches exact event name
    if (cleanEvent === '*' || formattedEvent.name === cleanEvent) {
      if (matchesRule(formattedEvent, tempRule)) {
        matchCount++;
      }
    }
  }

  return { count: matchCount };
}

/**
 * Send a test alert to verify target channel connection.
 */
export async function sendTestAlertAction(
  channel: string,
  target: string,
  eventName: string
): Promise<ActionResponse> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { error: 'Unauthorized' };
  }

  const cleanTarget = (target ?? '').trim();
  const cleanEvent = (eventName ?? 'TestEvent').trim();

  if (!cleanTarget) {
    return { error: 'Destination target is required for testing.' };
  }

  if (channel === 'telegram') {
    if (!/^-?\d{5,15}$/.test(cleanTarget)) {
      return { error: 'Telegram Chat ID must be an integer.' };
    }
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return { error: 'Telegram Bot Token is not configured on this server.' };
    }
    const text = `🔔 *Kryndel Test Alert*\n⚡ Event: *${escapeMarkdownV2(cleanEvent)}*\n🧪 Status: _Active and Verified_`;
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: cleanTarget, text, parse_mode: 'MarkdownV2' }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return { error: `Telegram Bot API returned error ${res.status}: ${body}` };
      }
    } catch (err: any) {
      return { error: `Failed to connect to Telegram: ${err.message}` };
    }
  } else if (channel === 'webhook' || channel === 'discord' || channel === 'slack') {
    try {
      await assertSafePublicUrl(cleanTarget);
    } catch (e: any) {
      return { error: e.message };
    }

    try {
      let bodyData = {};
      if (channel === 'webhook') {
        bodyData = {
          event: 'test_alert',
          message: 'Kryndel Test Alert: Rule channel verified!',
          eventName: cleanEvent,
          timestamp: new Date().toISOString(),
        };
      } else if (channel === 'discord') {
        bodyData = {
          content: `🔔 **Kryndel Test Alert**\n⚡ Event: \`${cleanEvent}\`\n🧪 Status: *Active and Verified*`,
        };
      } else if (channel === 'slack') {
        bodyData = {
          text: `🔔 *Kryndel Test Alert*\n⚡ Event: \`${cleanEvent}\`\n🧪 Status: *Active and Verified*`,
        };
      }

      const res = await fetch(cleanTarget, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });

      if (!res.ok) {
        return { error: `Target server returned error status ${res.status}` };
      }
    } catch (err: any) {
      return { error: `Connection failed: ${err.message}` };
    }
  } else if (channel === 'email') {
    console.log(`[sendTestAlertAction] Email alert simulation sent to: ${cleanTarget}`);
    return { success: 'Simulated test email sent to ' + cleanTarget };
  } else {
    return { error: `Testing for channel '${channel}' is not supported.` };
  }

  return { success: 'Test alert sent successfully!' };
}

/**
 * Legacy Server Action for backward compatibility with existing unit tests.
 */
export async function addRule(
  contractAddressIn: string,
  formData: FormData
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
    name:            `${eventName} Alert`,
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
