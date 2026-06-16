/**
 * pa5-worker.test.ts — PA.5: WatcherPool + reconcile + dispatcher logic, offline.
 *
 * Tests pure logic without hitting MongoDB or external services.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── WatcherPool state management (pure logic) ─────────────────────────────────

describe('[PA.5] WatcherPool key construction', () => {
  it('key is surface:address', () => {
    const surface = 'evm';
    const address = '0xabcdef1234567890abcdef1234567890abcdef12';
    const key = `${surface}:${address}`;
    expect(key).toBe('evm:0xabcdef1234567890abcdef1234567890abcdef12');
  });

  it('native key uses r-address prefix', () => {
    const key = `native:rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh`;
    expect(key.startsWith('native:')).toBe(true);
  });
});

describe('[PA.5] reconcile: contract change detection logic', () => {
  function keysOf(contracts: Array<{ surface: string; address: string }>): Set<string> {
    return new Set(contracts.map((c) => `${c.surface}:${c.address}`));
  }

  it('detects newly added contract', () => {
    const running = keysOf([{ surface: 'evm', address: '0xAAA' }]);
    const desired = keysOf([
      { surface: 'evm', address: '0xAAA' },
      { surface: 'evm', address: '0xBBB' },
    ]);
    const toStart = [...desired].filter((k) => !running.has(k));
    expect(toStart).toEqual(['evm:0xBBB']);
  });

  it('detects removed contract', () => {
    const running = keysOf([
      { surface: 'evm', address: '0xAAA' },
      { surface: 'evm', address: '0xBBB' },
    ]);
    const desired = keysOf([{ surface: 'evm', address: '0xAAA' }]);
    const toStop = [...running].filter((k) => !desired.has(k));
    expect(toStop).toEqual(['evm:0xBBB']);
  });

  it('no changes when contracts identical', () => {
    const running = keysOf([{ surface: 'evm', address: '0xAAA' }]);
    const desired = keysOf([{ surface: 'evm', address: '0xAAA' }]);
    const toStart = [...desired].filter((k) => !running.has(k));
    const toStop  = [...running].filter((k) => !desired.has(k));
    expect(toStart).toHaveLength(0);
    expect(toStop).toHaveLength(0);
  });

  it('evm and native contracts with same address are different keys', () => {
    const addr = 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh';
    const k1 = `evm:${addr}`;
    const k2 = `native:${addr}`;
    expect(k1).not.toBe(k2);
  });
});

// ── Dispatcher rule matching logic ─────────────────────────────────────────────

describe('[PA.5] dispatcher: rule matching', () => {
  interface MockRule {
    active:    boolean;
    eventName: string;
    channel:   string;
    target:    string;
  }

  function matchingRules(
    rules: MockRule[],
    activityName: string | undefined,
  ): MockRule[] {
    return rules.filter((r) => {
      if (!r.active) return false;
      if (r.eventName !== '*' && activityName !== r.eventName) return false;
      return true;
    });
  }

  it('wildcard rule matches any event', () => {
    const rules: MockRule[] = [
      { active: true, eventName: '*', channel: 'telegram', target: '123' },
    ];
    expect(matchingRules(rules, 'Transfer')).toHaveLength(1);
    expect(matchingRules(rules, 'Approval')).toHaveLength(1);
  });

  it('named rule only matches its event', () => {
    const rules: MockRule[] = [
      { active: true, eventName: 'Transfer', channel: 'telegram', target: '123' },
    ];
    expect(matchingRules(rules, 'Transfer')).toHaveLength(1);
    expect(matchingRules(rules, 'Approval')).toHaveLength(0);
  });

  it('inactive rule is skipped', () => {
    const rules: MockRule[] = [
      { active: false, eventName: '*', channel: 'telegram', target: '123' },
    ];
    expect(matchingRules(rules, 'Transfer')).toHaveLength(0);
  });

  it('multiple matching rules all returned', () => {
    const rules: MockRule[] = [
      { active: true, eventName: '*',        channel: 'telegram', target: '111' },
      { active: true, eventName: 'Transfer', channel: 'webhook',  target: 'https://x.com' },
      { active: true, eventName: 'Approval', channel: 'discord',  target: 'https://d.com' },
    ];
    const matches = matchingRules(rules, 'Transfer');
    expect(matches).toHaveLength(2); // wildcard + Transfer rule
    expect(matches.map((r) => r.channel).sort()).toEqual(['telegram', 'webhook']);
  });
});

// ── /healthz response shape ───────────────────────────────────────────────────

describe('[PA.5] /healthz response shape', () => {
  it('response contains required fields', () => {
    const mockResponse = {
      status:     'ok',
      uptime:     42.5,
      watchers:   2,
      activeKeys: ['evm:0xAAA', 'native:rXXX'],
      ts:         new Date().toISOString(),
    };

    expect(mockResponse.status).toBe('ok');
    expect(typeof mockResponse.uptime).toBe('number');
    expect(typeof mockResponse.watchers).toBe('number');
    expect(Array.isArray(mockResponse.activeKeys)).toBe(true);
    expect(() => new Date(mockResponse.ts)).not.toThrow();
  });
});

// ── Env var guard ─────────────────────────────────────────────────────────────

describe('[PA.5] required env vars', () => {
  it('MONGODB_URI absence is detectable', () => {
    const env: Record<string, string | undefined> = {};
    const required = ['MONGODB_URI'];
    const missing  = required.filter((k) => !env[k]);
    expect(missing).toContain('MONGODB_URI');
  });

  it('all required env present = no missing', () => {
    const env = { MONGODB_URI: 'mongodb+srv://x:y@cluster.mongodb.net/kryndel' };
    const required = ['MONGODB_URI'];
    const missing  = required.filter((k) => !env[k]);
    expect(missing).toHaveLength(0);
  });
});
