'use server';
/**
 * Server Action — register an AlertRule for an authenticated user.
 *
 * Closes AUDIT-PA-2026-06-16 findings:
 *   • A1: requireUser() at the top — anonymous visitors get a clean error.
 *         The rule is stamped with userId so the worker can scope dispatches.
 *         Plan gating mirrors /api/rules so this is NOT a bypass of the Free
 *         limit (channel allowlist + rules-per-contract limit, both honoured).
 *         Collection corrected from `rules` → `alert_rules` — the same one the
 *         worker reads (previously a write-only dead-letter).
 *   • A2: assertSafePublicUrl() replaces the literal startsWith('https://')
 *         and the regex-based isPrivateHost — now DNS-aware and blocks
 *         cloud metadata, IPv6 loopback / link-local, etc.
 *   • M1: insert-then-verify keeps the rules-per-contract limit atomic
 *         against concurrent submissions.
 *   • B4: plan narrowed to the union before indexing PLAN_LIMITS.
 */
import { getDb }                  from '@/lib/db';
import { requireUser }            from '@/lib/current-user';
import { PLAN_LIMITS, type Plan } from '@/lib/models/user';
import { assertSafePublicUrl }    from '@/lib/ssrf';
import { validateAddress }        from '@/lib/validate';
import { revalidatePath }         from 'next/cache';

export interface WatchState {
  error?:   string;
  success?: string;
}

export async function watchEvent(
  _prevState: WatchState,
  formData: FormData,
): Promise<WatchState> {
  // ── A1: authentication is REQUIRED ────────────────────────────────────────
  let user;
  try {
    user = await requireUser();
  } catch {
    return { error: 'You must sign in to create alert rules.' };
  }

  // ── Parse form ─────────────────────────────────────────────────────────────
  const contract = (formData.get('contract') as string | null)?.trim() ?? '';
  const event    = (formData.get('event')    as string | null)?.trim() ?? '';
  const channel  = (formData.get('channel')  as string | null)?.trim() ?? '';
  const target   = (formData.get('target')   as string | null)?.trim() ?? '';

  if (!contract || !event || !channel || !target) {
    return { error: 'All fields are required.' };
  }

  if (!['telegram', 'discord', 'webhook'].includes(channel)) {
    return { error: 'Invalid channel. Use: telegram, discord, or webhook.' };
  }

  // Event name: safe chars only (letters, digits, _, -, or 0x topic hash)
  if (!/^[0-9A-Za-z_\-x]{1,80}$/.test(event) && !/^0x[0-9a-fA-F]{64}$/.test(event)) {
    return { error: 'Invalid event name.' };
  }

  // ── A1: plan gating (mirrors /api/rules) ─────────────────────────────────
  const plan: Plan = user.plan === 'pro' ? 'pro' : 'free';
  const limits     = PLAN_LIMITS[plan];

  if (!limits.channels.includes(channel)) {
    return {
      error: `Channel '${channel}' is not available on the ${plan} plan. Upgrade to Pro.`,
    };
  }

  // ── Target validation per channel ────────────────────────────────────────
  if (channel === 'telegram') {
    if (!/^-?\d{5,15}$/.test(target)) {
      return { error: 'Telegram Chat ID must be an integer (e.g. -1001234567890).' };
    }
  } else {
    // A2: DNS-aware SSRF guard
    try {
      await assertSafePublicUrl(target);
    } catch (e) {
      return { error: (e as Error).message };
    }
    if (channel === 'discord') {
      const u = new URL(target);
      if (!u.hostname.endsWith('discord.com')) {
        return { error: 'Discord webhook must point to discord.com.' };
      }
    }
  }

  const contractAddress = contract.toLowerCase();

  try {
    const db = await getDb();

    // Verify this user owns the contract — no bypass via /contract/[address]
    const owned = await db.collection('contracts').findOne({
      userId: user._id, address: contractAddress,
    });
    if (!owned) {
      return {
        error: 'Add this contract to your dashboard before creating an alert rule.',
      };
    }

    // ── M1: insert-then-verify (atomic plan gate) ──────────────────────────
    const now = new Date();
    const doc = {
      userId:          user._id,
      contractAddress,
      surface:         (owned.surface as string) ?? 'evm',
      eventName:       event,
      channel,
      target,
      active:          true,
      createdAt:       now,
      updatedAt:       now,
    };

    const result = await db.collection('alert_rules').insertOne(doc);

    const ruleCount = await db.collection('alert_rules').countDocuments({
      userId: user._id, contractAddress,
    });
    if (ruleCount > limits.maxRulesPerContract) {
      await db.collection('alert_rules').deleteOne({ _id: result.insertedId });
      return {
        error: `${plan} plan allows ${limits.maxRulesPerContract} rule(s) per contract.`,
      };
    }

    return { success: `Rule saved: alerts for "${event}" → ${channel}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `Error saving rule: ${msg}` };
  }
}

export async function addContractToDashboard(
  address: string,
  surface: string,
): Promise<{ success?: string; error?: string }> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { error: 'You must sign in to add contracts.' };
  }

  const contractAddress = address.trim().toLowerCase();
  if (!contractAddress || !validateAddress(contractAddress)) {
    return { error: 'Invalid contract address.' };
  }
  if (!['evm', 'native', 'alphanet'].includes(surface)) {
    return { error: 'Invalid network.' };
  }

  // Normalize surface to model values
  const normalizedSurface = surface === 'alphanet' ? 'native' : surface;

  try {
    const db = await getDb();
    const plan: Plan = user.plan === 'pro' ? 'pro' : 'free';
    const limit = PLAN_LIMITS[plan].maxContracts;

    const existing = await db.collection('contracts').findOne({
      userId: user._id,
      address: contractAddress,
      surface: normalizedSurface,
    });
    if (existing) {
      return { success: 'Contract is already in your dashboard.' };
    }

    const now = new Date();
    const doc = {
      userId: user._id,
      address: contractAddress,
      surface: normalizedSurface,
      name: contractAddress.slice(0, 10) + '…',
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

    revalidatePath(`/contract/${contractAddress}`);
    return { success: 'Contract successfully added to your dashboard!' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `Error adding contract: ${msg}` };
  }
}

