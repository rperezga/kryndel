import type { AlertRule, ContractEvent } from './types.js';

// Alerts — despacha notificaciones cuando una regla dispara. Telegram primero.
export interface AlertDispatcher {
  dispatch(event: ContractEvent, rule: AlertRule): Promise<void>;
}

// A2.2: escapa caracteres especiales de Telegram Markdown v1.
// Aplica a TODO dato on-chain (event.name, args, addresses) — son input de atacantes.
export function escapeMarkdown(s: string): string {
  // Telegram MarkdownV1: _ * ` [ ] necesitan escape para evitar inyección.
  return s.replace(/[_*`[\]]/g, '\\$&');
}

// A2.11: valida targets de webhook/discord — SSRF prevention.
// Exige https:// y rechaza IPs privadas / localhost.
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
    /^169\.254\./.test(hostname) // link-local / SSRF via metadata
  ) {
    throw new Error(`Webhook URL targets a private/localhost address: ${hostname}`);
  }
}

// A2.12: muestra valor crudo + nota de decimales en lugar de asumir 18.
function formatValue(raw: unknown): string {
  if (raw === undefined || raw === null) return '?';
  // Devuelve el valor crudo con nota; no asumimos decimales.
  return `${String(raw)} (raw — divide por 10^decimals del contrato)`;
}

// Formatea el mensaje de alerta con emoji + datos del evento.
// Todos los datos on-chain pasan por escapeMarkdown() — son input de atacantes.
export function formatAlert(event: ContractEvent, rule: AlertRule): string {
  const args = event.args;

  // Formato especial para Transfer ERC-20.
  if (event.name === 'Transfer' && args.from && args.to) {
    return [
      `🔔 *Kryndel Alert*`,
      `📄 Contrato: \`${escapeMarkdown(rule.contract.slice(0, 10))}…\``,
      `⚡ Evento: *${escapeMarkdown(event.name)}*`,
      `➡️ De: \`${escapeMarkdown(String(args.from).slice(0, 10))}…\``,
      `➡️ A:  \`${escapeMarkdown(String(args.to).slice(0, 10))}…\``,
      `💰 Valor: \`${escapeMarkdown(formatValue(args.value))}\``,
      event.txHash ? `🔗 Tx: \`${escapeMarkdown(event.txHash.slice(0, 16))}…\`` : '',
    ].filter(Boolean).join('\n');
  }

  // Formato genérico para cualquier otro evento.
  const argsStr = Object.entries(args)
    .slice(0, 4)
    .map(([k, v]) => `  ${escapeMarkdown(k)}: \`${escapeMarkdown(String(v).slice(0, 40))}\``)
    .join('\n');

  return [
    `🔔 *Kryndel Alert*`,
    `📄 Contrato: \`${escapeMarkdown(rule.contract.slice(0, 10))}…\``,
    `⚡ Evento: *${escapeMarkdown(event.name)}*`,
    argsStr,
    event.txHash ? `🔗 Tx: \`${escapeMarkdown(event.txHash.slice(0, 16))}…\`` : '',
  ].filter(Boolean).join('\n');
}

// Dispatcher de Telegram — usa fetch nativo (Node ≥ 18).
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
          parse_mode: 'Markdown',
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
      validateWebhookTarget(rule.target); // A2.11
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
      validateWebhookTarget(rule.target); // A2.11
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
