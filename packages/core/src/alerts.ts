import type { AlertRule, ContractEvent } from './types.js';
import { assertSafePublicUrl } from './ssrf.js';

// Alerts — despacha notificaciones cuando una regla dispara. Telegram primero.
export interface AlertDispatcher {
  dispatch(event: ContractEvent, rule: AlertRule): Promise<void>;
}

// ── escapeMarkdownV2 — full Telegram MarkdownV2 escape ──────────────────────
//
// Telegram MarkdownV2 (https://core.telegram.org/bots/api#markdownv2-style)
// requires escaping ALL of these in body text:
//   _ * [ ] ( ) ~ ` > # + - = | { } . !
// Plus literal backslash.
//
// M3 (AUDIT-PA-2026-06-16): the old v1 version only covered `_ * \` [ ]`,
// leaving `()` `~` `>` `#` `+` `-` `=` `|` `{}` `.` `!` exploitable for
// visual phishing via inline links `[text](url)`. v2 closes that.
export function escapeMarkdownV2(s: string): string {
  return s.replace(/[\\_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

// Back-compat alias. The CLI dispatcher uses parse_mode MarkdownV2 too now,
// so this is just the same function under both names.
export const escapeMarkdown = escapeMarkdownV2;

// A2.11 / AUDIT-PA §A2 — sync IP-literal check (no DNS). Kept for callers
// that need a synchronous guard (legacy CLI tests). For dispatch-time fetch
// sites use `assertSafePublicUrl` (async, includes DNS resolution).
export function validateWebhookTarget(target: string): void {
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    throw new Error(`Invalid webhook URL: ${target}`);
  }
  if (url.protocol !== 'https:') {
    throw new Error(`Webhook URL must use https://, got: ${url.protocol}`);
  }
  const hostname = url.hostname;
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^169\.254\./.test(hostname)
  ) {
    throw new Error(`Webhook URL targets a private/localhost address: ${hostname}`);
  }
}

// A2.12: muestra valor crudo + nota de decimales en lugar de asumir 18.
function formatValue(raw: unknown): string {
  if (raw === undefined || raw === null) return '?';
  return `${String(raw)} (raw — divide por 10^decimals del contrato)`;
}

// Formatea el mensaje de alerta con emoji + datos del evento.
// Todos los datos on-chain pasan por escapeMarkdownV2() — son input de atacantes.
export function formatAlert(event: ContractEvent, rule: AlertRule): string {
  const args = event.args;

  if (event.name === 'Transfer' && args.from && args.to) {
    return [
      `🔔 *Kryndel Alert*`,
      `📄 Contrato: \`${escapeMarkdownV2(rule.contract.slice(0, 10))}…\``,
      `⚡ Evento: *${escapeMarkdownV2(event.name)}*`,
      `➡️ De: \`${escapeMarkdownV2(String(args.from).slice(0, 10))}…\``,
      `➡️ A:  \`${escapeMarkdownV2(String(args.to).slice(0, 10))}…\``,
      `💰 Valor: \`${escapeMarkdownV2(formatValue(args.value))}\``,
      event.txHash ? `🔗 Tx: \`${escapeMarkdownV2(event.txHash.slice(0, 16))}…\`` : '',
    ].filter(Boolean).join('\n');
  }

  const argsStr = Object.entries(args)
    .slice(0, 4)
    .map(([k, v]) => `  ${escapeMarkdownV2(k)}: \`${escapeMarkdownV2(String(v).slice(0, 40))}\``)
    .join('\n');

  return [
    `🔔 *Kryndel Alert*`,
    `📄 Contrato: \`${escapeMarkdownV2(rule.contract.slice(0, 10))}…\``,
    `⚡ Evento: *${escapeMarkdownV2(event.name)}*`,
    argsStr,
    event.txHash ? `🔗 Tx: \`${escapeMarkdownV2(event.txHash.slice(0, 16))}…\`` : '',
  ].filter(Boolean).join('\n');
}

// Dispatcher de Telegram — usa fetch nativo (Node ≥ 18) y MarkdownV2 (M3).
export function createTelegramDispatcher(botToken: string): AlertDispatcher {
  const base = `https://api.telegram.org/bot${botToken}`;

  return {
    async dispatch(event: ContractEvent, rule: AlertRule): Promise<void> {
      const text = formatAlert(event, rule);

      const res = await fetch(`${base}/sendMessage`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id:    rule.target,
          text,
          parse_mode: 'MarkdownV2',
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Telegram API error ${res.status}: ${body}`);
      }
    },
  };
}

// Dispatcher de Discord — usa un webhook URL en rule.target.
export function createDiscordDispatcher(): AlertDispatcher {
  return {
    async dispatch(event: ContractEvent, rule: AlertRule): Promise<void> {
      // A2 / AUDIT-PA §A2: defence-in-depth at dispatch (DNS-aware).
      await assertSafePublicUrl(rule.target);
      const text = formatAlert(event, rule).replace(/[*`]/g, '**');
      const res = await fetch(rule.target, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) throw new Error(`Discord webhook error ${res.status}`);
    },
  };
}

// Dispatcher genérico por webhook (POST JSON).
export function createWebhookDispatcher(): AlertDispatcher {
  return {
    async dispatch(event: ContractEvent, rule: AlertRule): Promise<void> {
      // A2 / AUDIT-PA §A2: defence-in-depth at dispatch (DNS-aware).
      await assertSafePublicUrl(rule.target);
      const res = await fetch(rule.target, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, rule, ts: Date.now() }),
      });
      if (!res.ok) throw new Error(`Webhook error ${res.status}`);
    },
  };
}

// Factory — elige el dispatcher correcto según el canal de la regla.
export function createDispatcher(channel: string, botToken?: string): AlertDispatcher {
  if (channel === 'telegram') {
    if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN no definido en .env');
    return createTelegramDispatcher(botToken);
  }
  if (channel === 'discord') return createDiscordDispatcher();
  return createWebhookDispatcher();
}
