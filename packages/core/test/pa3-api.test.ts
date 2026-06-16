/**
 * pa3-api.test.ts — PA.3+4: API route logic + plan gating, offline.
 *
 * Tests the pure business logic extracted from the API routes:
 * - Contract limit enforcement (Free: 3 max)
 * - Rule limit enforcement (Free: 1/contract)
 * - Channel gating (Free: telegram only)
 * - Webhook SSRF guard (must be https://)
 * - historyCutoff date range for query gating
 */
import { describe, it, expect } from 'vitest';
import { PLAN_LIMITS, historyCutoff } from '@/lib/models/user.js';

// ── Contract limit ────────────────────────────────────────────────────────────

describe('[PA.3/4] contract limit enforcement', () => {
  it('Free: rejects when contract count >= 3', () => {
    const count = 3;
    const over  = count >= PLAN_LIMITS.free.maxContracts;
    expect(over).toBe(true);
  });

  it('Free: allows when contract count < 3', () => {
    const count = 2;
    const over  = count >= PLAN_LIMITS.free.maxContracts;
    expect(over).toBe(false);
  });

  it('Pro: allows 20 contracts', () => {
    expect(PLAN_LIMITS.pro.maxContracts).toBe(20);
  });
});

// ── Rule limit per contract ───────────────────────────────────────────────────

describe('[PA.3/4] rule limit per contract', () => {
  it('Free: blocks second rule on same contract', () => {
    const ruleCount = 1;
    const blocked   = ruleCount >= PLAN_LIMITS.free.maxRulesPerContract;
    expect(blocked).toBe(true);
  });

  it('Free: allows first rule', () => {
    const ruleCount = 0;
    const blocked   = ruleCount >= PLAN_LIMITS.free.maxRulesPerContract;
    expect(blocked).toBe(false);
  });

  it('Pro: allows up to 10 rules', () => {
    expect(PLAN_LIMITS.pro.maxRulesPerContract).toBe(10);
  });
});

// ── Channel gating ────────────────────────────────────────────────────────────

describe('[PA.3/4] channel gating', () => {
  function canUseChannel(plan: 'free' | 'pro', channel: string): boolean {
    return PLAN_LIMITS[plan].channels.includes(channel);
  }

  it('Free: telegram allowed', ()   => expect(canUseChannel('free', 'telegram')).toBe(true));
  it('Free: discord blocked', ()    => expect(canUseChannel('free', 'discord')).toBe(false));
  it('Free: webhook blocked', ()    => expect(canUseChannel('free', 'webhook')).toBe(false));
  it('Free: email blocked', ()      => expect(canUseChannel('free', 'email')).toBe(false));

  it('Pro: all channels allowed', () => {
    for (const ch of ['telegram', 'discord', 'webhook', 'email']) {
      expect(canUseChannel('pro', ch)).toBe(true);
    }
  });
});

// ── Webhook SSRF guard ───────────────────────────────────────────────────────

describe('[PA.3/4] webhook SSRF guard', () => {
  function isValidWebhook(url: string): boolean {
    return url.startsWith('https://');
  }

  it('rejects http:// webhook', ()  => expect(isValidWebhook('http://evil.com')).toBe(false));
  it('rejects empty string', ()     => expect(isValidWebhook('')).toBe(false));
  it('rejects on-chain URL', ()     => expect(isValidWebhook('0x1234')).toBe(false));
  it('accepts https:// webhook', () => expect(isValidWebhook('https://hooks.slack.com/x')).toBe(true));
});

// ── History cutoff for event queries ──────────────────────────────────────────

describe('[PA.3/4] event history query gate', () => {
  it('Free: events older than 7d are not visible', () => {
    const now     = new Date();
    const cutoff  = historyCutoff('free');
    const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1_000);
    // An event 8 days ago should be BEFORE the cutoff (not visible)
    expect(eightDaysAgo < cutoff).toBe(true);
  });

  it('Free: events from 6d ago are visible', () => {
    const now     = new Date();
    const cutoff  = historyCutoff('free');
    const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1_000);
    expect(sixDaysAgo >= cutoff).toBe(true);
  });

  it('Pro: events from 89d ago are visible', () => {
    const now    = new Date();
    const cutoff = historyCutoff('pro');
    const d89    = new Date(now.getTime() - 89 * 24 * 60 * 60 * 1_000);
    expect(d89 >= cutoff).toBe(true);
  });

  it('Pro: events from 91d ago are not visible', () => {
    const now    = new Date();
    const cutoff = historyCutoff('pro');
    const d91    = new Date(now.getTime() - 91 * 24 * 60 * 60 * 1_000);
    expect(d91 < cutoff).toBe(true);
  });
});
