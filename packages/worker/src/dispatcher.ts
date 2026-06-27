/**
 * Alert dispatcher — sends notifications to Telegram (and future channels).
 *
 * Security:
 * - All on-chain data treated as attacker-controlled; sanitized before sending.
 * - Webhook targets validated at dispatch time with assertSafePublicUrl() —
 *   the worker is the actor that actually issues the outbound fetch, so it
 *   gets the final say (defence-in-depth against rules created with an older
 *   guard).  See AUDIT-PA-2026-06-16 §A2.
 * - escapeMarkdownV2() from @kryndel/core used for Telegram messages with
 *   parse_mode 'MarkdownV2' — covers all v2 special chars (§M3).
 */
import type { ContractActivity } from '@kryndel/core/full';
import { escapeMarkdownV2, assertSafePublicUrl } from '@kryndel/core/full';
import type { WAlertRule } from './types.js';
import { getDb } from './db.js';

// ── Telegram ─────────────────────────────────────────────────────────────────

export async function sendTelegram(chatId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn('[dispatcher] TELEGRAM_BOT_TOKEN not set — skipping');
    return;
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: chatId, text, parse_mode: 'MarkdownV2' }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[dispatcher] Telegram error ${res.status}: ${body}`);
  }
}

// ── Webhook ───────────────────────────────────────────────────────────────────

export async function sendWebhook(url: string, payload: Record<string, unknown>): Promise<void> {
  // Final defence — rules may predate the tightened guard.
  await assertSafePublicUrl(url);
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  if (!res.ok) {
    console.error(`[dispatcher] Webhook error ${res.status} for ${url}`);
  }
}

// ── Discord ───────────────────────────────────────────────────────────────────

export async function sendDiscord(webhookUrl: string, content: string): Promise<void> {
  await assertSafePublicUrl(webhookUrl);
  const res = await fetch(webhookUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ content }),
  });
  if (!res.ok) {
    console.error(`[dispatcher] Discord error ${res.status} for ${webhookUrl}`);
  }
}

// ── Format helpers ────────────────────────────────────────────────────────────

function formatActivity(activity: ContractActivity, contract: string): string {
  const addr = escapeMarkdownV2(contract.slice(0, 10));
  if (activity.kind === 'event') {
    const name = escapeMarkdownV2(activity.name ?? 'UnknownEvent');
    const hash = activity.txHash
      ? `\n🔗 Tx: \`${escapeMarkdownV2(activity.txHash.slice(0, 16))}…\``
      : '';
    return `🔔 *Kryndel Alert*\n📄 Contrato: \`${addr}…\`\n⚡ Evento: *${name}*${hash}`;
  }
  const txType = escapeMarkdownV2(activity.txType ?? 'unknown');
  const hash   = activity.txHash
    ? `\n🔗 Tx: \`${escapeMarkdownV2(activity.txHash.slice(0, 16))}…\``
    : '';
  return `🔔 *Kryndel Alert*\n📄 Contrato: \`${addr}…\`\n📞 Call: *${txType}*${hash}`;
}

// ── Arg filter matching ──────────────────────────────────────────────────────
//
// F1: Mirrors matchesRule() in @kryndel/core/subscriber.ts but operates on
// ContractActivity.args (decoded by the pool before dispatch).
// Operators come from the rule doc (user-trusted, closed enum);
// values from the activity are on-chain data (untrusted, used as operand only).

const DISPATCH_OPS = ['$gt', '$lt', '$gte', '$lte', '$eq'] as const;

function matchesWorkerFilter(
  filter: Record<string, unknown>,
  args:   Record<string, unknown>,
): boolean {
  return Object.entries(filter).every(([k, v]) => {
    const actual = args[k];
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      const ops = v as Record<string, unknown>;
      return Object.entries(ops).every(([op, threshold]) => {
        if (!(DISPATCH_OPS as readonly string[]).includes(op)) return false;
        try {
          const a = BigInt(String(actual ?? ''));
          const t = BigInt(String(threshold ?? ''));
          switch (op) {
            case '$gt':  return a > t;
            case '$lt':  return a < t;
            case '$gte': return a >= t;
            case '$lte': return a <= t;
            case '$eq':  return a === t;
          }
        } catch {
          if (op === '$eq') return String(actual).toLowerCase() === String(threshold).toLowerCase();
        }
        return false;
      });
    }
    if (typeof actual === 'string' && typeof v === 'string') {
      return actual.toLowerCase() === v.toLowerCase();
    }
    return actual === v;
  });
}

// ── Main dispatch ─────────────────────────────────────────────────────────────

export async function dispatch(
  activity:  ContractActivity,
  rules:     WAlertRule[],
  contract:  string,
): Promise<void> {
  const matchingRules = rules.filter((r) => {
    if (!r.active) return false;
    if (r.eventName !== '*') {
      const actName = activity.kind === 'event' ? activity.name : activity.txType;
      if (actName !== r.eventName) return false;
    }
    // F1: arg filter (only applied if the activity has decoded args)
    if (r.filter && activity.kind === 'event' && activity.args) {
      if (!matchesWorkerFilter(r.filter, activity.args)) return false;
    }
    return true;
  });

  if (matchingRules.length > 0) {
    try {
      const db = await getDb();
      await db.collection('alert_rules').updateMany(
        { _id: { $in: matchingRules.map((r) => r._id) } },
        { $set: { lastMatchAt: new Date() } }
      );
    } catch (err) {
      console.error('[dispatcher] failed to update lastMatchAt:', err);
    }
  }

  await Promise.allSettled(
    matchingRules.map(async (rule) => {
      try {
        switch (rule.channel) {
          case 'telegram': {
            const msg = formatActivity(activity, contract);
            await sendTelegram(rule.target, msg);
            break;
          }
          case 'webhook': {
            await sendWebhook(rule.target, {
              contract,
              kind:    activity.kind,
              name:    activity.kind === 'event' ? activity.name : activity.txType,
              txHash:  activity.txHash,
              raw:     activity.raw,
            });
            break;
          }
          case 'discord': {
            const msg = formatActivity(activity, contract);
            await sendDiscord(rule.target, msg);
            break;
          }
          case 'email': {
            console.log(`[dispatcher] email channel not yet implemented for rule ${rule._id}`);
            break;
          }
          default:
            console.warn(`[dispatcher] unknown channel: ${(rule as WAlertRule).channel}`);
        }
      } catch (err) {
        console.error(`[dispatcher] failed to dispatch rule ${rule._id}:`, err);
      }
    }),
  );
}
