/**
 * /dashboard — user's watched contracts.
 * Server Component: fetches data directly from MongoDB.
 */
import { redirect }   from 'next/navigation';
import { auth }       from '@/auth';
import { getDb }      from '@/lib/db';
import { usersCollection, PLAN_LIMITS, type Plan } from '@/lib/models/index';
import type { Metadata } from 'next';

export const dynamic  = 'force-dynamic';
export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');

  const users    = await usersCollection();
  const user     = await users.findOne({ email: session.user.email.toLowerCase() });
  if (!user) redirect('/login');

  const db        = await getDb();
  const contracts = await db.collection('contracts')
    .find({ userId: user._id })
    .sort({ createdAt: -1 })
    .toArray();

  // B4: narrow plan to the union before indexing PLAN_LIMITS
  const plan: Plan = user.plan === 'pro' ? 'pro' : 'free';
  const limits = PLAN_LIMITS[plan];
  const atLimit = contracts.length >= limits.maxContracts;

  return (
    <main style={{ maxWidth: 800, margin: '2rem auto', padding: '0 1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Dashboard</h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--muted)' }}>
            {session.user.email} · <span style={{ textTransform: 'uppercase', fontSize: '0.75rem', color: 'var(--accent)' }}>{plan}</span>
            {' '}· {contracts.length}/{limits.maxContracts} contracts
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {!atLimit && (
            <a href="/dashboard/add-contract"
               style={{ padding: '0.5rem 1rem', background: 'var(--accent)', color: '#0f172a', borderRadius: 4, fontWeight: 700, fontSize: '0.875rem', textDecoration: 'none' }}>
              + Add contract
            </a>
          )}
          <form action="/api/auth/signout" method="post">
            <button style={{ padding: '0.5rem 0.75rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--muted)', fontSize: '0.8125rem', cursor: 'pointer' }}>
              Sign out
            </button>
          </form>
        </div>
      </div>

      {/* Plan limit warning */}
      {atLimit && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#78350f22', border: '1px solid #92400e', borderRadius: 6, fontSize: '0.875rem', color: '#fcd34d' }}>
          You&apos;ve reached the Free plan limit ({limits.maxContracts} contracts).
          {' '}<a href="#" style={{ color: 'var(--accent)' }}>Upgrade to Pro</a> for up to {PLAN_LIMITS.pro.maxContracts}.
        </div>
      )}

      {/* Contracts list */}
      {contracts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', border: '1px dashed var(--border)', borderRadius: 8, color: 'var(--muted)' }}>
          <p style={{ margin: 0 }}>No contracts yet.</p>
          <a href="/dashboard/add-contract"
             style={{ display: 'inline-block', marginTop: '1rem', padding: '0.5rem 1rem', background: 'var(--accent)', color: '#0f172a', borderRadius: 4, fontWeight: 700, textDecoration: 'none', fontSize: '0.875rem' }}>
            Watch your first contract →
          </a>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {contracts.map((c) => (
            <div key={String(c._id)}
                 style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '0.875rem', color: 'var(--text)' }}>
                  {c.name ?? c.address}
                </div>
                <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--muted)' }}>
                  <span style={{ textTransform: 'uppercase', marginRight: '0.5rem' }}>{String(c.surface)}</span>
                  <code style={{ fontFamily: 'var(--mono)', fontSize: '0.7rem' }}>{String(c.address)}</code>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <a href={`/dashboard/rules?contract=${encodeURIComponent(String(c.address))}`}
                   style={{ padding: '0.375rem 0.625rem', fontSize: '0.8125rem', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--muted)', textDecoration: 'none' }}>
                  Rules
                </a>
                <a href={`/contract/${encodeURIComponent(String(c.address))}`}
                   style={{ padding: '0.375rem 0.625rem', fontSize: '0.8125rem', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--muted)', textDecoration: 'none' }}>
                  Explorer →
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
