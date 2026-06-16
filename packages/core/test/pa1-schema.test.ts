/**
 * pa1-schema.test.ts — PA.1: DB schema types, plan limits, session helpers.
 *
 * Fully offline — no MongoDB connection. Tests the pure logic in the model files.
 * We import directly from the source because these helpers have no side effects.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Stub the db module so model files can be imported without a real MONGODB_URI ─
vi.mock('../../web/src/lib/db.js', () => ({
  getDb: vi.fn().mockResolvedValue({}),
  ensureIndexes: vi.fn().mockResolvedValue(undefined),
}));

import {
  PLAN_LIMITS,
  historyCutoff,
} from '../../web/src/lib/models/user.js';

import {
  hashToken,
  SESSION_TTL_MS,
} from '../../web/src/lib/models/session.js';

// ── PLAN_LIMITS ────────────────────────────────────────────────────────────────

describe('[PA.1] PLAN_LIMITS — Free tier', () => {
  it('maxContracts is 3', () => {
    expect(PLAN_LIMITS.free.maxContracts).toBe(3);
  });
  it('maxRulesPerContract is 1', () => {
    expect(PLAN_LIMITS.free.maxRulesPerContract).toBe(1);
  });
  it('historyDays is 7', () => {
    expect(PLAN_LIMITS.free.historyDays).toBe(7);
  });
  it('channels includes only telegram', () => {
    expect(PLAN_LIMITS.free.channels).toEqual(['telegram']);
  });
});

describe('[PA.1] PLAN_LIMITS — Pro tier', () => {
  it('maxContracts is 20', () => {
    expect(PLAN_LIMITS.pro.maxContracts).toBe(20);
  });
  it('maxRulesPerContract is 10', () => {
    expect(PLAN_LIMITS.pro.maxRulesPerContract).toBe(10);
  });
  it('historyDays is 90', () => {
    expect(PLAN_LIMITS.pro.historyDays).toBe(90);
  });
  it('channels includes telegram, discord, webhook, email', () => {
    const ch = PLAN_LIMITS.pro.channels;
    expect(ch).toContain('telegram');
    expect(ch).toContain('discord');
    expect(ch).toContain('webhook');
    expect(ch).toContain('email');
  });
});

// ── historyCutoff ─────────────────────────────────────────────────────────────

describe('[PA.1] historyCutoff', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('Free: cutoff is ~7 days ago', () => {
    const now = new Date('2026-06-16T12:00:00Z');
    vi.setSystemTime(now);
    const cutoff = historyCutoff('free');
    const diffDays = (now.getTime() - cutoff.getTime()) / (24 * 60 * 60 * 1_000);
    expect(diffDays).toBeCloseTo(7, 5);
  });

  it('Pro: cutoff is ~90 days ago', () => {
    const now = new Date('2026-06-16T12:00:00Z');
    vi.setSystemTime(now);
    const cutoff = historyCutoff('pro');
    const diffDays = (now.getTime() - cutoff.getTime()) / (24 * 60 * 60 * 1_000);
    expect(diffDays).toBeCloseTo(90, 5);
  });

  it('Free cutoff is more recent than Pro cutoff', () => {
    const freeCutoff = historyCutoff('free');
    const proCutoff  = historyCutoff('pro');
    expect(freeCutoff.getTime()).toBeGreaterThan(proCutoff.getTime());
  });
});

// ── hashToken ─────────────────────────────────────────────────────────────────

describe('[PA.1] hashToken', () => {
  it('produces a 64-char hex string (SHA-256)', () => {
    const hash = hashToken('my-secret-token');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('same input → same hash (deterministic)', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
  });

  it('different inputs → different hashes', () => {
    expect(hashToken('token-a')).not.toBe(hashToken('token-b'));
  });

  it('raw token is not stored (hash != token)', () => {
    const token = 'my-secret-token';
    expect(hashToken(token)).not.toBe(token);
  });
});

// ── SESSION_TTL_MS ────────────────────────────────────────────────────────────

describe('[PA.1] SESSION_TTL_MS', () => {
  it('is 30 days in milliseconds', () => {
    expect(SESSION_TTL_MS).toBe(30 * 24 * 60 * 60 * 1_000);
  });
});
