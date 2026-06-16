/**
 * Alert dispatcher — sends notifications to Telegram (and future channels).
 *
 * Security:
 * - All on-chain data treated as attacker-controlled; sanitized before sending.
 * - Webhook targets validated: must be https:// (SSRF guard).
 * - escapeMarkdown() from @kryndel/core used for Telegram messages.
 */
import type { ContractActivity } from '@kryndel/core';
import { escapeMarkdown, validateWebhookTarget } from '@kryndel/core';
import type { WAlertRule } from './types.js';

// ── Telegram ─────────────────────────────────────────────────────────────────

async function sendTelegram(chatId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn('[dispatcher] TELEGRAM_BOT_TOKEN not set — skipping');
    return;
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[dispatcher] Telegram error ${res.status}: ${body}`);
  }
}

// ── Webhook ───────────────────────────────────────────────────────────────────

async function sendWebhook(url: string, payload: Record<string, unknown>): Promise<void> {
  // Validate before every send — rule may have been created before guard was tightened.
  validateWebhookTarget(url); // throws on invalid
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

async function sendDiscord(webhookUrl: string, content: string): Promise<void> {
  validateWebhookTarget(webhookUrl);
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
  const addr = escapeMarkdown(contract.slice(0, 10));
  if (activity.kind === 'event') {
    const name = escapeMarkdown(activity.name ?? 'UnknownEvent');
    const hash = activity.txHash ? `\n🔗 Tx: \`${escapeMarkdown(activity.txHash.slice(0, 16))}…\`` : '';
    return `🔔 *Kryndel Alert*\n📄 Contrato: \`${addr}…\`\n⚡ Evento: *${name}*${hash}`;
  }
  // kind === 'call'
  const txType = escapeMarkdown(activity.txType ?? 'unknown');
  const hash   = activity.txHash ? `\n🔗 Tx: \`${escapeMarkdown(activity.txHash.slice(0, 16))}…\`` : '';
  return `🔔 *Kryndel Alert*\n📄 Contrato: \`${addr}…\`\n📞 Call: *${txType}*${hash}`;
}

// ── Main dispatch ─────────────────────────────────────────────────────────────

/**
 * Dispatch an activity to all matching active rules.
 * Rules are already filtered by contract address and surface at reconcile time.
 */
export async function dispatch(
  activity:  ContractActivity,
  rules:     WAlertRule[],
  contract:  string,
): Promise<void> {
  const matchingRules = rules.filter((r) => {
    if (!r.active) return false;
    // eventName '*' matches any; otherwise must match activity name/txType
    if (r.eventName !== '*') {
      const actName = activity.kind === 'event' ? activity.name : activity.txType;
      if (actName !== r.eventName) return false;
    }
    return true;
  });

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
            // PA-billing: Resend email dispatch — deferred to PA-billing session.
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
