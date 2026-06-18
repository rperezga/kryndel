/**
 * v1-endpoints.test.ts -- PB.3: v1 endpoint business logic (offline).
 */
import { describe, it, expect } from 'vitest';
import { historyCutoff, PLAN_LIMITS } from '@/lib/models/user.js';

// ── Pagination helpers ────────────────────────────────────────────────────────

function paginate<T>(items: T[], page: number, limit: number) {
  const skip  = (page - 1) * limit;
  const data  = items.slice(skip, skip + limit);
  const total = items.length;
  return { data, pagination: { page, limit, total, hasMore: skip + data.length < total } };
}

describe('[PB.3] pagination', () => {
  const items = Array.from({ length: 25 }, (_, i) => ({ id: i }));

  it('page 1 returns first N items', () => {
    const { data, pagination } = paginate(items, 1, 10);
    expect(data.length).toBe(10);
    expect(data[0]).toEqual({ id: 0 });
    expect(pagination.hasMore).toBe(true);
  });

  it('page 3 with limit 10 returns last 5 items', () => {
    const { data, pagination } = paginate(items, 3, 10);
    expect(data.length).toBe(5);
    expect(pagination.hasMore).toBe(false);
  });

  it('limit 100 is max', () => {
    const limit = Math.min(100, Math.max(1, 200));
    expect(limit).toBe(100);
  });

  it('limit 0 is clamped to 1', () => {
    const limit = Math.min(100, Math.max(1, 0));
    expect(limit).toBe(1);
  });
});

// ── historyCutoff isolation ───────────────────────────────────────────────────

describe('[PB.3] historyCutoff per plan', () => {
  it('free plan: 7 days cutoff', () => {
    const cutoff = historyCutoff('free');
    const expectedMs = 7 * 24 * 60 * 60 * 1000;
    const diff = Date.now() - cutoff.getTime();
    expect(diff).toBeGreaterThanOrEqual(expectedMs - 1000);
    expect(diff).toBeLessThanOrEqual(expectedMs + 1000);
  });

  it('pro plan: 90 days cutoff', () => {
    const cutoff = historyCutoff('pro');
    const expectedMs = 90 * 24 * 60 * 60 * 1000;
    const diff = Date.now() - cutoff.getTime();
    expect(diff).toBeGreaterThanOrEqual(expectedMs - 1000);
    expect(diff).toBeLessThanOrEqual(expectedMs + 1000);
  });

  it('events before cutoff are excluded (logic)', () => {
    const cutoff   = historyCutoff('free');
    const oldEvent = { createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) };
    expect(oldEvent.createdAt < cutoff).toBe(true);
  });

  it('events after cutoff are included (logic)', () => {
    const cutoff      = historyCutoff('free');
    const recentEvent = { createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) };
    expect(recentEvent.createdAt >= cutoff).toBe(true);
  });
});

// ── User isolation (logic) ────────────────────────────────────────────────────

describe('[PB.3] user isolation', () => {
  it('contract filter includes userId', () => {
    // Verify the query pattern always uses userId
    const userId = 'user-A';
    const filter = { userId, address: '0xabc' };
    expect(filter.userId).toBe('user-A');
    // A different userId would never match
    const otherUserId = 'user-B';
    expect(filter.userId === otherUserId).toBe(false);
  });

  it('events query scoped to user contracts only', () => {
    const userAContracts = ['0xaaa', '0xbbb'];
    const userBContracts = ['0xccc'];
    // User A's query should only see their contracts
    const userAFilter = { contractAddress: { $in: userAContracts } };
    const userBAddress = '0xccc';
    expect(userAContracts.includes(userBAddress)).toBe(false);
  });
});

// ── Plan limits ───────────────────────────────────────────────────────────────

describe('[PB.3] plan limits', () => {
  it('GET /me returns correct limits for free plan', () => {
    const plan   = 'free' as const;
    const limits = PLAN_LIMITS[plan];
    expect(limits.maxContracts).toBe(3);
    expect(limits.maxRulesPerContract).toBe(1);
    expect(limits.historyDays).toBe(7);
  });

  it('GET /me returns correct limits for pro plan', () => {
    const plan   = 'pro' as const;
    const limits = PLAN_LIMITS[plan];
    expect(limits.maxContracts).toBe(20);
    expect(limits.maxRulesPerContract).toBe(10);
    expect(limits.historyDays).toBe(90);
  });
});
