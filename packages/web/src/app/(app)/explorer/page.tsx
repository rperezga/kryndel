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
  const suggestions = [
    '0xe4c3ee653d7861cf236b2bea4bdb2a261231ea67',
    'r3kmCwWFa5rvPTh4K3L689254d1ab',
  ];

  return (
    <div className="home-hero">
      <h1>
        X-ray your <em>XRPL contracts</em>
      </h1>
      <p>
        Decode calls, trace events and set alerts for EVM Sidechain &amp; native XRPL contracts (XLS-0101).
      </p>
      <SearchForm suggestions={suggestions} />
    </div>
  );
}

