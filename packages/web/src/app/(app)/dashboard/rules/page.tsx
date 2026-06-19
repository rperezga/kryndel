/**
 * /dashboard/rules — manage alert rules for a contract.
 * Expects ?contract=<address> query param.
 *
 * 2026-06-17 PA-SMOKE fix: the Server Action used to call its own /api/rules
 * via internal fetch, which did NOT propagate the session cookie — every
 * submission returned 401 Unauthorized.  The action now lives in actions.ts
 * and does the auth check + MongoDB write directly.
 */
import { redirect }            from 'next/navigation';
import { auth }                from '@/auth';
import { getDb }               from '@/lib/db';
import { addRule }             from './actions';
import { usersCollection, PLAN_LIMITS, type Plan } from '@/lib/models/index';
import { STANDARD_EVENT_NAMES } from '@kryndel/core';
import type { Metadata }       from 'next';

export const dynamic  = 'force-dynamic';
export const metadata: Metadata = { title: 'Alert rules' };

export default async function RulesPage({
  searchParams,
}: {
  searchParams: Promise<{ contract?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');

  const { contract: contractAddress, error: pageError } = await searchParams;
  if (!contractAddress) redirect('/dashboard');

  const users = await usersCollection();
  const user  = await users.findOne({ email: session.user.email.toLowerCase() });
  if (!user) redirect('/login');

  const db       = await getDb();
  const contract = await db.collection('contracts').findOne({
    userId: user._id, address: contractAddress.toLowerCase(),
  });
  if (!contract) redirect('/dashboard');

  // Build known-events list from contract ABI (if uploaded) + standard registry
  const abiEventNames: string[] = [];
  if (Array.isArray(contract.abi)) {
    for (const entry of contract.abi as unknown[]) {
      if (
        entry && typeof entry === 'object' && !Array.isArray(entry) &&
        (entry as Record<string, unknown>).type === 'event' &&
        typeof (entry as Record<string, unknown>).name === 'string'
      ) {
        const n = ((entry as Record<string, unknown>).name as string).trim();
        if (n) abiEventNames.push(n);
      }
    }
  }
  const knownEvents = [...new Set([...abiEventNames, ...STANDARD_EVENT_NAMES])].sort();

  const rules = await db.collection('alert_rules')
    .find({ userId: user._id, contractAddress: contractAddress.toLowerCase() })
    .sort({ createdAt: -1 })
    .toArray();

  // B4: narrow plan to the union before indexing PLAN_LIMITS
  const plan: Plan = user.plan === 'pro' ? 'pro' : 'free';
  const limits     = PLAN_LIMITS[plan];
  const atRuleLimit = rules.length >= limits.maxRulesPerContract;

  // The Server Action expects the contract address as its first arg; bind it.
  const addRuleForThis = addRule.bind(null, contractAddress as string);

  return (
    <main style={{ maxWidth: 700, margin: '2rem auto', padding: '0 1rem' }}>
      <a href="/dashboard" style={{ fontSize: '0.8125rem', color: 'var(--muted)', textDecoration: 'none' }}>← Dashboard</a>

      <div style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Alert rules</h1>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
          {String(contract.name ?? contractAddress)}
        </p>
      </div>

      {/* Existing rules */}
      {rules.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>No rules yet. Add one below.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {rules.map((r) => (
            <div key={String(r._id)}
                 style={{ padding: '0.75rem 1rem', border: '1px solid var(--border)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem' }}>
              <span>
                <strong>{String(r.eventName)}</strong>
                {' → '}<span style={{ color: 'var(--muted)' }}>{String(r.channel)}</span>
                {' '}<code style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem', color: 'var(--muted)' }}>{String(r.target).slice(0, 20)}…</code>
              </span>
              <span style={{ fontSize: '0.75rem', color: r.active ? '#4ade80' : 'var(--muted)' }}>
                {r.active ? '● active' : '○ paused'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Error feedback from Server Action */}
      {pageError && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#7f1d1d22', border: '1px solid #991b1b', borderRadius: 6, fontSize: '0.875rem', color: '#fca5a5' }}>
          {pageError}
        </div>
      )}

      {/* Add rule form */}
      {!atRuleLimit ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '1rem' }}>
          <h2 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Add rule</h2>
          <form action={addRuleForThis} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

            {/* Event name — text input with datalist suggestions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>Event name</label>
              <input name="eventName" required list="known-events-list"
                placeholder="Transfer" type="text"
                style={{ padding: '0.5rem 0.625rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: '0.875rem' }} />
              <datalist id="known-events-list">
                {knownEvents.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              {abiEventNames.length > 0 && (
                <span style={{ fontSize: '0.75rem', color: '#4ade80' }}>
                  ✓ Custom ABI loaded — {abiEventNames.length} custom event(s) available
                </span>
              )}
            </div>

            {/* Telegram chat ID */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>Telegram chat ID</label>
              <input name="target" required placeholder="-100123456789" type="text"
                style={{ padding: '0.5rem 0.625rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: '0.875rem' }} />
            </div>

            {/* Optional arg filter */}
            <details style={{ fontSize: '0.8125rem' }}>
              <summary style={{ cursor: 'pointer', color: 'var(--muted)', userSelect: 'none' }}>
                Optional: filter by argument value
              </summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem', padding: '0.75rem', background: 'var(--bg)', borderRadius: 4, border: '1px solid var(--border)' }}>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--muted)' }}>
                  Alert only when a specific argument matches a condition.
                  Values must be in raw on-chain units (wei for amounts — no decimals applied).
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: '2 1 120px' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Argument name</label>
                    <input name="filterArgName" placeholder="value" type="text"
                      style={{ padding: '0.375rem 0.5rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: '0.8125rem' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: '1 1 60px' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Condition</label>
                    <select name="filterOp" defaultValue=">"
                      style={{ padding: '0.375rem 0.5rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', fontSize: '0.8125rem' }}>
                      <option value=">">{'>'} (greater than)</option>
                      <option value="<">{'<'} (less than)</option>
                      <option value=">=">{'>='} (≥)</option>
                      <option value="<=">{'<='} (≤)</option>
                      <option value="=">{'='} (equals)</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: '3 1 160px' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                      Value <span style={{ color: '#f59e0b' }}>(raw wei)</span>
                    </label>
                    <input name="filterValue" placeholder="1000000000000000000" type="text"
                      style={{ padding: '0.375rem 0.5rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: '0.8125rem' }} />
                  </div>
                </div>
              </div>
            </details>

            <button type="submit"
              style={{ padding: '0.5rem', background: 'var(--accent)', color: '#0f172a', border: 'none', borderRadius: 4, fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
              Create rule
            </button>
          </form>
        </div>
      ) : (
        <div style={{ padding: '0.75rem 1rem', background: '#78350f22', border: '1px solid #92400e', borderRadius: 6, fontSize: '0.875rem', color: '#fcd34d' }}>
          Free plan: {limits.maxRulesPerContract} rule per contract.
          {' '}<a href="#" style={{ color: 'var(--accent)' }}>Upgrade to Pro</a> for {PLAN_LIMITS.pro.maxRulesPerContract} rules/contract and more channels.
        </div>
      )}
    </main>
  );
}
