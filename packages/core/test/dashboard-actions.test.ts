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
 * next/navigation.redirect throws a special error in Next.js; we replicate
 * that contract so the action terminates after calling redirect.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';

// ── Mocks ────────────────────────────────────────────────────────────────────

const redirectCalls: string[] = [];
class RedirectError extends Error {}
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    redirectCalls.push(url);
    throw new RedirectError(url);
  }),
}));

const userId       = new ObjectId();
const contractAddr = '0xe4c3ee653d7861cf236b2bea4bdb2a261231ea67';

let contractsStore: any[] = [];
let rulesStore:     any[] = [];

function matches(doc: any, q: any): boolean {
  for (const [k, v] of Object.entries(q)) {
    const dv = (doc as any)[k];
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
      const setStore = (next: any[]) => {
        if (isContracts) contractsStore = next; else rulesStore = next;
      };
      return {
        insertOne: vi.fn(async (doc: any) => {
          const _id = new ObjectId();
          getStore().push({ _id, ...doc });
          return { insertedId: _id };
        }),
        countDocuments: vi.fn(async (q: any) => getStore().filter((d) => matches(d, q)).length),
        deleteOne: vi.fn(async (q: any) => {
          const before = getStore().length;
          setStore(getStore().filter((d) => String(d._id) !== String(q._id)));
          return { deletedCount: before - getStore().length };
        }),
        findOne: vi.fn(async (q: any) => getStore().find((d) => matches(d, q)) ?? null),
        find:    vi.fn((q: any) => ({
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

// usersCollection mock used by requireUser via lib/models/index
vi.mock('@/lib/models/index', async () => {
  const real = await vi.importActual<any>('@/lib/models/index');
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  contractsStore = [];
  rulesStore     = [];
  redirectCalls.length = 0;
  sessionState.user = null;
});

// ── addContract ──────────────────────────────────────────────────────────────

describe('[PA-SMOKE] addContract Server Action', () => {
  it('anonymous user is redirected to /login', async () => {
    sessionState.user = null;
    const { addContract } = await import('@/app/dashboard/add-contract/actions');
    await expect(addContract(form({
      address: contractAddr, surface: 'evm', name: 'Smoke',
    }))).rejects.toBeInstanceOf(RedirectError);
    expect(redirectCalls.at(-1)).toBe('/login');
    expect(contractsStore).toHaveLength(0);
  });

  it('Free user: first contract accepted and redirected to /dashboard', async () => {
    sessionState.user = { _id: userId, email: 'r@x.com', plan: 'free' };
    const { addContract } = await import('@/app/dashboard/add-contract/actions');
    await expect(addContract(form({
      address: contractAddr, surface: 'evm', name: 'Smoke',
    }))).rejects.toBeInstanceOf(RedirectError);
    expect(redirectCalls.at(-1)).toBe('/dashboard');
    expect(contractsStore).toHaveLength(1);
    expect(String(contractsStore[0].userId)).toBe(String(userId));
    expect(contractsStore[0].address).toBe(contractAddr);
  });

  it('Free user: rejects invalid address with error redirect', async () => {
    sessionState.user = { _id: userId, email: 'r@x.com', plan: 'free' };
    const { addContract } = await import('@/app/dashboard/add-contract/actions');
    await expect(addContract(form({
      address: 'not-an-address', surface: 'evm',
    }))).rejects.toBeInstanceOf(RedirectError);
    expect(redirectCalls.at(-1)).toMatch(/error=Invalid%20contract/);
    expect(contractsStore).toHaveLength(0);
  });

  it('Free user: 4th contract rolled back (Free=3 max)', async () => {
    sessionState.user = { _id: userId, email: 'r@x.com', plan: 'free' };
    const { addContract } = await import('@/app/dashboard/add-contract/actions');
    for (let i = 1; i <= 3; i++) {
      const addr = '0x' + i.toString().padEnd(40, '0');
      await expect(addContract(form({ address: addr, surface: 'evm' }))).rejects.toBeInstanceOf(RedirectError);
    }
    expect(contractsStore).toHaveLength(3);

    await expect(addContract(form({
      address: '0xdeadbeef' + 'd'.repeat(32),
      surface: 'evm',
    }))).rejects.toBeInstanceOf(RedirectError);
    expect(redirectCalls.at(-1)).toMatch(/free%20plan%20allows%20up%20to%203/i);
    expect(contractsStore).toHaveLength(3); // 4th rolled back
  });
});

// ── addRule ──────────────────────────────────────────────────────────────────

describe('[PA-SMOKE] addRule Server Action', () => {
  beforeEach(() => {
    // Pre-seed the user's contract
    contractsStore.push({
      _id: new ObjectId(),
      userId, address: contractAddr, surface: 'evm', active: true,
    });
  });

  it('anonymous user is redirected to /login', async () => {
    sessionState.user = null;
    const { addRule } = await import('@/app/dashboard/rules/actions');
    await expect(addRule(contractAddr, form({
      eventName: 'Transfer', target: '-1001234567890',
    }))).rejects.toBeInstanceOf(RedirectError);
    expect(redirectCalls.at(-1)).toBe('/login');
    expect(rulesStore).toHaveLength(0);
  });

  it('Free user: first rule accepted', async () => {
    sessionState.user = { _id: userId, email: 'r@x.com', plan: 'free' };
    const { addRule } = await import('@/app/dashboard/rules/actions');
    await expect(addRule(contractAddr, form({
      eventName: 'Transfer', target: '-1001234567890',
    }))).rejects.toBeInstanceOf(RedirectError);
    expect(redirectCalls.at(-1)).toContain('/dashboard/rules?contract=');
    expect(rulesStore).toHaveLength(1);
    expect(String(rulesStore[0].userId)).toBe(String(userId));
    expect(rulesStore[0].channel).toBe('telegram');
  });

  it('Free user: second rule on same contract rolled back', async () => {
    sessionState.user = { _id: userId, email: 'r@x.com', plan: 'free' };
    const { addRule } = await import('@/app/dashboard/rules/actions');
    await expect(addRule(contractAddr, form({
      eventName: 'Transfer', target: '-1001234567890',
    }))).rejects.toBeInstanceOf(RedirectError);
    await expect(addRule(contractAddr, form({
      eventName: 'Approval', target: '-1009999999999',
    }))).rejects.toBeInstanceOf(RedirectError);
    expect(redirectCalls.at(-1)).toMatch(/free%20plan%20allows%201/i);
    expect(rulesStore).toHaveLength(1);
  });

  it('rejects malformed chat ID', async () => {
    sessionState.user = { _id: userId, email: 'r@x.com', plan: 'free' };
    const { addRule } = await import('@/app/dashboard/rules/actions');
    await expect(addRule(contractAddr, form({
      eventName: 'Transfer', target: 'not-a-chat-id',
    }))).rejects.toBeInstanceOf(RedirectError);
    expect(redirectCalls.at(-1)).toMatch(/error=Telegram%20Chat%20ID/);
    expect(rulesStore).toHaveLength(0);
  });

  it('rejects when the contract is not owned by the user', async () => {
    sessionState.user = { _id: new ObjectId(), email: 'other@x.com', plan: 'free' };
    const { addRule } = await import('@/app/dashboard/rules/actions');
    await expect(addRule(contractAddr, form({
      eventName: 'Transfer', target: '-1001234567890',
    }))).rejects.toBeInstanceOf(RedirectError);
    expect(redirectCalls.at(-1)).toBe('/dashboard');
    expect(rulesStore).toHaveLength(0);
  });
});
