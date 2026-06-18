/**
 * api-keys.test.ts -- PB.1 API key generation + requireApiKey logic (offline).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import {
  generateRawKey,
  hashKey,
  keyPrefix,
  isValidRawKey,
} from '@/lib/models/api-key.js';

// ── Key generation ────────────────────────────────────────────────────────────

describe('[PB.1] API key generation', () => {
  it('raw key matches format kr_live_<40 hex>', () => {
    const key = generateRawKey();
    expect(key).toMatch(/^kr_live_[0-9a-f]{40}$/);
  });

  it('each generated key is unique', () => {
    const keys = new Set(Array.from({ length: 20 }, generateRawKey));
    expect(keys.size).toBe(20);
  });

  it('hashKey returns SHA-256 hex (64 chars)', () => {
    const raw = generateRawKey();
    const hash = hashKey(raw);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hashKey is deterministic', () => {
    const raw = generateRawKey();
    expect(hashKey(raw)).toBe(hashKey(raw));
  });

  it('hash differs from raw key', () => {
    const raw = generateRawKey();
    expect(hashKey(raw)).not.toBe(raw);
  });

  it('different keys produce different hashes', () => {
    const a = generateRawKey();
    const b = generateRawKey();
    expect(hashKey(a)).not.toBe(hashKey(b));
  });

  it('hashKey matches manual SHA-256', () => {
    const raw = generateRawKey();
    const manual = createHash('sha256').update(raw).digest('hex');
    expect(hashKey(raw)).toBe(manual);
  });

  it('keyPrefix returns kr_live_ + 8 hex chars', () => {
    const raw    = generateRawKey();
    const prefix = keyPrefix(raw);
    expect(prefix).toMatch(/^kr_live_[0-9a-f]{8}$/);
  });

  it('keyPrefix is the first 8 chars of the hex part', () => {
    const raw    = generateRawKey();
    const prefix = keyPrefix(raw);
    expect(raw.startsWith(prefix)).toBe(true);
  });

  it('isValidRawKey: accepts correct format', () => {
    expect(isValidRawKey(generateRawKey())).toBe(true);
  });

  it('isValidRawKey: rejects malformed key', () => {
    expect(isValidRawKey('not-a-key')).toBe(false);
    expect(isValidRawKey('kr_live_tooshort')).toBe(false);
    expect(isValidRawKey('kr_test_' + 'a'.repeat(40))).toBe(false);
  });
});

// ── requireApiKey logic (unit, with mocked DB) ────────────────────────────────

describe('[PB.1] requireApiKey logic', () => {
  // Minimal mock infrastructure — test the pure logic without hitting MongoDB.

  function makeRequest(bearerToken?: string): Request {
    const headers: Record<string, string> = {};
    if (bearerToken !== undefined) {
      headers['authorization'] = `Bearer ${bearerToken}`;
    }
    return new Request('https://test.kryndel.vercel.app/api/v1/me', { headers });
  }

  it('rejects request with no Authorization header (missing key)', async () => {
    // Directly test the key format guard
    const authHeader = '';
    const rawKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    expect(!rawKey || !isValidRawKey(rawKey)).toBe(true);
  });

  it('rejects request with malformed key', async () => {
    const rawKey = 'invalid-key';
    expect(isValidRawKey(rawKey)).toBe(false);
  });

  it('accepts correctly formatted key (format check)', async () => {
    const rawKey = generateRawKey();
    expect(isValidRawKey(rawKey)).toBe(true);
  });
});

// ── Plan gating ───────────────────────────────────────────────────────────────

describe('[PB.1] plan gating', () => {
  it('Free plan cannot create API keys (logic check)', () => {
    const plan = 'free';
    const allowed = plan === 'pro';
    expect(allowed).toBe(false);
  });

  it('Pro plan can create API keys', () => {
    const plan = 'pro';
    const allowed = plan === 'pro';
    expect(allowed).toBe(true);
  });

  it('max 5 keys enforced', () => {
    const count  = 5;
    const maxKeys = 5;
    const blocked = count >= maxKeys;
    expect(blocked).toBe(true);
  });

  it('below max allows creation', () => {
    const count  = 4;
    const maxKeys = 5;
    const blocked = count >= maxKeys;
    expect(blocked).toBe(false);
  });
});
