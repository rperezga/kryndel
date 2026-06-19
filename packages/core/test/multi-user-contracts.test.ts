/**
 * multi-user-contracts.test.ts — PA-BILLING / paso 0.
 *
 * Verifies the multi-user invariant after removing the legacy global
 * unique index on (address, surface) and adding the per-user compound
 * unique (userId, address, surface):
 *
 *   • TWO different users can register the same contract — no E11000.
 *   • Within one user, registering the same contract twice is idempotent.
 *   • Per-user query isolation.
 *
 * Doesn't depend on mocking next/navigation.redirect (Next 15.5 made that
 * unreliable inside server actions) — checks DB state instead.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';

const userA = new ObjectId();
const userB = new ObjectId();
const contractAddr = '0xe4c3ee653d7861cf236b2bea4bdb2a261231ea67';

let contractsStore: any[] = [];

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

/** Emulates the NEW compound unique (userId, address, surface). The legacy
 *  global unique (address, surface) is NOT emulated — it has been removed. */
function makeDb() {
  return {
    collection(_name: string) {
      return {
        insertOne: vi.fn(async (doc: any) => {
          const dup = contractsStore.find((d) =>
            String(d.userId)  === String(doc.userId) &&
            d.address         === doc.address &&
            d.surface         === doc.surface,
          );
          if (dup) {
            const e: any = new Error('E11000 duplicate key error collection: kryndel.contracts');
            e.code = 11000;
            throw e;
          }
          const _id = new ObjectId();
          contractsStore.push({ _id, ...doc });
          return { insertedId: _id };
        }),
        countDocuments: vi.fn(async (q: any) =>
          contractsStore.filter((d) => matches(d, q)).length,
        ),
        deleteOne: vi.fn(async (q: any) => {
          const before = contractsStore.length;
          contractsStore = contractsStore.filter((d) => String(d._id) !== String(q._id));
          return { deletedCount: before - contractsStore.length };
        }),
        findOne: vi.fn(async (q: any) =>
          contractsStore.find((d) => matches(d, q)) ?? null,
        ),
        find: vi.fn((q: any) => ({
          sort: () => ({
            toArray: async () => contractsStore.filter((d) => matches(d, q)),
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
  const real = await vi.importActual<any>('@/lib/models/index');
  return {
    ...real,
    usersCollection: vi.fn(async () => ({
      findOne: vi.fn(async () => {
        if (!sessionState.user) return null;
        return {
          _id:   sessionState.user._id ?? userA,
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
  sessionState.user = null;
});

describe('[PA-BILLING / paso 0] multi-user contracts', () => {
  it('TWO different users can register the SAME contract — no E11000', async () => {
    const { addContract } = await import('@/app/(app)/dashboard/add-contract/actions');

    sessionState.user = { _id: userA, email: 'a@x.com', plan: 'free' };
    await expect(addContract(form({ address: contractAddr, surface: 'evm' })))
      .rejects.toThrow();
    expect(contractsStore).toHaveLength(1);
    expect(String(contractsStore[0].userId)).toBe(String(userA));

    sessionState.user = { _id: userB, email: 'b@x.com', plan: 'free' };
    await expect(addContract(form({ address: contractAddr, surface: 'evm' })))
      .rejects.toThrow();
    expect(contractsStore).toHaveLength(2);

    const userIds = contractsStore.map((d) => String(d.userId)).sort();
    expect(userIds).toEqual([String(userA), String(userB)].sort());
  });

  it('one user adding the SAME contract twice is idempotent (no second row)', async () => {
    sessionState.user = { _id: userA, email: 'a@x.com', plan: 'free' };
    const { addContract } = await import('@/app/(app)/dashboard/add-contract/actions');

    await expect(addContract(form({ address: contractAddr, surface: 'evm' })))
      .rejects.toThrow();
    expect(contractsStore).toHaveLength(1);

    await expect(addContract(form({ address: contractAddr, surface: 'evm' })))
      .rejects.toThrow();
    expect(contractsStore).toHaveLength(1);
  });

  it('per-user query isolation: each user only sees their own contract', async () => {
    const { addContract } = await import('@/app/(app)/dashboard/add-contract/actions');

    sessionState.user = { _id: userA, email: 'a@x.com', plan: 'free' };
    await expect(addContract(form({ address: contractAddr, surface: 'evm' })))
      .rejects.toThrow();

    sessionState.user = { _id: userB, email: 'b@x.com', plan: 'free' };
    await expect(addContract(form({ address: contractAddr, surface: 'evm' })))
      .rejects.toThrow();

    expect(contractsStore.filter((d) => String(d.userId) === String(userA))).toHaveLength(1);
    expect(contractsStore.filter((d) => String(d.userId) === String(userB))).toHaveLength(1);
  });
});
