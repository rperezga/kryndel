import type { Metadata } from 'next';
import SearchForm from './SearchForm';

export const metadata: Metadata = { title: 'Kryndel Explorer' };

export default function HomePage() {
  return (
    <div className="home-hero">
      <h1>
        X-ray your <em>XRPL contracts</em>
      </h1>
      <p>
        Decode calls, trace events and set alerts for EVM Sidechain &amp; native XRPL contracts (XLS-0101).
      </p>
      <SearchForm />
      <p style={{ marginTop: '1rem', fontSize: '.8rem', color: 'var(--muted2)' }}>
        Try: <code style={{ fontFamily: 'var(--mono)', color: 'var(--muted)' }}>0xe4c3ee…</code> on EVM Sidechain
        or a native XLS-0101 <code style={{ fontFamily: 'var(--mono)', color: 'var(--muted)' }}>r…</code> address
      </p>
    </div>
  );
}
