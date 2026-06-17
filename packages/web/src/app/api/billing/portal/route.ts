/**
 * POST /api/billing/portal
 *
 * Creates a Stripe Billing Portal session for the authenticated user so
 * they can manage card / cancel / view invoices on Stripe's hosted UI.
 * Returns { url } — client redirects there.
 *
 * Requires the user to have a Stripe customer on file (set by the webhook
 * when they first complete checkout). If they don't, returns 400 so the UI
 * can show "you don't have an active subscription".
 */
import { type NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/current-user';
import { getStripe, appBaseUrl } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest) {
  let user;
  try { user = await requireUser(); } catch (e) { return e as Response; }

  if (!user.stripeCustomerId) {
    return NextResponse.json(
      { error: 'No active subscription on this account.' },
      { status: 400 },
    );
  }

  const stripe  = getStripe();
  const baseUrl = appBaseUrl();

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer:    user.stripeCustomerId,
      return_url:  `${baseUrl}/dashboard`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[billing/portal] error:', err);
    return NextResponse.json({ error: 'Could not create portal session.' }, { status: 500 });
  }
}
