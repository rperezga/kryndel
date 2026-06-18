/**
 * sdk.test.ts -- PB.6: verifyWebhookSignature + KryndelError + types (offline).
 */
import { describe, it, expect } from 'vitest';
import { createHmac, randomBytes } from 'node:crypto';
import { verifyWebhookSignature, KryndelError } from '../index.js';

// ── verifyWebhookSignature ────────────────────────────────────────────────────

function makeSignature(payload: string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
}

describe('[PB.6] verifyWebhookSignature', () => {
  it('correct signature + fresh timestamp: returns true', () => {
    const secret    = randomBytes(32).toString('hex');
    const payload   = JSON.stringify({ event: 'Transfer', data: {} });
    const timestamp = Date.now();
    const signature = makeSignature(payload, secret);

    expect(verifyWebhookSignature({ payload, signature, secret, timestamp })).toBe(true);
  });

  it('altered payload: returns false', () => {
    const secret    = randomBytes(32).toString('hex');
    const payload   = JSON.stringify({ event: 'Transfer' });
    const timestamp = Date.now();
    const signature = makeSignature(payload, secret);
    const altered   = payload + '!';

    expect(verifyWebhookSignature({ payload: altered, signature, secret, timestamp })).toBe(false);
  });

  it('wrong secret: returns false', () => {
    const secret    = randomBytes(32).toString('hex');
    const badSecret = randomBytes(32).toString('hex');
    const payload   = '{"event":"Transfer"}';
    const timestamp = Date.now();
    const signature = makeSignature(payload, secret);

    expect(verifyWebhookSignature({ payload, signature, secret: badSecret, timestamp })).toBe(false);
  });

  it('old timestamp (>5min): returns false', () => {
    const secret    = randomBytes(32).toString('hex');
    const payload   = '{"event":"Approval"}';
    const timestamp = Date.now() - 6 * 60 * 1000; // 6 minutes ago
    const signature = makeSignature(payload, secret);

    expect(verifyWebhookSignature({ payload, signature, secret, timestamp })).toBe(false);
  });

  it('custom tolerance: within custom window passes', () => {
    const secret      = randomBytes(32).toString('hex');
    const payload     = '{"event":"test"}';
    const timestamp   = Date.now() - 4 * 60 * 1000; // 4 minutes ago
    const signature   = makeSignature(payload, secret);

    // Default 5 min tolerance: should pass
    expect(verifyWebhookSignature({ payload, signature, secret, timestamp, toleranceMs: 5 * 60 * 1000 })).toBe(true);
    // 3 min tolerance: should fail
    expect(verifyWebhookSignature({ payload, signature, secret, timestamp, toleranceMs: 3 * 60 * 1000 })).toBe(false);
  });

  it('Buffer payload works', () => {
    const secret    = randomBytes(32).toString('hex');
    const payload   = '{"event":"Transfer"}';
    const payloadBuf = Buffer.from(payload);
    const timestamp = Date.now();
    const signature = makeSignature(payload, secret);

    expect(verifyWebhookSignature({ payload: payloadBuf, signature, secret, timestamp })).toBe(true);
  });

  it('signature without sha256= prefix: returns false', () => {
    const secret    = randomBytes(32).toString('hex');
    const payload   = '{"event":"test"}';
    const timestamp = Date.now();
    // Missing prefix -- different length, timingSafeEqual throws, caught -> false
    const signature = createHmac('sha256', secret).update(payload).digest('hex');

    expect(verifyWebhookSignature({ payload, signature, secret, timestamp })).toBe(false);
  });

  it('non-finite timestamp: returns false', () => {
    const secret    = randomBytes(32).toString('hex');
    const payload   = '{"event":"test"}';
    const signature = makeSignature(payload, secret);

    expect(verifyWebhookSignature({ payload, signature, secret, timestamp: 'not-a-number' })).toBe(false);
    expect(verifyWebhookSignature({ payload, signature, secret, timestamp: NaN })).toBe(false);
  });
});

// ── KryndelError ──────────────────────────────────────────────────────────────

describe('[PB.6] KryndelError', () => {
  it('constructs with status + message', () => {
    const err = new KryndelError(401, 'Unauthorized');
    expect(err.status).toBe(401);
    expect(err.message).toBe('Unauthorized');
    expect(err.name).toBe('KryndelError');
    expect(err.code).toBeUndefined();
  });

  it('constructs with optional code', () => {
    const err = new KryndelError(403, 'Forbidden', 'PLAN_REQUIRED');
    expect(err.code).toBe('PLAN_REQUIRED');
  });

  it('is instanceof Error', () => {
    const err = new KryndelError(404, 'Not found');
    expect(err instanceof Error).toBe(true);
  });
});
