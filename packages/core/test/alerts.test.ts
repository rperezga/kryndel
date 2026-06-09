import { describe, it, expect } from 'vitest';
import { escapeMarkdown, formatAlert, validateWebhookTarget } from '../src/alerts.js';
import type { ContractEvent, AlertRule } from '../src/types.js';

// ── escapeMarkdown ────────────────────────────────────────────────────────────
describe('escapeMarkdown', () => {
  it('escapa caracteres especiales de Telegram Markdown v1', () => {
    expect(escapeMarkdown('hello_world')).toBe('hello\\_world');
    expect(escapeMarkdown('*bold*')).toBe('\\*bold\\*');
    expect(escapeMarkdown('`code`')).toBe('\\`code\\`');
    expect(escapeMarkdown('[link](url)')).toBe('\\[link\\](url)'); // ] también escapado
  });

  it('no modifica texto sin caracteres especiales', () => {
    expect(escapeMarkdown('Transfer')).toBe('Transfer');
    expect(escapeMarkdown('0xabcdef')).toBe('0xabcdef');
  });

  // A2.2 CA: evento con nombre de inyección produce mensaje inocuo
  it('A2.2 — inyección de Markdown es neutralizada', () => {
    const evil: ContractEvent = {
      name: '*[click](https://evil)*',
      args: { to: '0x1', value: '100' },
      contractAddress: '0xabc',
    };
    const rule: AlertRule = {
      id: '1', contract: '0xabc', event: evil.name,
      channel: 'telegram', target: '123',
    };
    const msg = formatAlert(evil, rule);
    // El mensaje NO debe contener Markdown activo sin escape (el link no debe renderizar)
    expect(msg).not.toMatch(/\*\[click\]\(https:\/\/evil\)\*/);
    // El contenido sí debe aparecer, pero con * y [ y ] escapados
    expect(msg).toContain('\\*\\[click\\]');
  });
});

// ── formatAlert ───────────────────────────────────────────────────────────────
describe('formatAlert', () => {
  const rule: AlertRule = {
    id: '1', contract: '0xabc123def', event: 'Transfer',
    channel: 'telegram', target: '999',
  };

  it('formato Transfer incluye from, to, valor raw', () => {
    const ev: ContractEvent = {
      name: 'Transfer',
      args: { from: '0xsender0000', to: '0xreceiver00', value: '1000000000000000000' },
      txHash: '0xdeadbeef0123456789',
    };
    const msg = formatAlert(ev, rule);
    expect(msg).toContain('Transfer');
    expect(msg).toContain('raw'); // A2.12: muestra valor raw + nota
    expect(msg).toContain('0xsender'); // address parcial
  });

  it('formato genérico para eventos no-Transfer', () => {
    const ev: ContractEvent = {
      name: 'Staked',
      args: { amount: '500', user: '0xuser' },
    };
    const msg = formatAlert(ev, rule);
    expect(msg).toContain('Staked');
    expect(msg).toContain('amount');
  });
});

// ── validateWebhookTarget ────────────────────────────────────────────────────
describe('validateWebhookTarget — A2.11 SSRF prevention', () => {
  it('acepta URLs https:// públicas válidas', () => {
    expect(() => validateWebhookTarget('https://hooks.slack.com/T123/B456')).not.toThrow();
    expect(() => validateWebhookTarget('https://discord.com/api/webhooks/123/abc')).not.toThrow();
  });

  it('rechaza http://', () => {
    expect(() => validateWebhookTarget('http://example.com/hook')).toThrow('https://');
  });

  it('rechaza localhost', () => {
    expect(() => validateWebhookTarget('https://localhost/hook')).toThrow('private');
  });

  it('rechaza 127.0.0.1', () => {
    expect(() => validateWebhookTarget('https://127.0.0.1/hook')).toThrow('private');
  });

  it('rechaza redes privadas 10.x', () => {
    expect(() => validateWebhookTarget('https://10.0.0.1/hook')).toThrow('private');
  });

  it('rechaza link-local 169.254.x (metadata AWS/GCP)', () => {
    expect(() => validateWebhookTarget('https://169.254.169.254/latest/meta-data')).toThrow('private');
  });

  it('rechaza URL malformada', () => {
    expect(() => validateWebhookTarget('not-a-url')).toThrow('Invalid');
  });
});
