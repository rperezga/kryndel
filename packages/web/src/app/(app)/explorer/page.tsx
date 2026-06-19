import type { Metadata } from 'next';
import SearchForm from '@/app/SearchForm';

export const metadata: Metadata = {
  title: 'Explorer',
  description: 'Search and explore XRPL EVM Sidechain and XLS-0101 contracts — decode calls, trace events, set alerts.',
  openGraph: {
    title: 'Kryndel Explorer — XRPL Smart Contract Explorer',
    description: 'Search any EVM Sidechain or XLS-0101 contract address to decode calls, trace events and see real-time activity.',
    url: 'https://kryndel.dev/explorer',
    type: 'website',
  },
};

export default function ExplorerPage() {
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
        Try:{' '}
        <code style={{ fontFamily: 'var(--mono)', color: 'var(--muted)' }}>0xe4c3ee…</code>{' '}
        on EVM Sidechain or a native XLS-0101{' '}
        <code style={{ fontFamily: 'var(--mono)', color: 'var(--muted)' }}>r…</code> address
      </p>
    </div>
  );
}
