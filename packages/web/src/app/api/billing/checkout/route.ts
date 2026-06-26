/**
 * POST /api/billing/checkout
 *
 * Creates a Stripe Checkout Session for the "Kryndel Pro" subscription
 * ($19.99/mo). Returns { url } — the client redirects to that URL.
 *
 * Security:
 *   • requireUser() — anonymous requests rejected.
 *   • client_reference_id stamps the user._id so the webhook can look up
 *     the user even if `customer_email` is changed during checkout.
 *   • metadata.userId is set for belt-and-braces lookup.
 *   • success/cancel URLs are derived server-side (cannot be tampered).
 *
 * STRIPE_PRICE_ID must be the recurring Price for Kryndel Pro.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/current-user';
import { getStripe, appBaseUrl } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch (e) { return e as Response; }

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    return NextResponse.json({ error: 'STRIPE_PRICE_ID not configured.' }, { status: 500 });
  }

  if (user.plan === 'pro') {
    return NextResponse.json({ error: 'You are already on Pro.' }, { status: 400 });
  }

  const stripe  = getStripe();
  const baseUrl = appBaseUrl();
  const userIdStr = String(user._id);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email,
      client_reference_id: userIdStr,
      metadata: { userId: userIdStr },
      subscription_data: { metadata: { userId: userIdStr } },
      allow_promotion_codes: true,
      success_url: `${baseUrl}/dashboard?upgrade=success`,
      cancel_url:  `${baseUrl}/dashboard?upgrade=cancel`,
    });

    if (!session.url) {
      return NextResponse.json({ error: 'Stripe did not return a session URL.' }, { status: 502 });
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[billing/checkout] error:', err);
    return NextResponse.json({ error: 'Could not create checkout session.' }, { status: 500 });
  }
}

export async function GET(_req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch (e) { return e as Response; }

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    return NextResponse.json({ error: 'STRIPE_PRICE_ID not configured.' }, { status: 500 });
  }

  if (user.plan === 'pro') {
    return NextResponse.redirect(new URL('/dashboard', _req.url));
  }

  const stripe  = getStripe();
  const baseUrl = appBaseUrl();
  const userIdStr = String(user._id);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email,
      client_reference_id: userIdStr,
      metadata: { userId: userIdStr },
      subscription_data: { metadata: { userId: userIdStr } },
      allow_promotion_codes: true,
      success_url: `${baseUrl}/dashboard?upgrade=success`,
      cancel_url:  `${baseUrl}/dashboard?upgrade=cancel`,
    });

    if (!session.url) {
      return NextResponse.json({ error: 'Stripe did not return a session URL.' }, { status: 502 });
    }
    return NextResponse.redirect(session.url);
  } catch (err) {
    console.error('[billing/checkout] error:', err);
    return NextResponse.json({ error: 'Could not create checkout session.' }, { status: 500 });
  }
}

