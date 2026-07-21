/**
 * billing.test.ts — PA-BILLING / paso 2.
 *
 * Covers:
 *   POST /api/billing/checkout       (Stripe Checkout Session creation)
 *   POST /api/billing/portal         (Stripe Billing Portal session)
 *   POST /api/webhooks/stripe        (signature + idempotency + handlers)
 *
 * All Stripe SDK calls are intercepted via a fake client returned by
 * @/lib/stripe.getStripe. The webhook tests exercise the constructEvent
 * signature path through that fake.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';

// ── Fake Stripe SDK ─────────────────────────────────────────────────────────

const { fakeStripe, stripeCalls, signatureBehaviour } = vi.hoisted(() => {
  const stripeCalls: Record<string, unknown>[] = [];
  const signatureBehaviour: { valid: boolean; event?: unknown } = { valid: true };
  const fakeStripe = {
    checkout: {
      sessions: {
        create: vi.fn(async (args: Record<string, unknown>) => {
          stripeCalls.push({ kind: 'checkout', args });
          return { id: 'cs_test_123', url: 'https://checkout.stripe.com/c/cs_test_123' };
        }),
      },
    },
    billingPortal: {
      sessions: {
        create: vi.fn(async (args: Record<string, unknown>) => {
          stripeCalls.push({ kind: 'portal', args });
          return { id: 'bps_test_1', url: 'https://billing.stripe.com/p/session/bps_test_1' };
        }),
      },
    },
    webhooks: {
      constructEvent: vi.fn((body: string, sig: string, secret: string) => {
        stripeCalls.push({ kind: 'constructEvent', body: body.length, sig, secret });
        if (!signatureBehaviour.valid) {
          const err = new Error('No signatures found matching the expected signature for payload.') as Error & { type?: string };
          err.type = 'StripeSignatureVerificationError';
          throw err;
        }
        return signatureBehaviour.event;
      }),
    },
  };
  return { fakeStripe, stripeCalls, signatureBehaviour };
});

vi.mock('@/lib/stripe', () => ({
  getStripe: () => fakeStripe,
  appBaseUrl: () => 'https://kryndel.vercel.app',
}));

// ── In-memory DB ────────────────────────────────────────────────────────────

const userIdFree = new ObjectId();
const userIdPro  = new ObjectId();

let usersStore:        Record<string, unknown>[] = [];
let stripeEventsStore: Record<string, unknown>[] = [];

function matches(doc: Record<string, unknown>, q: Record<string, unknown>): boolean {
  for (const [k, v] of Object.entries(q)) {
    const dv = doc[k];
    if (String(dv) !== String(v)) return false;
  }
  return true;
}

function makeDb() {
  return {
    collection(name: string) {
      const isUsers = name === 'users';
      const getStore = () => isUsers ? usersStore : stripeEventsStore;
      const setStore = (next: Record<string, unknown>[]) => {
        if (isUsers) usersStore = next; else stripeEventsStore = next;
      };
      return {
        findOne: vi.fn(async (q: Record<string, unknown>) => getStore().find((d) => matches(d, q)) ?? null),
        updateOne: vi.fn(async (q: Record<string, unknown>, update: Record<string, unknown>) => {
          const idx = getStore().findIndex((d) => matches(d, q));
          if (idx < 0) return { matchedCount: 0, modifiedCount: 0 };
          const doc = { ...getStore()[idx] };
          if (update.$set) Object.assign(doc, update.$set);
          if (update.$unset) {
            for (const k of Object.keys(update.$unset)) delete doc[k];
          }
          const next = getStore();
          next[idx] = doc;
          setStore([...next]);
          return { matchedCount: 1, modifiedCount: 1 };
        }),
        insertOne: vi.fn(async (doc: Record<string, unknown>) => {
          if (isUsers) {
            const _id = doc._id ?? new ObjectId();
            usersStore.push({ ...doc, _id });
            return { insertedId: _id };
          }
          // stripe_events: _id is the Stripe event id; enforce uniqueness.
          if (getStore().some((d) => String(d._id) === String(doc._id))) {
            const err = new Error('E11000 duplicate key') as Error & { code?: number };
            err.code = 11000;
            throw err;
          }
          getStore().push(doc);
          return { insertedId: doc._id };
        }),
      };
    },
  };
}

vi.mock('@/lib/db', () => ({
  getDb:         vi.fn(async () => makeDb()),
  ensureIndexes: vi.fn(async () => undefined),
}));

// ── Session mock ────────────────────────────────────────────────────────────

const sessionState: {
  user: { email?: string; plan?: 'free' | 'pro'; _id?: ObjectId; stripeCustomerId?: string } | null;
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
        const s = sessionState.user;
        if (!s) return null;
        return {
          _id:               s._id ?? userIdFree,
          email:             s.email,
          plan:              s.plan ?? 'free',
          stripeCustomerId:  s.stripeCustomerId,
        };
      }),
    })),
  };
});

beforeEach(() => {
  usersStore = [
    { _id: userIdFree, email: 'free@x.com', plan: 'free' },
    { _id: userIdPro,  email: 'pro@x.com',  plan: 'pro',  stripeCustomerId: 'cus_existing' },
  ];
  stripeEventsStore = [];
  stripeCalls.length = 0;
  signatureBehaviour.valid = true;
  signatureBehaviour.event = undefined;
  process.env.STRIPE_PRICE_ID       = 'price_test_xyz';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
  sessionState.user = null;
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function mkNextRequest(opts: {
  body?: string;
  headers?: Record<string, string>;
}) {
  const body = opts.body ?? '';
  const headers = new Headers(opts.headers ?? {});
  return {
    text:    async () => body,
    json:    async () => JSON.parse(body),
    headers: {
      get: (name: string) => headers.get(name),
    },
  };
}

// ── POST /api/billing/checkout ──────────────────────────────────────────────

describe('[PA-BILLING] POST /api/billing/checkout', () => {
  it('401 when unauthenticated', async () => {
    sessionState.user = null;
    const { POST } = await import('@/app/api/billing/checkout/route');
    const res = await POST(mkNextRequest({}));
    expect(res.status).toBe(401);
    expect(stripeCalls).toHaveLength(0);
  });

  it('400 when user is already on Pro', async () => {
    sessionState.user = { _id: userIdPro, email: 'pro@x.com', plan: 'pro' };
    const { POST } = await import('@/app/api/billing/checkout/route');
    const res = await POST(mkNextRequest({}));
    expect(res.status).toBe(400);
    expect(stripeCalls).toHaveLength(0);
  });

  it('creates a Checkout Session for a Free user and returns its URL', async () => {
    sessionState.user = { _id: userIdFree, email: 'free@x.com', plan: 'free' };
    const { POST } = await import('@/app/api/billing/checkout/route');
    const res  = await POST(mkNextRequest({}));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.url).toMatch(/^https:\/\/checkout\.stripe\.com\//);

    const checkout = stripeCalls.find((c) => c.kind === 'checkout');
    expect(checkout.args.mode).toBe('subscription');
    expect(checkout.args.line_items[0].price).toBe('price_test_xyz');
    expect(checkout.args.customer_email).toBe('free@x.com');
    expect(checkout.args.client_reference_id).toBe(String(userIdFree));
    expect(checkout.args.metadata.userId).toBe(String(userIdFree));
    expect(checkout.args.success_url).toContain('upgrade=success');
    expect(checkout.args.cancel_url).toContain('upgrade=cancel');
  });

  it('500 if STRIPE_PRICE_ID is not configured', async () => {
    delete process.env.STRIPE_PRICE_ID;
    sessionState.user = { _id: userIdFree, email: 'free@x.com', plan: 'free' };
    const { POST } = await import('@/app/api/billing/checkout/route');
    const res = await POST(mkNextRequest({}));
    expect(res.status).toBe(500);
  });
});

// ── POST /api/billing/portal ─────────────────────────────────────────────────

describe('[PA-BILLING] POST /api/billing/portal', () => {
  it('401 when unauthenticated', async () => {
    sessionState.user = null;
    const { POST } = await import('@/app/api/billing/portal/route');
    const res = await POST(mkNextRequest({}));
    expect(res.status).toBe(401);
  });

  it('400 when the user has no Stripe customer id yet', async () => {
    sessionState.user = { _id: userIdFree, email: 'free@x.com', plan: 'free' };
    const { POST } = await import('@/app/api/billing/portal/route');
    const res = await POST(mkNextRequest({}));
    expect(res.status).toBe(400);
    expect(stripeCalls).toHaveLength(0);
  });

  it('creates a Billing Portal session for a Pro user', async () => {
    sessionState.user = {
      _id: userIdPro, email: 'pro@x.com', plan: 'pro',
      stripeCustomerId: 'cus_existing',
    };
    const { POST } = await import('@/app/api/billing/portal/route');
    const res  = await POST(mkNextRequest({}));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.url).toMatch(/^https:\/\/billing\.stripe\.com\//);
    const portal = stripeCalls.find((c) => c.kind === 'portal');
    expect(portal.args.customer).toBe('cus_existing');
    expect(portal.args.return_url).toContain('/dashboard');
  });
});

// ── POST /api/webhooks/stripe ────────────────────────────────────────────────

describe('[PA-BILLING] POST /api/webhooks/stripe', () => {
  it('400 when stripe-signature header is missing', async () => {
    const { POST } = await import('@/app/api/webhooks/stripe/route');
    const res = await POST(mkNextRequest({ body: '{}' }));
    expect(res.status).toBe(400);
    expect(stripeCalls).toHaveLength(0);
  });

  it('400 when the signature is invalid — no DB mutation', async () => {
    signatureBehaviour.valid = false;
    const { POST } = await import('@/app/api/webhooks/stripe/route');
    const res = await POST(mkNextRequest({
      body: '{"id":"evt_1","type":"checkout.session.completed"}',
      headers: { 'stripe-signature': 't=1,v1=bogus' },
    }));
    expect(res.status).toBe(400);

    const before = usersStore.find((u) => String(u._id) === String(userIdFree));
    expect(before.plan).toBe('free'); // unchanged
  });

  it('checkout.session.completed → user.plan flips to pro + IDs persisted', async () => {
    signatureBehaviour.event = {
      id: 'evt_checkout_1',
      type: 'checkout.session.completed',
      data: { object: {
        client_reference_id: String(userIdFree),
        customer: 'cus_abc',
        subscription: 'sub_xyz',
        metadata: { userId: String(userIdFree) },
      }},
    };
    const { POST } = await import('@/app/api/webhooks/stripe/route');
    const res = await POST(mkNextRequest({
      body: '{"id":"evt_checkout_1"}',
      headers: { 'stripe-signature': 't=1,v1=ok' },
    }));
    expect(res.status).toBe(200);

    const user = usersStore.find((u) => String(u._id) === String(userIdFree));
    expect(user.plan).toBe('pro');
    expect(user.stripeCustomerId).toBe('cus_abc');
    expect(user.stripeSubscriptionId).toBe('sub_xyz');
  });

  it('idempotency: duplicate event id is a no-op on the second delivery', async () => {
    signatureBehaviour.event = {
      id: 'evt_dup_1',
      type: 'checkout.session.completed',
      data: { object: {
        client_reference_id: String(userIdFree),
        customer: 'cus_abc',
        subscription: 'sub_xyz',
        metadata: {},
      }},
    };
    const { POST } = await import('@/app/api/webhooks/stripe/route');
    const first  = await POST(mkNextRequest({ body: '{}', headers: { 'stripe-signature': 'ok' } }));
    expect(first.status).toBe(200);

    // Simulate a downgrade between deliveries to prove the second is no-op.
    usersStore = usersStore.map((u) =>
      String(u._id) === String(userIdFree) ? { ...u, plan: 'free' } : u,
    );

    const second = await POST(mkNextRequest({ body: '{}', headers: { 'stripe-signature': 'ok' } }));
    expect(second.status).toBe(200);
    const data = await second.json();
    expect(data.duplicate).toBe(true);

    const user = usersStore.find((u) => String(u._id) === String(userIdFree));
    expect(user.plan).toBe('free'); // not flipped back — second delivery skipped
  });

  it('customer.subscription.updated active → pro', async () => {
    signatureBehaviour.event = {
      id: 'evt_sub_upd_active',
      type: 'customer.subscription.updated',
      data: { object: {
        id: 'sub_new',
        status: 'active',
        customer: 'cus_existing',
        metadata: { userId: String(userIdPro) },
      }},
    };
    const { POST } = await import('@/app/api/webhooks/stripe/route');
    const res = await POST(mkNextRequest({ body: '{}', headers: { 'stripe-signature': 'ok' } }));
    expect(res.status).toBe(200);
    const user = usersStore.find((u) => String(u._id) === String(userIdPro));
    expect(user.plan).toBe('pro');
    expect(user.stripeSubscriptionId).toBe('sub_new');
  });

  it('customer.subscription.updated past_due → downgrade to free', async () => {
    signatureBehaviour.event = {
      id: 'evt_sub_upd_pastdue',
      type: 'customer.subscription.updated',
      data: { object: {
        id: 'sub_existing',
        status: 'past_due',
        customer: 'cus_existing',
        metadata: { userId: String(userIdPro) },
      }},
    };
    const { POST } = await import('@/app/api/webhooks/stripe/route');
    const res = await POST(mkNextRequest({ body: '{}', headers: { 'stripe-signature': 'ok' } }));
    expect(res.status).toBe(200);
    const user = usersStore.find((u) => String(u._id) === String(userIdPro));
    expect(user.plan).toBe('free');
  });

  it('customer.subscription.deleted → plan free + clear subscriptionId', async () => {
    usersStore = usersStore.map((u) =>
      String(u._id) === String(userIdPro) ? { ...u, stripeSubscriptionId: 'sub_will_die' } : u,
    );
    signatureBehaviour.event = {
      id: 'evt_sub_del',
      type: 'customer.subscription.deleted',
      data: { object: {
        id: 'sub_will_die',
        status: 'canceled',
        customer: 'cus_existing',
        metadata: { userId: String(userIdPro) },
      }},
    };
    const { POST } = await import('@/app/api/webhooks/stripe/route');
    const res = await POST(mkNextRequest({ body: '{}', headers: { 'stripe-signature': 'ok' } }));
    expect(res.status).toBe(200);
    const user = usersStore.find((u) => String(u._id) === String(userIdPro));
    expect(user.plan).toBe('free');
    expect(user.stripeSubscriptionId).toBeUndefined();
  });

  it('subscription event with no metadata.userId falls back to stripeCustomerId lookup', async () => {
    signatureBehaviour.event = {
      id: 'evt_sub_fallback',
      type: 'customer.subscription.updated',
      data: { object: {
        id: 'sub_x',
        status: 'active',
        customer: 'cus_existing',
        metadata: {},
      }},
    };
    const { POST } = await import('@/app/api/webhooks/stripe/route');
    const res = await POST(mkNextRequest({ body: '{}', headers: { 'stripe-signature': 'ok' } }));
    expect(res.status).toBe(200);
    const user = usersStore.find((u) => String(u._id) === String(userIdPro));
    expect(user.plan).toBe('pro');
  });

  it('unhandled event types are acknowledged 200 without mutation', async () => {
    signatureBehaviour.event = {
      id: 'evt_misc',
      type: 'customer.created',
      data: { object: { id: 'cus_new' } },
    };
    const { POST } = await import('@/app/api/webhooks/stripe/route');
    const res = await POST(mkNextRequest({ body: '{}', headers: { 'stripe-signature': 'ok' } }));
    expect(res.status).toBe(200);
    expect(usersStore.find((u) => String(u._id) === String(userIdFree)).plan).toBe('free');
  });
});
