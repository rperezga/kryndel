/**
 * Stripe client + helpers — server-only.
 *
 * Created on first import; module-level singleton so we don't open a new
 * HTTP agent on every Lambda invocation. apiVersion pinned per Stripe's
 * recommended practice — bumps are intentional.
 */
import Stripe from 'stripe';

const SECRET = process.env.STRIPE_SECRET_KEY;

let _client: Stripe | null = null;

export function getStripe(): Stripe {
  if (_client) return _client;
  if (!SECRET) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  _client = new Stripe(SECRET, {
    apiVersion: '2025-02-24.acacia',
    appInfo: {
      name:    'Kryndel Cloud',
      version: '0.2.x',
      url:     'https://kryndel.vercel.app',
    },
  });
  return _client;
}

/** Centralised base URL — Vercel injects NEXTAUTH_URL (or AUTH_URL). */
export function appBaseUrl(): string {
  return (
    process.env.NEXTAUTH_URL
    ?? process.env.AUTH_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)
    ?? 'http://localhost:3000'
  );
}
