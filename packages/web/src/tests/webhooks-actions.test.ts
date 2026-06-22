import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';

// Mock stores
let endpointsStore: any[] = [];
let deliveriesStore: any[] = [];

function makeMockDb() {
  return {
    collection(name: string) {
      const getStore = () => (name === 'webhook_endpoints' ? endpointsStore : deliveriesStore);
      const setStore = (next: any[]) => {
        if (name === 'webhook_endpoints') endpointsStore = next;
        else deliveriesStore = next;
      };
      return {
        insertOne: vi.fn(async (doc: any) => {
          const _id = new ObjectId();
          getStore().push({ _id, ...doc });
          return { insertedId: _id };
        }),
        countDocuments: vi.fn(async (q: any) => {
          return getStore().filter((d) => {
            if (q.userId && String(d.userId) !== String(q.userId)) return false;
            if (q.active !== undefined && d.active !== q.active) return false;
            return true;
          }).length;
        }),
        updateOne: vi.fn(async (q: any, u: any) => {
          const matched = getStore().filter((d) => {
            if (q._id && String(d._id) !== String(q._id)) return false;
            if (q.userId && String(d.userId) !== String(q.userId)) return false;
            return true;
          });
          if (matched.length > 0 && u.$set) {
            matched.forEach((d) => {
              Object.assign(d, u.$set);
            });
            return { matchedCount: matched.length, modifiedCount: matched.length };
          }
          return { matchedCount: 0, modifiedCount: 0 };
        }),
        findOne: vi.fn(async (q: any) => {
          return getStore().find((d) => {
            if (q._id && String(d._id) !== String(q._id)) return false;
            if (q.userId && String(d.userId) !== String(q.userId)) return false;
            if (q.active !== undefined && d.active !== q.active) return false;
            return true;
          }) ?? null;
        }),
      };
    },
  };
}

// Set up mocks
vi.mock('@/lib/db', () => ({
  getDb: vi.fn(async () => makeMockDb()),
}));

const mockUserState: { plan: 'free' | 'pro'; _id: ObjectId } = {
  plan: 'free',
  _id: new ObjectId(),
};

vi.mock('@/lib/current-user', () => ({
  requireUser: vi.fn(async () => ({
    _id: mockUserState._id,
    plan: mockUserState.plan,
    email: 'test@kryndel.dev',
  })),
}));

vi.mock('@/lib/ssrf', () => ({
  assertSafePublicUrl: vi.fn(async (url: string) => {
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      throw new Error('SSRF Blocked private IP');
    }
  }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Fetch global mocks to mock fetch calls during replay tests
const mockGlobalFetch = vi.fn(async () => ({
  ok: true,
  status: 200,
}));
vi.stubGlobal('fetch', mockGlobalFetch);

describe('Webhook Server Actions', () => {
  beforeEach(() => {
    endpointsStore = [];
    deliveriesStore = [];
    mockUserState.plan = 'free';
    mockUserState._id = new ObjectId();
    mockGlobalFetch.mockClear();
  });

  describe('createWebhookEndpointAction', () => {
    it('Free plan: creation is blocked', async () => {
      mockUserState.plan = 'free';
      const { createWebhookEndpointAction } = await import('@/app/(app)/dashboard/webhooks/actions');
      const res = await createWebhookEndpointAction('https://example.com/webhook');
      expect(res.error).toContain('requires a Pro plan');
      expect(endpointsStore).toHaveLength(0);
    });

    it('Pro plan: successful webhook creation', async () => {
      mockUserState.plan = 'pro';
      const { createWebhookEndpointAction } = await import('@/app/(app)/dashboard/webhooks/actions');
      const res = await createWebhookEndpointAction('https://example.com/webhook', 'Desc', ['0x123'], ['Transfer']);
      expect(res.success).toContain('registered successfully');
      expect(res.secret).toBeDefined();
      expect(endpointsStore).toHaveLength(1);
      expect(endpointsStore[0].url).toBe('https://example.com/webhook');
      expect(endpointsStore[0].active).toBe(true);
      expect(endpointsStore[0].secretPrefix).toHaveLength(8);
      expect(endpointsStore[0].contractAddresses).toEqual(['0x123']);
      expect(endpointsStore[0].eventNames).toEqual(['Transfer']);
    });

    it('Pro plan: blocks unsafe private URLs', async () => {
      mockUserState.plan = 'pro';
      const { createWebhookEndpointAction } = await import('@/app/(app)/dashboard/webhooks/actions');
      const res = await createWebhookEndpointAction('https://localhost/webhook');
      expect(res.error).toContain('SSRF validation failed');
      expect(endpointsStore).toHaveLength(0);
    });

    it('Pro plan: checks 10 endpoint limit', async () => {
      mockUserState.plan = 'pro';
      const { createWebhookEndpointAction } = await import('@/app/(app)/dashboard/webhooks/actions');
      // pre-populate 10 endpoints
      for (let i = 0; i < 10; i++) {
        endpointsStore.push({
          userId: mockUserState._id,
          url: `https://example.com/webhook-${i}`,
          active: true,
        });
      }

      const res = await createWebhookEndpointAction('https://example.com/webhook-11');
      expect(res.error).toContain('Maximum 10 active webhook endpoints');
      expect(endpointsStore).toHaveLength(10);
    });
  });

  describe('deleteWebhookEndpointAction', () => {
    it('soft-deletes active webhook endpoint', async () => {
      mockUserState.plan = 'pro';
      const epId = new ObjectId();
      endpointsStore.push({
        _id: epId,
        userId: mockUserState._id,
        url: 'https://example.com/webhook',
        active: true,
      });

      const { deleteWebhookEndpointAction } = await import('@/app/(app)/dashboard/webhooks/actions');
      const res = await deleteWebhookEndpointAction(epId.toHexString());
      expect(res.success).toContain('deleted successfully');
      expect(endpointsStore[0].active).toBe(false);
    });
  });

  describe('replayWebhookAction', () => {
    it('Free plan: replay is blocked', async () => {
      mockUserState.plan = 'free';
      const { replayWebhookAction } = await import('@/app/(app)/dashboard/webhooks/actions');
      const res = await replayWebhookAction(new ObjectId().toHexString());
      expect(res.error).toContain('requires a Pro plan');
    });

    it('Pro plan: replay success logs a new webhook delivery entry', async () => {
      mockUserState.plan = 'pro';
      const epId = new ObjectId();
      const delId = new ObjectId();

      endpointsStore.push({
        _id: epId,
        userId: mockUserState._id,
        url: 'https://example.com/webhook',
        secret: 'my-little-secret-code-is-so-cool-12345',
        active: true,
      });

      deliveriesStore.push({
        _id: delId,
        endpointId: epId,
        userId: mockUserState._id,
        contractAddress: '0x1234',
        eventName: 'Transfer',
        payload: { event: 'Transfer', contract: '0x1234', data: {} },
        attempt: 1,
        status: 'failed',
        createdAt: new Date(),
      });

      const { replayWebhookAction } = await import('@/app/(app)/dashboard/webhooks/actions');
      const res = await replayWebhookAction(delId.toHexString());

      expect(res.success).toContain('Webhook replayed successfully');
      expect(mockGlobalFetch).toHaveBeenCalledTimes(1);
      // Wait, should insert a new delivery log to represent the replay
      expect(deliveriesStore).toHaveLength(2);
      expect(deliveriesStore[1].status).toBe('success');
      expect(deliveriesStore[1].attempt).toBe(1);
      expect(deliveriesStore[1].contractAddress).toBe('0x1234');
      expect(deliveriesStore[1].payload.isReplay).toBe(true);
    });
  });
});
