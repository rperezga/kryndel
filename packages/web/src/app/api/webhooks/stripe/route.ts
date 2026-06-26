/**
 * POST /api/webhooks/stripe
 *
 * Stripe → Kryndel webhook receiver.
 *
 * SECURITY — STRICT:
 *   • Signature is ALWAYS verified with stripe.webhooks.constructEvent.
 *     Missing or invalid signature → 400, NO mutation, NO log of secrets.
 *   • Raw body is read with `await req.text()` BEFORE any parsing —
 *     constructEvent needs the exact bytes Stripe signed.
 *   • Idempotency: every accepted event id is persisted in `stripe_events`
 *     with a unique index. Re-deliveries are skipped (Stripe retries on
 *     non-2xx, plus occasional duplicate at-least-once delivery).
 *   • We only act on events whose userId we can resolve from the event
 *     payload (client_reference_id / metadata / customer.subscriptions).
 *
 * EVENTS HANDLED:
 *   • checkout.session.completed   → users.plan = 'pro' + persist
 *                                    stripeCustomerId + stripeSubscriptionId.
 *   • customer.subscription.updated → 'active' / 'trialing' → 'pro';
 *                                     anything else → 'free'.
 *   • customer.subscription.deleted → plan = 'free' + clear subscriptionId.
 *   • invoice.payment_failed       → logged; Stripe handles dunning so we
 *                                    don't downgrade immediately.
 *   • Anything else → acknowledged with 200 (logged, no-op).
 *
 * Required env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getStripe } from '@/lib/stripe';
import { getDb } from '@/lib/db';
import type Stripe from 'stripe';

export const dynamic = 'force-dynamic';
// Stripe signature verification needs the Node runtime + unmodified raw body.
// Explicit (App Router routes already default to Node, but this prevents accidents).
export const runtime = 'nodejs';

/** Stripe will retry on 5xx; we use 400 only for verification failures. */
export async function POST(req: NextRequest) {
  const sig    = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    console.error('[stripe/webhook] STRIPE_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'misconfigured' }, { status: 500 });
  }
  if (!sig) {
    return NextResponse.json({ error: 'missing signature' }, { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    // Do not leak the secret or details to the caller.
    console.error('[stripe/webhook] signature verification failed:', err);
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  // Idempotency — Stripe may deliver the same event twice.
  const db = await getDb();
  try {
    await db.collection('stripe_events').insertOne({
      _id:        event.id as unknown as ObjectId, // use Stripe's id as _id
      type:       event.type,
      receivedAt: new Date(),
    } as any);
  } catch (err: any) {
    if (err?.code === 11000) {
      // Duplicate id — we already processed this event.
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error('[stripe/webhook] idempotency store error:', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }

  try {
    await handleEvent(event, db);
  } catch (err) {
    console.error(`[stripe/webhook] handler error for ${event.type}:`, err);
    // Don't delete the idempotency record — failing handlers shouldn't get
    // duplicate processing on retry. Return 500 so Stripe retries.
    return NextResponse.json({ error: 'handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ── Event handlers ──────────────────────────────────────────────────────────

async function handleEvent(event: Stripe.Event, db: Awaited<ReturnType<typeof getDb>>): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = resolveUserId(session.client_reference_id, session.metadata);
      if (!userId) {
        console.error('[stripe/webhook] checkout.session.completed without userId');
        return;
      }
      const customerId     = stringFromCustomer(session.customer);
      const subscriptionId = stringFromSubscription(session.subscription);
      await db.collection('users').updateOne(
        { _id: userId },
        {
          $set: {
            plan: 'pro',
            ...(customerId     ? { stripeCustomerId:     customerId }     : {}),
            ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
            updatedAt: new Date(),
          },
        },
      );
      return;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const userId = await resolveUserIdFromSubscription(sub, db);
      if (!userId) return;
      const isActive = sub.status === 'active' || sub.status === 'trialing';
      await db.collection('users').updateOne(
        { _id: userId },
        {
          $set: {
            plan: isActive ? 'pro' : 'free',
            stripeSubscriptionId: sub.id,
            updatedAt: new Date(),
          },
        },
      );
      return;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const userId = await resolveUserIdFromSubscription(sub, db);
      if (!userId) return;
      await db.collection('users').updateOne(
        { _id: userId },
        {
          $set:   { plan: 'free', updatedAt: new Date() },
          $unset: { stripeSubscriptionId: '' },
        },
      );
      return;
    }

    case 'invoice.payment_failed': {
      // Stripe handles dunning (3-4 retries over ~3 weeks). We don't
      // downgrade on the first failure — that comes via subscription.deleted
      // when Stripe finally gives up.
      console.warn(`[stripe/webhook] invoice payment failed: ${event.id}`);
      return;
    }

    default:
      // Unhandled event types are acknowledged silently.
      return;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function resolveUserId(
  clientRef: string | null | undefined,
  metadata:  Stripe.Metadata | null | undefined,
): ObjectId | null {
  const raw = clientRef ?? metadata?.userId ?? null;
  if (!raw) return null;
  try {
    return new ObjectId(raw);
  } catch {
    return null;
  }
}

async function resolveUserIdFromSubscription(
  sub: Stripe.Subscription,
  db:  Awaited<ReturnType<typeof getDb>>,
): Promise<ObjectId | null> {
  // 1. metadata.userId (set on Checkout)
  const fromMetadata = resolveUserId(null, sub.metadata);
  if (fromMetadata) return fromMetadata;
  // 2. Fall back to looking up the customer in our DB.
  const customerId = stringFromCustomer(sub.customer);
  if (!customerId) return null;
  const user = await db.collection('users').findOne({ stripeCustomerId: customerId });
  return user?._id ?? null;
}

function stringFromCustomer(c: Stripe.Subscription['customer'] | Stripe.Checkout.Session['customer']): string | null {
  if (!c) return null;
  return typeof c === 'string' ? c : c.id ?? null;
}

function stringFromSubscription(s: Stripe.Checkout.Session['subscription']): string | null {
  if (!s) return null;
  return typeof s === 'string' ? s : s.id ?? null;
}
