import { describe, it, expect, vi } from 'vitest';

// Mock DNS so SSRF assertions in dispatchers don't hit the network.
vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async (host: string) => {
    const t: Record<string, Array<{ address: string; family: number }>> = {
      'hooks.slack.com':           [{ address: '52.85.151.10',  family: 4 }],
      'discord.com':               [{ address: '162.159.135.232', family: 4 }],
    };
    const entry = t[host];
    if (!entry) {
      const err = new Error('ENOTFOUND ' + host) as Error & { code?: string };
      err.code = 'ENOTFOUND';
      throw err;
    }
    return entry;
  }),
}));

import {
  escapeMarkdown,
  escapeMarkdownV2,
  formatAlert,
  validateWebhookTarget,
} from '../src/alerts.js';
import type { ContractEvent, AlertRule } from '../src/types.js';

// ── escapeMarkdownV2 (canonical) ──────────────────────────────────────────────
describe('escapeMarkdownV2 — M3 (AUDIT-PA §M3)', () => {
  it('escapes all 18 Telegram MarkdownV2 special chars', () => {
    // _ * [ ] ( ) ~ ` > # + - = | { } . ! and backslash
    const allSpecials = '_*[]()~`>#+-=|{}.!\\';
    const escaped = escapeMarkdownV2(allSpecials);
    // each special char becomes \<char>
    for (const ch of allSpecials) {
      expect(escaped).toContain('\\' + ch);
    }
  });

  it('escapes parentheses (v1 did NOT)', () => {
    expect(escapeMarkdownV2('(url)')).toBe('\\(url\\)');
  });

  it('escapes period (used in URLs)', () => {
    expect(escapeMarkdownV2('foo.bar')).toBe('foo\\.bar');
  });

  it('neutralizes inline-link injection [t](u)', () => {
    const evil = '*[click](https://evil.com)*';
    const e = escapeMarkdownV2(evil);
    // Bracket, paren, period and asterisk all escaped → no live MarkdownV2
    expect(e).toContain('\\[');
    expect(e).toContain('\\]');
    expect(e).toContain('\\(');
    expect(e).toContain('\\)');
    expect(e).toContain('\\*');
    expect(e).toContain('\\.');
  });

  it('leaves plain text alone', () => {
    expect(escapeMarkdownV2('Transfer')).toBe('Transfer');
    expect(escapeMarkdownV2('0xabcdef')).toBe('0xabcdef');
  });

  it('escapeMarkdown is a v2 alias (back-compat)', () => {
    expect(escapeMarkdown('foo_bar')).toBe(escapeMarkdownV2('foo_bar'));
  });
});

// ── formatAlert ───────────────────────────────────────────────────────────────
describe('formatAlert', () => {
  const rule: AlertRule = {
    id: '1', contract: '0xabc123def', event: 'Transfer',
    channel: 'telegram', target: '999',
  };

  it('Transfer format includes from, to and raw value', () => {
    const ev: ContractEvent = {
      name: 'Transfer',
      args: { from: '0xsender0000', to: '0xreceiver00', value: '1000000000000000000' },
      txHash: '0xdeadbeef0123456789',
    };
    const msg = formatAlert(ev, rule);
    expect(msg).toContain('Transfer');
    expect(msg).toContain('raw');
    expect(msg).toContain('0xsender');
  });

  it('generic format for non-Transfer events', () => {
    const ev: ContractEvent = {
      name: 'Staked',
      args: { amount: '500', user: '0xuser' },
    };
    const msg = formatAlert(ev, rule);
    expect(msg).toContain('Staked');
    expect(msg).toContain('amount');
  });

  it('A2.2 — markdown injection in event name is neutralized', () => {
    const evil: ContractEvent = {
      name: '*[click](https://evil)*',
      args: { to: '0x1', value: '100' },
      contractAddress: '0xabc',
    };
    const r: AlertRule = {
      id: '1', contract: '0xabc', event: evil.name,
      channel: 'telegram', target: '123',
    };
    const msg = formatAlert(evil, r);
    expect(msg).not.toContain('*[click](https://evil)*');
    expect(msg).toContain('\\*\\[click\\]');
  });
});

// ── validateWebhookTarget (sync IP-literal guard) ────────────────────────────
describe('validateWebhookTarget — A2.11 sync guard (back-compat)', () => {
  it('accepts public https://', () => {
    expect(() => validateWebhookTarget('https://hooks.slack.com/T123/B456')).not.toThrow();
    expect(() => validateWebhookTarget('https://discord.com/api/webhooks/123/abc')).not.toThrow();
  });

  it('rejects http://', () => {
    expect(() => validateWebhookTarget('http://example.com/hook')).toThrow('https://');
  });

  it('rejects localhost', () => {
    expect(() => validateWebhookTarget('https://localhost/hook')).toThrow('private');
  });

  it('rejects 127.0.0.1', () => {
    expect(() => validateWebhookTarget('https://127.0.0.1/hook')).toThrow('private');
  });

  it('rejects private 10.x', () => {
    expect(() => validateWebhookTarget('https://10.0.0.1/hook')).toThrow('private');
  });

  it('rejects link-local 169.254.x (AWS/GCP metadata)', () => {
    expect(() => validateWebhookTarget('https://169.254.169.254/latest/meta-data')).toThrow('private');
  });

  it('rejects malformed URL', () => {
    expect(() => validateWebhookTarget('not-a-url')).toThrow('Invalid');
  });
});
