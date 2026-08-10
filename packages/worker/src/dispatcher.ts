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

// ── Email (Resend HTTP API — no SDK needed) ─────────────────────────────────────

const RESEND_API_KEY   = process.env.RESEND_API_KEY;
const ALERT_EMAIL_FROM = process.env.ALERT_EMAIL_FROM ?? process.env.EMAIL_FROM ?? 'Kryndel Alerts <alerts@kryndel.xyz>';

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn('[dispatcher] RESEND_API_KEY not set — skipping email');
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: ALERT_EMAIL_FROM, to, subject, html }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[dispatcher] Resend email error ${res.status}: ${body}`);
  }
}

/** Escape on-chain (attacker-controlled) strings before embedding in email HTML. */
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c),
  );
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

/** Build a subject + HTML body for an email alert. On-chain strings are escaped. */
function formatActivityEmail(
  activity: ContractActivity,
  contract: string,
): { subject: string; html: string } {
  const rawName = activity.kind === 'event' ? (activity.name ?? 'Event') : (activity.txType ?? 'Call');
  const name    = escapeHtml(rawName);
  const addr    = escapeHtml(contract.slice(0, 12));
  const txHash  = activity.txHash ?? '';
  const txShort = txHash ? escapeHtml(`${txHash.slice(0, 12)}…${txHash.slice(-6)}`) : '';
  const txLink  = txHash ? `https://kryndel.dev/decode/${encodeURIComponent(txHash)}` : '';
  const subject = `Kryndel alert: ${rawName} on ${contract.slice(0, 10)}…`;

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111;">
    <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#16a34a;font-weight:700;">Kryndel Alert</div>
    <h1 style="font-size:22px;margin:8px 0 16px;color:#111;">${name}</h1>
    <table style="width:100%;font-size:14px;border-collapse:collapse;">
      <tr><td style="color:#666;padding:6px 0;">Contract</td><td style="font-family:monospace;text-align:right;color:#111;">${addr}…</td></tr>
      ${txShort ? `<tr><td style="color:#666;padding:6px 0;">Tx</td><td style="font-family:monospace;text-align:right;color:#111;">${txShort}</td></tr>` : ''}
    </table>
    ${txLink ? `<a href="${txLink}" style="display:inline-block;margin-top:18px;background:#16a34a;color:#fff;text-decoration:none;padding:11px 20px;border-radius:6px;font-size:14px;font-weight:600;">View decoded tx →</a>` : ''}
    <p style="font-size:12px;color:#999;margin-top:28px;line-height:1.5;">You're receiving this because you set a Kryndel alert on this contract. Manage your alerts at <a href="https://kryndel.dev/dashboard/rules" style="color:#16a34a;">kryndel.dev</a>.</p>
  </div>`;
  return { subject, html };
}

function formatCustomAlertEmail(message: string): { subject: string; html: string } {
  const subject = message.startsWith('✅')
    ? 'Kryndel alert: contract activity resumed'
    : 'Kryndel alert: contract silence detected';
  const body = escapeHtml(message).replace(/\n/g, '<br>');
  return {
    subject,
    html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111;"><div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#16a34a;font-weight:700;">Kryndel Alert</div><p style="font-size:16px;line-height:1.6;">${body}</p></div>`,
  };
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

export type DispatchRuleKind = 'event' | 'silence';

export function shouldDispatchRule(
  rule: WAlertRule,
  activity: ContractActivity,
  requestedKind: DispatchRuleKind = 'event',
): boolean {
  if (!rule.active) return false;
  if ((rule.kind ?? 'event') !== requestedKind) return false;
  if (requestedKind === 'silence') return true;
  if (rule.eventName !== '*') {
    const activityName = activity.kind === 'event' ? activity.name : activity.txType;
    if (activityName !== rule.eventName) return false;
  }
  if (rule.filter && activity.kind === 'event' && activity.args) {
    if (!matchesWorkerFilter(rule.filter, activity.args)) return false;
  }
  return true;
}

export interface DispatchOptions {
  kind?: DispatchRuleKind;
  message?: string;
}

export async function dispatch(
  activity:  ContractActivity,
  rules:     WAlertRule[],
  contract:  string,
  options:   DispatchOptions = {},
): Promise<void> {
  const requestedKind = options.kind ?? 'event';
  if (requestedKind === 'silence' && !options.message) {
    throw new Error('Silence dispatch requires a message.');
  }
  const matchingRules = rules.filter((rule) => shouldDispatchRule(rule, activity, requestedKind));

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
            const msg = options.message
              ? escapeMarkdownV2(options.message)
              : formatActivity(activity, contract);
            await sendTelegram(rule.target, msg);
            break;
          }
          case 'webhook': {
            await sendWebhook(rule.target, options.message ? {
              contract,
              kind: requestedKind,
              message: options.message,
              ts: new Date().toISOString(),
            } : {
              contract,
              kind:    activity.kind,
              name:    activity.kind === 'event' ? activity.name : activity.txType,
              txHash:  activity.txHash,
              raw:     activity.raw,
            });
            break;
          }
          case 'discord': {
            const msg = options.message ?? formatActivity(activity, contract);
            await sendDiscord(rule.target, msg);
            break;
          }
          case 'email': {
            const { subject, html } = options.message
              ? formatCustomAlertEmail(options.message)
              : formatActivityEmail(activity, contract);
            await sendEmail(rule.target, subject, html);
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
