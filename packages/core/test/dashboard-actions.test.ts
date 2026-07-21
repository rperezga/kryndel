/**
 * dashboard-actions.test.ts — PA-SMOKE fix (2026-06-17).
 *
 * Covers the Server Actions in:
 *   • /dashboard/add-contract/actions.ts  (addContract)
 *   • /dashboard/rules/actions.ts         (addRule)
 *
 * Both used to call /api/* via internal fetch which silently dropped the
 * session cookie → permanent 401. The actions now do direct DB writes with
 * requireUser() + B4 plan narrow + M1 atomic insert-then-verify.
 *
 * 2026-06-17 PA-BILLING: dropped reliance on mocking `next/navigation.redirect`
 * because Next 15.5 changed the internal module structure and the vi.mock
 * doesn't intercept calls from inside an action's `import { redirect }`.
 * The action still throws on redirect (that's how redirect() works in
 * production), so `.rejects.toThrow()` is enough to know it terminated;
 * the business invariant is checked against the in-memory DB store.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';

const userId       = new ObjectId();
const contractAddr = '0xe4c3ee653d7861cf236b2bea4bdb2a261231ea67';

let contractsStore: Record<string, unknown>[] = [];
let rulesStore:     Record<string, unknown>[] = [];

function matches(doc: Record<string, unknown>, q: Record<string, unknown>): boolean {
  for (const [k, v] of Object.entries(q)) {
    const dv = doc[k];
    if (k === 'address' || k === 'contractAddress') {
      if (String(dv).toLowerCase() !== String(v).toLowerCase()) return false;
    } else if (String(dv) !== String(v)) {
      return false;
    }
  }
  return true;
}

function makeDb() {
  return {
    collection(name: string) {
      const isContracts = name === 'contracts';
      const getStore = () => isContracts ? contractsStore : rulesStore;
      const setStore = (next: Record<string, unknown>[]) => {
        if (isContracts) contractsStore = next; else rulesStore = next;
      };
      return {
        insertOne: vi.fn(async (doc: Record<string, unknown>) => {
          const _id = new ObjectId();
          getStore().push({ _id, ...doc });
          return { insertedId: _id };
        }),
        countDocuments: vi.fn(async (q: Record<string, unknown>) => getStore().filter((d) => matches(d, q)).length),
        deleteOne: vi.fn(async (q: Record<string, unknown>) => {
          const before = getStore().length;
          setStore(getStore().filter((d) => String(d._id) !== String(q._id)));
          return { deletedCount: before - getStore().length };
        }),
        findOne: vi.fn(async (q: Record<string, unknown>) => getStore().find((d) => matches(d, q)) ?? null),
        find:    vi.fn((q: Record<string, unknown>) => ({
          sort: () => ({
            toArray: async () => getStore().filter((d) => matches(d, q)),
          }),
        })),
      };
    },
  };
}

vi.mock('@/lib/db', () => ({
  getDb:         vi.fn(async () => makeDb()),
  ensureIndexes: vi.fn(async () => undefined),
}));

const sessionState: {
  user: { email?: string; plan?: 'free' | 'pro'; _id?: ObjectId } | null;
} = { user: null };

vi.mock('@/auth', () => ({
  auth: vi.fn(async () =>
    sessionState.user ? { user: { email: sessionState.user.email } } : null,
  ),
  signIn:   vi.fn(),
  signOut:  vi.fn(),
  handlers: {},
}));

vi.mock('@/lib/models/index', async () => {
  const real = await vi.importActual<typeof import('@/lib/models/index')>('@/lib/models/index');
  return {
    ...real,
    usersCollection: vi.fn(async () => ({
      findOne: vi.fn(async () => {
        if (!sessionState.user) return null;
        return {
          _id:   sessionState.user._id ?? userId,
          email: sessionState.user.email,
          plan:  sessionState.user.plan ?? 'free',
        };
      }),
    })),
  };
});

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  contractsStore = [];
  rulesStore     = [];
  sessionState.user = null;
});

// ── addContract ──────────────────────────────────────────────────────────────

describe('[PA-SMOKE] addContract Server Action', () => {
  it('anonymous user does not write to DB', async () => {
    sessionState.user = null;
    const { addContract } = await import('@/app/(app)/dashboard/add-contract/actions');
    await expect(addContract(form({
      address: contractAddr, surface: 'evm', name: 'Smoke',
    }))).rejects.toThrow();
    expect(contractsStore).toHaveLength(0); // no row inserted = auth blocked
  });

  it('Free user: first contract gets inserted with userId', async () => {
    sessionState.user = { _id: userId, email: 'r@x.com', plan: 'free' };
    const { addContract } = await import('@/app/(app)/dashboard/add-contract/actions');
    await expect(addContract(form({
      address: contractAddr, surface: 'evm', name: 'Smoke',
    }))).rejects.toThrow();
    expect(contractsStore).toHaveLength(1);
    expect(String(contractsStore[0].userId)).toBe(String(userId));
    expect(contractsStore[0].address).toBe(contractAddr);
  });

  it('Free user: invalid address → no DB write', async () => {
    sessionState.user = { _id: userId, email: 'r@x.com', plan: 'free' };
    const { addContract } = await import('@/app/(app)/dashboard/add-contract/actions');
    await expect(addContract(form({
      address: 'not-an-address', surface: 'evm',
    }))).rejects.toThrow();
    expect(contractsStore).toHaveLength(0);
  });

  it('Free user: 4th contract rolled back (Free=3 max) — only 3 rows survive', async () => {
    sessionState.user = { _id: userId, email: 'r@x.com', plan: 'free' };
    const { addContract } = await import('@/app/(app)/dashboard/add-contract/actions');
    for (let i = 1; i <= 3; i++) {
      const addr = '0x' + i.toString().padEnd(40, '0');
      await expect(addContract(form({ address: addr, surface: 'evm' }))).rejects.toThrow();
    }
    expect(contractsStore).toHaveLength(3);

    await expect(addContract(form({
      address: '0xdeadbeef' + 'd'.repeat(32),
      surface: 'evm',
    }))).rejects.toThrow();
    expect(contractsStore).toHaveLength(3); // 4th rolled back
  });
});

// ── addRule ──────────────────────────────────────────────────────────────────

describe('[PA-SMOKE] addRule Server Action', () => {
  beforeEach(() => {
    contractsStore.push({
      _id: new ObjectId(),
      userId, address: contractAddr, surface: 'evm', active: true,
    });
  });

  it('anonymous user does not write a rule', async () => {
    sessionState.user = null;
    const { addRule } = await import('@/app/(app)/dashboard/rules/actions');
    await expect(addRule(contractAddr, form({
      eventName: 'Transfer', target: '-1001234567890',
    }))).rejects.toThrow();
    expect(rulesStore).toHaveLength(0);
  });

  it('Free user: first rule inserted with userId + telegram channel', async () => {
    sessionState.user = { _id: userId, email: 'r@x.com', plan: 'free' };
    const { addRule } = await import('@/app/(app)/dashboard/rules/actions');
    await expect(addRule(contractAddr, form({
      eventName: 'Transfer', target: '-1001234567890',
    }))).rejects.toThrow();
    expect(rulesStore).toHaveLength(1);
    expect(String(rulesStore[0].userId)).toBe(String(userId));
    expect(rulesStore[0].channel).toBe('telegram');
  });

  it('Free user: 2nd rule on same contract rolled back', async () => {
    sessionState.user = { _id: userId, email: 'r@x.com', plan: 'free' };
    const { addRule } = await import('@/app/(app)/dashboard/rules/actions');
    await expect(addRule(contractAddr, form({
      eventName: 'Transfer', target: '-1001234567890',
    }))).rejects.toThrow();
    await expect(addRule(contractAddr, form({
      eventName: 'Approval', target: '-1009999999999',
    }))).rejects.toThrow();
    expect(rulesStore).toHaveLength(1);
  });

  it('malformed chat ID → no rule inserted', async () => {
    sessionState.user = { _id: userId, email: 'r@x.com', plan: 'free' };
    const { addRule } = await import('@/app/(app)/dashboard/rules/actions');
    await expect(addRule(contractAddr, form({
      eventName: 'Transfer', target: 'not-a-chat-id',
    }))).rejects.toThrow();
    expect(rulesStore).toHaveLength(0);
  });

  it('contract not owned by user → no rule inserted', async () => {
    sessionState.user = { _id: new ObjectId(), email: 'other@x.com', plan: 'free' };
    const { addRule } = await import('@/app/(app)/dashboard/rules/actions');
    await expect(addRule(contractAddr, form({
      eventName: 'Transfer', target: '-1001234567890',
    }))).rejects.toThrow();
    expect(rulesStore).toHaveLength(0);
  });
});
