import type { AlertRule, ContractEvent } from './types.js';

// Alerts — despacha notificaciones cuando una regla dispara. Telegram primero.
export interface AlertDispatcher {
  dispatch(event: ContractEvent, rule: AlertRule): Promise<void>;
}

// Formatea el mensaje de alerta con emoji + datos del evento.
export function formatAlert(event: ContractEvent, rule: AlertRule): string {
  const args = event.args;

  // Formato especial para Transfer ERC-20 (el evento más común en el demo).
  if (event.name === 'Transfer' && args.from && args.to) {
    const val = typeof args.value === 'string'
      ? (BigInt(args.value) / BigInt(10 ** 18)).toString()  // convierte wei→ether aprox.
      : String(args.value ?? '?');
    return [
      `🔔 *Kryndel Alert*`,
      `📄 Contrato: \`${rule.contract.slice(0, 10)}…\``,
      `⚡ Evento: *${event.name}*`,
      `➡️ De: \`${String(args.from).slice(0, 10)}…\``,
      `➡️ A:  \`${String(args.to).slice(0, 10)}…\``,
      `💰 Valor: \`${val}\``,
      event.txHash ? `🔗 Tx: \`${event.txHash.slice(0, 16)}…\`` : '',
    ].filter(Boolean).join('\n');
  }

  // Formato genérico para cualquier otro evento.
  const argsStr = Object.entries(args)
    .slice(0, 4) // máximo 4 args para no saturar el mensaje
    .map(([k, v]) => `  ${k}: \`${String(v).slice(0, 40)}\``)
    .join('\n');

  return [
    `🔔 *Kryndel Alert*`,
    `📄 Contrato: \`${rule.contract.slice(0, 10)}…\``,
    `⚡ Evento: *${event.name}*`,
    argsStr,
    event.txHash ? `🔗 Tx: \`${event.txHash.slice(0, 16)}…\`` : '',
  ].filter(Boolean).join('\n');
}

// Dispatcher de Telegram — usa fetch nativo (Node ≥ 18).
// botToken: valor de TELEGRAM_BOT_TOKEN del entorno.
// La rule.target es el chat_id (número entero o string, p.ej. "123456789").
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
      const text = formatAlert(event, rule).replace(/[*`]/g, '**'); // Markdown → Discord
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
