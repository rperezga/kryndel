/**
 * /dashboard/add-contract — form to register a new contract.
 * Uses a Server Action to call the API route directly.
 */
import { redirect }  from 'next/navigation';
import { auth }      from '@/auth';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Add contract' };

export default async function AddContractPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  async function addContract(formData: FormData) {
    'use server';
    const address = (formData.get('address') as string ?? '').trim().toLowerCase();
    const surface = (formData.get('surface') as string) ?? 'evm';
    const name    = (formData.get('name')    as string ?? '').trim();

    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/contracts`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json',
                 // Forward cookie from session for auth — Next.js Server Actions
                 // run on the server so we need a different auth path.
                 // We use the session email directly to identify the user.
                 'x-kryndel-server-action': '1' },
      body: JSON.stringify({ address, surface, name }),
    });

    if (res.ok) redirect('/dashboard');
    // On error, redirect back with error param
    const data = await res.json() as { error?: string };
    redirect(`/dashboard/add-contract?error=${encodeURIComponent(data.error ?? 'Unknown error')}`);
  }

  return (
    <main style={{ maxWidth: 500, margin: '2rem auto', padding: '0 1rem' }}>
      <a href="/dashboard" style={{ fontSize: '0.8125rem', color: 'var(--muted)', textDecoration: 'none' }}>← Dashboard</a>
      <h1 style={{ marginTop: '1rem', fontSize: '1.25rem' }}>Add contract</h1>
      <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
        Enter the contract address to start watching it. Kryndel will index all events and let you set alert rules.
      </p>

      <form action={addContract} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <label style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>Contract address</label>
          <input name="address" type="text" required placeholder="0x… or r…"
            style={{ padding: '0.625rem 0.75rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: '0.875rem' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <label style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>Network</label>
          <select name="surface"
            style={{ padding: '0.625rem 0.75rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', fontSize: '0.875rem' }}>
            <option value="evm">XRPL EVM Sidechain (mainnet)</option>
            <option value="native">XLS-0101 Native (AlphaNet)</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <label style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>Label <span style={{ color: 'var(--muted2)' }}>(optional)</span></label>
          <input name="name" type="text" placeholder="e.g. WXRP staking contract"
            style={{ padding: '0.625rem 0.75rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', fontSize: '0.875rem' }} />
        </div>

        <button type="submit"
          style={{ padding: '0.625rem', background: 'var(--accent)', color: '#0f172a', border: 'none', borderRadius: 4, fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer', marginTop: '0.5rem' }}>
          Start watching →
        </button>
      </form>
    </main>
  );
}
