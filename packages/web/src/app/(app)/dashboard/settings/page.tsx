/**
 * /dashboard/settings — Etapa 11 re-skin
 *
 * RSC: fetches user + api_keys + webhook endpoints, serialises and passes to
 * SettingsClient (tab shell). No new @kryndel/core imports — UI pura.
 */
import type { Metadata } from 'next';
import { redirect }      from 'next/navigation';
import { auth }          from '@/auth';
import { getDb }         from '@/lib/db';
import { usersCollection } from '@/lib/models/index';
import { PLAN_LIMITS }   from '@/lib/models/user';
import { SettingsClient } from './SettingsClient';

export const dynamic  = 'force-dynamic';
export const metadata: Metadata = { title: 'Settings — Kryndel' };

// ── Serialise helpers (MongoDB ObjectId / Date → plain JS) ───────────────────

function serializeDoc<T extends Record<string, unknown>>(doc: T): Record<string, unknown> {
  return JSON.parse(JSON.stringify(doc, (_key, value) => {
    if (value && typeof value === 'object' && value.constructor?.name === 'ObjectId') {
      return String(value);
    }
    if (value instanceof Date) return value.toISOString();
    return value;
  }));
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');

  const users = await usersCollection();
  const user  = await users.findOne({ email: session.user.email.toLowerCase() });
  if (!user) redirect('/login');

  const db   = await getDb();

  // API keys
  const keys = await db
    .collection('api_keys')
    .find({ userId: user._id })
    .sort({ createdAt: -1 })
    .toArray();

  // Webhook endpoints
  const endpoints = await db
    .collection('webhook_endpoints')
    .find({ userId: user._id })
    .sort({ createdAt: -1 })
    .toArray();

  const plan   = (user.plan ?? 'free') as 'free' | 'pro';
  const limits = PLAN_LIMITS[plan];

  return (
    <SettingsClient
      email={user.email}
      plan={plan}
      createdAt={user.createdAt instanceof Date ? user.createdAt.toISOString() : String(user.createdAt)}
      limits={limits}
      hasStripe={!!user.stripeCustomerId}
      apiKeys={keys.map(k => serializeDoc(k as unknown as Record<string, unknown>))}
      webhookEndpoints={endpoints.map(e => serializeDoc(e as unknown as Record<string, unknown>))}
    />
  );
}
