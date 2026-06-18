/**
 * /dashboard/api-keys — API key management page.
 *
 * Server Component — fetches data, renders the key list.
 * Create form lives in CreateKeyForm.tsx (Client Component with useActionState)
 * so the generated raw key can be shown once in the UI.
 * Revoke uses a plain form action (returns void → compatible with Server Component).
 */
import type { Metadata }    from 'next';
import { redirect }         from 'next/navigation';
import { auth }             from '@/auth';
import { getDb }            from '@/lib/db';
import { usersCollection }  from '@/lib/models/index';
import { CreateKeyForm }    from './CreateKeyForm';
import { revokeApiKey }     from './actions';

export const dynamic  = 'force-dynamic';
export const metadata: Metadata = { title: 'API Keys — Kryndel' };

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
        Use API keys to authenticate requests to the Kryndel REST API v1.{' '}
        <a href="/api/v1/openapi.json" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
          View API spec →
        </a>
      </p>

      {!isPro && (
        <div style={{
          background: 'var(--accent-dim, #1a1a2e)',
          border: '1px solid var(--accent)',
          borderRadius: 8,
          padding: '1rem',
          marginBottom: '1.5rem',
        }}>
          <strong>Upgrade to Pro</strong> to create API keys and access the REST API.{' '}
          <a href="/dashboard?upgrade=1" style={{ color: 'var(--accent)' }}>Upgrade now →</a>
        </div>
      )}

      {/* Create form — Client Component (needs useActionState to show raw key) */}
      {isPro && <CreateKeyForm />}

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
                <td style={{ padding: '0.5rem' }}>{k.name as string}</td>
                <td style={{ padding: '0.5rem', fontFamily: 'monospace' }}>{k.keyPrefix as string}</td>
                <td style={{ padding: '0.5rem', color: 'var(--muted)' }}>
                  {k.lastUsedAt ? new Date(k.lastUsedAt as Date).toLocaleDateString() : 'Never'}
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
