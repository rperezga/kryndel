/**
 * /dashboard/api-keys -- API key management page.
 * Server Component + Server Actions (pattern from existing dashboard).
 * Pro only -- Free users see upgrade banner.
 */
'use server';

import { redirect }          from 'next/navigation';
import { revalidatePath }    from 'next/cache';
import { auth }              from '@/auth';
import { getDb }             from '@/lib/db';
import { usersCollection }   from '@/lib/models/index';
import { generateRawKey, hashKey, keyPrefix } from '@/lib/models/api-key';
import { ObjectId }          from 'mongodb';
import type { Metadata }     from 'next';

export const dynamic  = 'force-dynamic';
export const metadata: Metadata = { title: 'API Keys' };

const MAX_KEYS = 5;

// ── Server Actions ────────────────────────────────────────────────────────────

async function createApiKey(formData: FormData): Promise<{ error?: string; rawKey?: string }> {
  'use server';
  const session = await auth();
  if (!session?.user?.email) return { error: 'Unauthorized' };

  const users = await usersCollection();
  const user  = await users.findOne({ email: session.user.email.toLowerCase() });
  if (!user) return { error: 'Unauthorized' };
  if (user.plan !== 'pro') return { error: 'Pro plan required.' };

  const name = String(formData.get('name') ?? '').trim().slice(0, 80);
  if (!name) return { error: 'Name is required.' };

  const db    = await getDb();
  const count = await db.collection('api_keys').countDocuments({ userId: user._id, active: true });
  if (count >= MAX_KEYS) return { error: `Maximum ${MAX_KEYS} API keys reached.` };

  const rawKey = generateRawKey();
  await db.collection('api_keys').insertOne({
    userId:    user._id,
    name,
    keyHash:   hashKey(rawKey),
    keyPrefix: keyPrefix(rawKey),
    active:    true,
    createdAt: new Date(),
  });

  revalidatePath('/dashboard/api-keys');
  return { rawKey };
}

async function revokeApiKey(formData: FormData): Promise<void> {
  'use server';
  const session = await auth();
  if (!session?.user?.email) return;

  const users = await usersCollection();
  const user  = await users.findOne({ email: session.user.email.toLowerCase() });
  if (!user) return;

  const id = String(formData.get('id') ?? '');
  if (!ObjectId.isValid(id)) return;

  const db = await getDb();
  await db.collection('api_keys').updateOne(
    { _id: new ObjectId(id), userId: user._id },
    { $set: { active: false } },
  );

  revalidatePath('/dashboard/api-keys');
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ApiKeysPage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');

  const users = await usersCollection();
  const user  = await users.findOne({ email: session.user.email.toLowerCase() });
  if (!user) redirect('/login');

  const db   = await getDb();
  const keys = await db
    .collection('api_keys')
    .find({ userId: user._id })
    .sort({ createdAt: -1 })
    .toArray();

  const isPro = user.plan === 'pro';

  return (
    <main style={{ maxWidth: 800, margin: '2rem auto', padding: '0 1rem' }}>
      <h1 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>API Keys</h1>
      <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        Use API keys to authenticate requests to the Kryndel REST API v1.
      </p>

      {!isPro && (
        <div style={{
          background: 'var(--accent-dim, #1a1a2e)',
          border: '1px solid var(--accent)',
          borderRadius: 8,
          padding: '1rem',
          marginBottom: '1.5rem',
        }}>
          <strong>Upgrade to Pro</strong> to use the API.{' '}
          <a href="/dashboard?upgrade=1" style={{ color: 'var(--accent)' }}>Upgrade now →</a>
        </div>
      )}

      {isPro && (
        <form action={createApiKey} style={{ marginBottom: '2rem', display: 'flex', gap: '0.5rem' }}>
          <input
            name="name"
            placeholder="Key name (e.g. production, ci-bot)"
            required
            style={{
              flex: 1,
              padding: '0.5rem 0.75rem',
              borderRadius: 6,
              border: '1px solid var(--border, #333)',
              background: 'var(--bg-card, #111)',
              color: 'inherit',
            }}
          />
          <button type="submit" style={{
            padding: '0.5rem 1rem',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}>
            Create API Key
          </button>
        </form>
      )}

      {keys.length === 0 && isPro && (
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
          No API keys yet. Create one above.
        </p>
      )}

      {keys.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border, #333)', textAlign: 'left' }}>
              <th style={{ padding: '0.5rem' }}>Name</th>
              <th style={{ padding: '0.5rem' }}>Prefix</th>
              <th style={{ padding: '0.5rem' }}>Last used</th>
              <th style={{ padding: '0.5rem' }}>Status</th>
              <th style={{ padding: '0.5rem' }}></th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={String(k._id)} style={{ borderBottom: '1px solid var(--border, #222)' }}>
                <td style={{ padding: '0.5rem' }}>{k.name}</td>
                <td style={{ padding: '0.5rem', fontFamily: 'monospace' }}>{k.keyPrefix}</td>
                <td style={{ padding: '0.5rem', color: 'var(--muted)' }}>
                  {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}
                </td>
                <td style={{ padding: '0.5rem' }}>
                  <span style={{ color: k.active ? 'var(--accent)' : 'var(--muted)' }}>
                    {k.active ? 'Active' : 'Revoked'}
                  </span>
                </td>
                <td style={{ padding: '0.5rem' }}>
                  {k.active && (
                    <form action={revokeApiKey} style={{ display: 'inline' }}>
                      <input type="hidden" name="id" value={String(k._id)} />
                      <button
                        type="submit"
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--border, #333)',
                          borderRadius: 4,
                          padding: '0.25rem 0.5rem',
                          cursor: 'pointer',
                          color: 'var(--muted)',
                          fontSize: '0.8125rem',
                        }}
                      >
                        Revoke
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: '2rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>
        <a href="/dashboard" style={{ color: 'var(--accent)' }}>← Back to dashboard</a>
      </div>
    </main>
  );
}
