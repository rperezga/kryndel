'use client';
/**
 * Client-side buttons that POST to /api/billing/checkout or /api/billing/portal
 * and redirect to the URL Stripe returned. Used in /dashboard.
 */
import { useState } from 'react';

interface Props {
  plan: 'free' | 'pro';
}

async function postAndRedirect(endpoint: string): Promise<string | undefined> {
  const res  = await fetch(endpoint, { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return data.error ?? 'Could not start billing flow.';
  if (data.url) window.location.assign(data.url);
}

export default function BillingButtons({ plan }: Props) {
  const [pending, setPending] = useState<'checkout' | 'portal' | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  async function click(kind: 'checkout' | 'portal') {
    setPending(kind); setError(null);
    const endpoint = kind === 'checkout' ? '/api/billing/checkout' : '/api/billing/portal';
    const msg = await postAndRedirect(endpoint);
    if (msg) setError(msg);
    setPending(null);
  }

  if (plan === 'free') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
        <button
          onClick={() => click('checkout')}
          disabled={pending !== null}
          style={{ padding: '0.5rem 1rem', background: 'var(--accent)', color: '#0f172a', border: 'none', borderRadius: 4, fontWeight: 700, fontSize: '0.875rem', cursor: pending ? 'wait' : 'pointer' }}
        >
          {pending === 'checkout' ? 'Loading…' : 'Upgrade to Pro · $19/mo'}
        </button>
        {error && <span style={{ fontSize: '0.75rem', color: '#fca5a5' }}>{error}</span>}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
      <button
        onClick={() => click('portal')}
        disabled={pending !== null}
        style={{ padding: '0.5rem 0.75rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--muted)', fontSize: '0.8125rem', cursor: pending ? 'wait' : 'pointer' }}
      >
        {pending === 'portal' ? 'Loading…' : 'Manage subscription'}
      </button>
      {error && <span style={{ fontSize: '0.75rem', color: '#fca5a5' }}>{error}</span>}
    </div>
  );
}
