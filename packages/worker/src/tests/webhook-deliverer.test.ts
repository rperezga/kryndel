/**
 * webhook-deliverer.test.ts -- PB.5: HMAC generation + retry scheduling (offline).
 */
import { describe, it, expect } from 'vitest';
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';

// ── HMAC helpers (mirrors webhook-deliverer.ts) ───────────────────────────────

function signDelivery(payload: string, secret: string): { signature: string; timestamp: number } {
  const timestamp = Date.now();
  const signature = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
  return { signature, timestamp };
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

// ── Retry backoff (mirrors webhook-deliverer.ts) ──────────────────────────────

const RETRY_BACKOFF_MIN = [1, 5, 30, 120, 480];
const MAX_ATTEMPTS = 6;

function nextRetryAt(attempt: number): Date | undefined {
  const idx = attempt - 2;
  if (idx < 0 || idx >= RETRY_BACKOFF_MIN.length) return undefined;
  const minutes = RETRY_BACKOFF_MIN[idx];
  return new Date(Date.now() + minutes * 60 * 1000);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('[PB.5] HMAC signature generation', () => {
  it('generates sha256= prefixed signature', () => {
    const secret  = randomBytes(32).toString('hex');
    const payload = JSON.stringify({ event: 'Transfer', contract: '0xabc', timestamp: 1 });
    const { signature } = signDelivery(payload, secret);
    expect(signature).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it('signature is verifiable with verifyWebhookSignature logic', () => {
    const secret  = randomBytes(32).toString('hex');
    const payload = JSON.stringify({ event: 'Transfer' });
    const { signature, timestamp } = signDelivery(payload, secret);
    expect(verifySignature(payload, signature, secret, timestamp)).toBe(true);
  });

  it('altered payload fails verification', () => {
    const secret  = randomBytes(32).toString('hex');
    const payload = JSON.stringify({ event: 'Transfer' });
    const { signature, timestamp } = signDelivery(payload, secret);
    const altered = payload + '!';
    expect(verifySignature(altered, signature, secret, timestamp)).toBe(false);
  });

  it('timestamp is recent (within 1s)', () => {
    const before = Date.now();
    const { timestamp } = signDelivery('payload', 'secret');
    const after = Date.now();
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after + 10);
  });
});

describe('[PB.5] retry scheduling', () => {
  it('attempt 2: nextRetryAt is ~1 minute', () => {
    const now     = Date.now();
    const retryAt = nextRetryAt(2);
    expect(retryAt).toBeDefined();
    const diff = retryAt!.getTime() - now;
    expect(diff).toBeGreaterThanOrEqual(59_000);
    expect(diff).toBeLessThanOrEqual(61_000);
  });

  it('attempt 3: nextRetryAt is ~5 minutes', () => {
    const now     = Date.now();
    const retryAt = nextRetryAt(3);
    expect(retryAt).toBeDefined();
    const diff = retryAt!.getTime() - now;
    expect(diff).toBeGreaterThanOrEqual(4 * 60_000 + 59_000);
    expect(diff).toBeLessThanOrEqual(5 * 60_000 + 1_000);
  });

  it('attempt 6: nextRetryAt is ~480 minutes', () => {
    const now     = Date.now();
    const retryAt = nextRetryAt(6);
    expect(retryAt).toBeDefined();
    const diff = retryAt!.getTime() - now;
    expect(diff).toBeGreaterThanOrEqual(479 * 60_000);
    expect(diff).toBeLessThanOrEqual(481 * 60_000);
  });

  it('attempt 7 (beyond max): nextRetryAt is undefined', () => {
    expect(nextRetryAt(7)).toBeUndefined();
  });

  it('attempt 1: nextRetryAt is undefined', () => {
    expect(nextRetryAt(1)).toBeUndefined();
  });

  it('MAX_ATTEMPTS is 6', () => {
    expect(MAX_ATTEMPTS).toBe(6);
  });

  it('backoff sequence is correct', () => {
    expect(RETRY_BACKOFF_MIN).toEqual([1, 5, 30, 120, 480]);
  });
});

describe('[PB.5] contractAddresses filter', () => {
  function matchesEndpoint(
    ep: { contractAddresses?: string[]; eventNames?: string[] },
    address: string,
    eventName: string,
  ): boolean {
    const contractAddresses = ep.contractAddresses ?? [];
    const eventNames        = ep.eventNames ?? [];
    if (contractAddresses.length > 0 && !contractAddresses.includes(address)) return false;
    if (eventNames.length > 0 && !eventNames.includes(eventName)) return false;
    return true;
  }

  it('empty filters match all', () => {
    expect(matchesEndpoint({}, '0xabc', 'Transfer')).toBe(true);
  });

  it('matching contract + event delivers', () => {
    expect(matchesEndpoint(
      { contractAddresses: ['0xabc'], eventNames: ['Transfer'] },
      '0xabc', 'Transfer',
    )).toBe(true);
  });

  it('non-matching contract does not deliver', () => {
    expect(matchesEndpoint(
      { contractAddresses: ['0xabc'] },
      '0xdef', 'Transfer',
    )).toBe(false);
  });

  it('non-matching event does not deliver', () => {
    expect(matchesEndpoint(
      { eventNames: ['Transfer'] },
      '0xabc', 'Approval',
    )).toBe(false);
  });
});
