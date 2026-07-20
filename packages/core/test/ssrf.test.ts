/**
 * ssrf.test.ts — A2 SSRF guard
 *
 * Validates the shared isSafePublicUrl helper used at both create-time
 * (api/rules, Server Action) and dispatch-time (worker).
 */
import { describe, it, expect, vi } from 'vitest';

// Mock node:dns/promises BEFORE importing ssrf.ts. Vitest hoists vi.mock.
vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async (host: string) => {
    const TABLE: Record<string, Array<{ address: string; family: number }> | null> = {
      'evil-private.example':     [{ address: '10.0.0.5',         family: 4 }],
      'evil-metadata.example':    [{ address: '169.254.169.254',  family: 4 }],
      'evil-rebind.example':      [{ address: '127.0.0.1',        family: 4 }],
      'hooks.slack.com':          [{ address: '52.85.151.10',     family: 4 }],
      'discord.com':              [{ address: '162.159.135.232',  family: 4 }],
      'api.kryndel.xyz':          [{ address: '76.76.21.21',      family: 4 }],
      'dns-error.example':        null, // sentinel → throw below
    };
    const entry = TABLE[host];
    if (entry === undefined) {
      // No record — simulate ENOTFOUND
      const err = new Error('getaddrinfo ENOTFOUND ' + host) as Error & { code?: string };
      err.code = 'ENOTFOUND';
      throw err;
    }
    if (entry === null) {
      const err = new Error('getaddrinfo ESERVFAIL ' + host) as Error & { code?: string };
      err.code = 'ESERVFAIL';
      throw err;
    }
    return entry;
  }),
}));

import {
  isPrivateIp,
  isPrivateHostname,
  isSafePublicUrl,
  assertSafePublicUrl,
} from '../src/ssrf.js';

// ── isPrivateIp ───────────────────────────────────────────────────────────────

describe('[A2] isPrivateIp', () => {
  it('IPv4 loopback', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('127.255.255.254')).toBe(true);
  });
  it('IPv4 RFC1918', () => {
    expect(isPrivateIp('10.0.0.1')).toBe(true);
    expect(isPrivateIp('192.168.1.5')).toBe(true);
    expect(isPrivateIp('172.16.0.1')).toBe(true);
    expect(isPrivateIp('172.31.255.255')).toBe(true);
  });
  it('IPv4 link-local (incl. cloud metadata)', () => {
    expect(isPrivateIp('169.254.169.254')).toBe(true);
    expect(isPrivateIp('169.254.0.1')).toBe(true);
  });
  it('IPv4 0.0.0.0/8', () => {
    expect(isPrivateIp('0.0.0.0')).toBe(true);
  });
  it('IPv6 loopback / unspecified', () => {
    expect(isPrivateIp('::1')).toBe(true);
    expect(isPrivateIp('::')).toBe(true);
  });
  it('IPv6 unique-local fc00::/7', () => {
    expect(isPrivateIp('fc00::1')).toBe(true);
    expect(isPrivateIp('fd00:1234::1')).toBe(true);
  });
  it('IPv6 link-local fe80::/10', () => {
    expect(isPrivateIp('fe80::1')).toBe(true);
  });
  it('accepts public IPv4', () => {
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('52.85.151.10')).toBe(false);
    expect(isPrivateIp('171.255.255.255')).toBe(false);
    expect(isPrivateIp('172.32.0.0')).toBe(false);
  });
  it('accepts public IPv6', () => {
    expect(isPrivateIp('2001:db8::1')).toBe(false);
    expect(isPrivateIp('2606:4700::1')).toBe(false);
  });
});

// ── isPrivateHostname ────────────────────────────────────────────────────────

describe('[A2] isPrivateHostname (sync, no DNS)', () => {
  it('blocks localhost', () => {
    expect(isPrivateHostname('localhost')).toBe(true);
    expect(isPrivateHostname('LOCALHOST')).toBe(true);
    expect(isPrivateHostname('foo.localhost')).toBe(true);
  });
  it('blocks IP literals in private ranges', () => {
    expect(isPrivateHostname('127.0.0.1')).toBe(true);
    expect(isPrivateHostname('10.0.0.1')).toBe(true);
    expect(isPrivateHostname('169.254.169.254')).toBe(true);
    expect(isPrivateHostname('::1')).toBe(true);
    expect(isPrivateHostname('[::1]')).toBe(true);
  });
  it('passes through public hostnames', () => {
    expect(isPrivateHostname('hooks.slack.com')).toBe(false);
    expect(isPrivateHostname('discord.com')).toBe(false);
  });
});

// ── isSafePublicUrl ──────────────────────────────────────────────────────────

describe('[A2] isSafePublicUrl', () => {
  it('rejects malformed URL', async () => {
    expect((await isSafePublicUrl('not-a-url')).ok).toBe(false);
  });

  it('rejects non-https schemes', async () => {
    expect((await isSafePublicUrl('http://example.com')).ok).toBe(false);
    expect((await isSafePublicUrl('ftp://example.com')).ok).toBe(false);
    expect((await isSafePublicUrl('file:///etc/passwd')).ok).toBe(false);
    expect((await isSafePublicUrl('javascript:alert(1)')).ok).toBe(false);
  });

  it('rejects literal loopback / private IPs in URL', async () => {
    expect((await isSafePublicUrl('https://127.0.0.1/hook')).ok).toBe(false);
    expect((await isSafePublicUrl('https://10.0.0.1/hook')).ok).toBe(false);
    expect((await isSafePublicUrl('https://192.168.1.1/hook')).ok).toBe(false);
    expect((await isSafePublicUrl('https://[::1]/hook')).ok).toBe(false);
  });

  it('rejects the AWS/GCP metadata endpoint', async () => {
    const r = await isSafePublicUrl('https://169.254.169.254/latest/meta-data');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/private|loopback/i);
  });

  it('rejects localhost hostname', async () => {
    expect((await isSafePublicUrl('https://localhost/hook')).ok).toBe(false);
  });

  it('rejects DNS rebinding (hostname resolving to private IP)', async () => {
    const r = await isSafePublicUrl('https://evil-private.example/hook');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/private IP/i);
  });

  it('rejects DNS rebinding to metadata IP', async () => {
    const r = await isSafePublicUrl('https://evil-metadata.example/');
    expect(r.ok).toBe(false);
  });

  it('rejects hostname that resolves to loopback', async () => {
    const r = await isSafePublicUrl('https://evil-rebind.example/');
    expect(r.ok).toBe(false);
  });

  it('fail-closed on DNS error', async () => {
    const r = await isSafePublicUrl('https://dns-error.example/hook');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/DNS lookup failed/);
  });

  it('accepts safe https:// URL with public DNS', async () => {
    expect((await isSafePublicUrl('https://hooks.slack.com/abc')).ok).toBe(true);
    expect((await isSafePublicUrl('https://discord.com/api/webhooks/x/y')).ok).toBe(true);
  });
});

// ── assertSafePublicUrl ──────────────────────────────────────────────────────

describe('[A2] assertSafePublicUrl', () => {
  it('throws on unsafe URL', async () => {
    await expect(assertSafePublicUrl('https://127.0.0.1/x')).rejects.toThrow(/private|loopback/i);
    await expect(assertSafePublicUrl('http://foo.com')).rejects.toThrow(/https/);
  });

  it('resolves on safe URL', async () => {
    await expect(assertSafePublicUrl('https://hooks.slack.com/x')).resolves.toBeUndefined();
  });
});
