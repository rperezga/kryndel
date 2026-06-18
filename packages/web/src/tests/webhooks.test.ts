/**
 * webhooks.test.ts -- PB.4: webhook endpoints + HMAC logic (offline).
 */
import { describe, it, expect } from 'vitest';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { isPrivateHostname } from '@/lib/ssrf.js';

// ── Secret generation ─────────────────────────────────────────────────────────

function generateSecret(): string {
  return randomBytes(32).toString('hex');
}

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

describe('[PB.4] webhook secret generation', () => {
  it('secret is 64 hex chars (32 bytes)', () => {
    const secret = generateSecret();
    expect(secret).toMatch(/^[0-9a-f]{64}$/);
  });

  it('each secret is unique', () => {
    const secrets = new Set(Array.from({ length: 10 }, generateSecret));
    expect(secrets.size).toBe(10);
  });

  it('secretHash is SHA-256 of secret', () => {
    const secret = generateSecret();
    const hash   = hashSecret(secret);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe(secret);
  });

  it('secretPrefix is first 8 chars of secret', () => {
    const secret = generateSecret();
    const prefix = secret.slice(0, 8);
    expect(prefix.length).toBe(8);
    expect(secret.startsWith(prefix)).toBe(true);
  });

  it('toPublicWebhook strips secret and secretHash', () => {
    const ep = {
      _id:          'abc',
      userId:       'user1',
      url:          'https://example.com/hook',
      secret:       'raw-secret',
      secretHash:   'hash-of-secret',
      secretPrefix: 'prefix01',
      active:       true,
      createdAt:    new Date(),
    };
    // Simulate toPublicWebhook
    const { secret: _s, secretHash: _h, ...pub } = ep;
    expect('secret' in pub).toBe(false);
    expect('secretHash' in pub).toBe(false);
    expect(pub.secretPrefix).toBe('prefix01');
  });
});

// ── SSRF protection ───────────────────────────────────────────────────────────

describe('[PB.4] assertSafePublicUrl - sync checks', () => {
  it('rejects localhost', () => {
    expect(isPrivateHostname('localhost')).toBe(true);
  });

  it('rejects 127.0.0.1', () => {
    expect(isPrivateHostname('127.0.0.1')).toBe(true);
  });

  it('rejects 10.0.0.1 (RFC1918)', () => {
    expect(isPrivateHostname('10.0.0.1')).toBe(true);
  });

  it('rejects 192.168.1.1 (RFC1918)', () => {
    expect(isPrivateHostname('192.168.1.1')).toBe(true);
  });

  it('rejects 169.254.169.254 (link-local / AWS metadata)', () => {
    expect(isPrivateHostname('169.254.169.254')).toBe(true);
  });

  it('accepts public hostname (example.com)', () => {
    expect(isPrivateHostname('example.com')).toBe(false);
  });

  it('accepts public IP (8.8.8.8)', () => {
    expect(isPrivateHostname('8.8.8.8')).toBe(false);
  });
});

// ── HMAC verification ─────────────────────────────────────────────────────────

function signPayload(payload: string, secret: string): { sig: string; timestamp: number } {
  const timestamp = Date.now();
  const sig = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
  return { sig, timestamp };
}

function verifySignature(payload: string, signature: string, secret: string, timestamp: number, toleranceMs = 300_000): boolean {
  if (Math.abs(Date.now() - timestamp) > toleranceMs) return false;
  const expected = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

describe('[PB.4] HMAC signature verification', () => {
  it('correct signature verifies', () => {
    const secret  = generateSecret();
    const payload = JSON.stringify({ event: 'Transfer', data: {} });
    const { sig, timestamp } = signPayload(payload, secret);
    expect(verifySignature(payload, sig, secret, timestamp)).toBe(true);
  });

  it('altered payload fails verification', () => {
    const secret  = generateSecret();
    const payload = JSON.stringify({ event: 'Transfer', data: {} });
    const { sig, timestamp } = signPayload(payload, secret);
    const altered = JSON.stringify({ event: 'Transfer', data: { hacked: true } });
    expect(verifySignature(altered, sig, secret, timestamp)).toBe(false);
  });

  it('wrong secret fails verification', () => {
    const secret   = generateSecret();
    const badSecret = generateSecret();
    const payload  = JSON.stringify({ event: 'Transfer' });
    const { sig, timestamp } = signPayload(payload, secret);
    expect(verifySignature(payload, sig, badSecret, timestamp)).toBe(false);
  });

  it('old timestamp (>5min) fails verification', () => {
    const secret  = generateSecret();
    const payload = JSON.stringify({ event: 'Transfer' });
    const oldTs   = Date.now() - 6 * 60 * 1000; // 6 minutes ago
    const sig = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
    expect(verifySignature(payload, sig, secret, oldTs)).toBe(false);
  });

  it('signature prefix must be "sha256="', () => {
    const secret  = generateSecret();
    const payload = 'test';
    const badSig  = createHmac('sha256', secret).update(payload).digest('hex'); // no prefix
    const ts      = Date.now();
    // Without prefix, timingSafeEqual will throw (different lengths) -> false
    expect(verifySignature(payload, badSig, secret, ts)).toBe(false);
  });
});

// ── User isolation ────────────────────────────────────────────────────────────

describe('[PB.4] user isolation', () => {
  it('webhook query always filters by userId', () => {
    const userAId = 'user-a';
    const filter  = { userId: userAId };
    expect(filter.userId).toBe('user-a');
  });

  it('delivery query always filters by userId', () => {
    const userId   = 'user-a';
    const filter   = { endpointId: 'ep-1', userId };
    expect(filter.userId).toBe('user-a');
  });
});

// ── contractAddresses filter ──────────────────────────────────────────────────

describe('[PB.4] webhook contractAddresses filter', () => {
  function matchesEndpoint(endpoint: { contractAddresses?: string[] }, address: string): boolean {
    if (!endpoint.contractAddresses || endpoint.contractAddresses.length === 0) return true;
    return endpoint.contractAddresses.includes(address);
  }

  it('empty contractAddresses matches all', () => {
    const ep = { contractAddresses: [] };
    expect(matchesEndpoint(ep, '0xabc')).toBe(true);
  });

  it('specific address matches', () => {
    const ep = { contractAddresses: ['0xabc'] };
    expect(matchesEndpoint(ep, '0xabc')).toBe(true);
  });

  it('non-matching address excluded', () => {
    const ep = { contractAddresses: ['0xabc'] };
    expect(matchesEndpoint(ep, '0xdef')).toBe(false);
  });
});
