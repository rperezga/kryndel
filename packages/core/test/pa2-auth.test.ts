/**
 * pa2-auth.test.ts — PA.2: magic link auth helpers, offline.
 *
 * Tests the pure logic that can be validated without a real NextAuth/Resend/MongoDB.
 * - generateToken / hashToken
 * - PLAN_LIMITS channel gating (Free vs Pro)
 * - requireUser throws Response(401) when session is missing
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Stubs ─────────────────────────────────────────────────────────────────────

// Stub MongoDB so model files import without a real connection
vi.mock('@/lib/db', () => ({
  getDb:         vi.fn().mockResolvedValue({ collection: vi.fn() }),
  ensureIndexes: vi.fn().mockResolvedValue(undefined),
}));

// Stub NextAuth so current-user.ts can be imported without real provider config
vi.mock('@/auth', () => ({
  auth:     vi.fn(),
  signIn:   vi.fn(),
  signOut:  vi.fn(),
  handlers: {},
}));

import { generateToken, hashToken } from '@/lib/models/session.js';
import { PLAN_LIMITS }              from '@/lib/models/user.js';

// ── generateToken ─────────────────────────────────────────────────────────────

describe('[PA.2] generateToken', () => {
  it('returns a 64-character hex string', () => {
    expect(generateToken()).toMatch(/^[0-9a-f]{64}$/);
  });

  it('each call returns a different token', () => {
    expect(generateToken()).not.toBe(generateToken());
  });

  it('hash of generated token is also 64-char hex', () => {
    const hash = hashToken(generateToken());
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hash is not the same as the raw token', () => {
    const token = generateToken();
    expect(hashToken(token)).not.toBe(token);
  });
});

// ── Channel gating via PLAN_LIMITS ────────────────────────────────────────────

describe('[PA.2] channel gating — Free plan', () => {
  const { channels } = PLAN_LIMITS.free;

  it('allows telegram', ()        => { expect(channels).toContain('telegram'); });
  it('blocks discord on Free', () => { expect(channels).not.toContain('discord'); });
  it('blocks webhook on Free', () => { expect(channels).not.toContain('webhook'); });
  it('blocks email on Free', ()   => { expect(channels).not.toContain('email'); });
});

describe('[PA.2] channel gating — Pro plan', () => {
  it('allows all four channels', () => {
    for (const ch of ['telegram', 'discord', 'webhook', 'email']) {
      expect(PLAN_LIMITS.pro.channels).toContain(ch);
    }
  });
});

// ── requireUser — 401 when unauthenticated ────────────────────────────────────

describe('[PA.2] requireUser', () => {
  beforeEach(() => { vi.resetModules(); });

  it('throws Response(401) when auth() returns null', async () => {
    const authMod = await import('@/auth');
    vi.mocked(authMod.auth).mockResolvedValue(null as never);

    const { requireUser } = await import('@/lib/current-user.js');

    let caught: unknown;
    try { await requireUser(); } catch (e) { caught = e; }

    expect(caught).toBeInstanceOf(Response);
    expect((caught as Response).status).toBe(401);
  });

  it('throws Response(401) when session has no email', async () => {
    const authMod = await import('@/auth');
    vi.mocked(authMod.auth).mockResolvedValue({ user: {}, expires: '' } as never);

    const { requireUser } = await import('@/lib/current-user.js');

    let caught: unknown;
    try { await requireUser(); } catch (e) { caught = e; }

    expect(caught).toBeInstanceOf(Response);
    expect((caught as Response).status).toBe(401);
  });
});
