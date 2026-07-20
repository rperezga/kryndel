/**
 * watch-event.test.ts — A1 (AUDIT-PA §A1): watchEvent Server Action.
 *
 * Verifies:
 *   • anonymous visitor → { error: 'sign in' } (no DB write)
 *   • authenticated user with plan='free' → first rule accepted
 *   • authenticated user with plan='free' → second rule on same contract
 *     rejected and rolled back (M1 atomic gate)
 *   • channel gating: 'webhook' rejected on Free (mirrors /api/rules)
 *   • SSRF: 'discord' target pointing to evil-private host rejected
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async (host: string) => {
    if (host === 'discord.com') return [{ address: '162.159.135.232', family: 4 }];
    if (host === 'evil.discord.com') return [{ address: '10.0.0.1',  family: 4 }];
    const err = new Error('ENOTFOUND ' + host) as Error & { code?: string };
    err.code = 'ENOTFOUND';
    throw err;
  }),
}));

// ── In-memory MongoDB stand-in ───────────────────────────────────────────────

const userId      = new ObjectId();
const userPro     = new ObjectId();
const contractAddr = '0xabcdef1234567890abcdef1234567890abcdef12';

let rulesStore:     Record<string, unknown>[] = [];
let contractsStore: Record<string, unknown>[] = [{ userId, address: contractAddr, surface: 'evm' }];

function makeDb() {
  return {
    collection(name: string) {
      if (name === 'alert_rules') {
        return {
          insertOne: vi.fn(async (doc: Record<string, unknown>) => {
            const _id = new ObjectId();
            rulesStore.push({ _id, ...doc });
            return { insertedId: _id };
          }),
          countDocuments: vi.fn(async (q: Record<string, unknown>) =>
            rulesStore.filter(
              (r) =>
                String(r.userId) === String(q.userId) &&
                r.contractAddress === q.contractAddress,
            ).length,
          ),
          deleteOne: vi.fn(async (q: Record<string, unknown>) => {
            const before = rulesStore.length;
            rulesStore = rulesStore.filter((r) => String(r._id) !== String(q._id));
            return { deletedCount: before - rulesStore.length };
          }),
        };
      }
      if (name === 'contracts') {
        return {
          findOne: vi.fn(async (q: Record<string, unknown>) =>
            contractsStore.find(
              (c) =>
                String(c.userId) === String(q.userId) &&
                c.address === q.address,
            ) ?? null,
          ),
        };
      }
      throw new Error('unmocked collection ' + name);
    },
  };
}

vi.mock('@/lib/db', () => ({
  getDb:         vi.fn(async () => makeDb()),
  ensureIndexes: vi.fn(async () => undefined),
}));

// NextAuth stub: switchable per test via global flag
const sessionState: {
  user: { email?: string; plan?: 'free' | 'pro'; _id?: ObjectId } | null;
} = { user: null };

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => (sessionState.user ? { user: { email: sessionState.user.email } } : null)),
  signIn:   vi.fn(),
  signOut:  vi.fn(),
  handlers: {},
}));

vi.mock('@/lib/models/index', () => ({
  usersCollection: vi.fn(async () => ({
    findOne: vi.fn(async () => {
      if (!sessionState.user) return null;
      const s = sessionState.user;
      return {
        _id:   s._id ?? userId,
        email: s.email,
        plan:  s.plan ?? 'free',
      };
    }),
  })),
}));

// ── Import after mocks are in place ──────────────────────────────────────────
import { watchEvent } from '@/app/(app)/contract/[address]/actions';

function form(
  fields: Partial<{ contract: string; event: string; channel: string; target: string }>,
): FormData {
  const fd = new FormData();
  fd.set('contract', fields.contract ?? contractAddr);
  fd.set('event',    fields.event    ?? 'Transfer');
  fd.set('channel',  fields.channel  ?? 'telegram');
  fd.set('target',   fields.target   ?? '-1001234567890');
  return fd;
}

beforeEach(() => {
  rulesStore     = [];
  contractsStore = [{ userId, address: contractAddr, surface: 'evm' }];
  sessionState.user = null;
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('[A1] watchEvent — anonymous visitor', () => {
  it('rejects with sign-in error', async () => {
    const res = await watchEvent({}, form({}));
    expect(res.error).toMatch(/sign in/i);
    expect(rulesStore).toHaveLength(0);
  });
});

describe('[A1+M1] watchEvent — authenticated Free user', () => {
  beforeEach(() => {
    sessionState.user = { _id: userId, email: 'r@x.com', plan: 'free' };
  });

  it('accepts the first telegram rule', async () => {
    const res = await watchEvent({}, form({}));
    expect(res.success).toBeDefined();
    expect(rulesStore).toHaveLength(1);
    expect(String(rulesStore[0].userId)).toBe(String(userId));
    expect(rulesStore[0].contractAddress).toBe(contractAddr);
  });

  it('rejects the second rule on the same contract (Free=1/contract) and rolls it back', async () => {
    const first = await watchEvent({}, form({}));
    expect(first.success).toBeDefined();
    const second = await watchEvent({}, form({ target: '-1009999999999' }));
    expect(second.error).toMatch(/allows 1 rule/i);
    expect(rulesStore).toHaveLength(1); // rolled back
  });

  it('rejects channel=webhook (not on Free plan)', async () => {
    const res = await watchEvent({}, form({
      channel: 'webhook',
      target:  'https://hooks.slack.com/x',
    }));
    expect(res.error).toMatch(/not available on the free plan/i);
    expect(rulesStore).toHaveLength(0);
  });
});

describe('[A1+A2] watchEvent — Pro user with SSRF check', () => {
  beforeEach(() => {
    sessionState.user = { _id: userPro, email: 'p@x.com', plan: 'pro' };
    contractsStore[0].userId = userPro;
  });

  it('rejects discord target whose host resolves to a private IP', async () => {
    const res = await watchEvent({}, form({
      channel: 'discord',
      target:  'https://evil.discord.com/api/webhooks/1/abc',
    }));
    expect(res.error).toMatch(/private IP|loopback/i);
    expect(rulesStore).toHaveLength(0);
  });

  it('accepts discord target on real discord.com', async () => {
    const res = await watchEvent({}, form({
      channel: 'discord',
      target:  'https://discord.com/api/webhooks/1/abc',
    }));
    expect(res.success).toBeDefined();
    expect(rulesStore).toHaveLength(1);
  });
});
