/**
 * /explorer — public contract explorer, inside the (app) shell so it shares the
 * app header + sidebar + bottom-nav with the rest of the dashboard (consistent layout).
 * Same data fetching as before; ExplorerHomeClient handles all UI (DS tokens).
 */
import type { Metadata } from 'next';
import { getDb } from '@/lib/db';
import { ExplorerHomeClient } from './ExplorerHomeClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Explorer — Kryndel',
  description: 'Search and explore XRPL EVM Sidechain contracts — decode calls, trace events, set alerts.',
  openGraph: {
    title: 'Kryndel Explorer — XRPL Smart Contract Explorer',
    description: 'Search any EVM Sidechain contract address or tx hash to decode calls, trace events and see real-time activity.',
    url: 'https://kryndel.dev/explorer',
    type: 'website',
  },
};

function ser<T>(v: T): T {
  return JSON.parse(JSON.stringify(v, (_k, val) => {
    if (val && typeof val === 'object' && val.constructor?.name === 'ObjectId') return String(val);
    if (val instanceof Date) return val.toISOString();
    return val;
  }));
}

export default async function ExplorerPage() {
  const db = await getDb();

  const latestEvents = await db.collection('events').find({}).sort({ indexedAt: -1 }).limit(20).toArray();
  const latestTraces = await db.collection('traces').find({}).sort({ createdAt: -1 }).limit(10).toArray();
  const latestCalls  = await db.collection('calls').find({}).sort({ indexedAt: -1 }).limit(10).toArray();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'Kryndel Explorer',
          applicationCategory: 'DeveloperApplication',
          url: 'https://kryndel.dev/explorer',
          description: 'X-ray your XRPL contracts — decode calls, trace events and set real-time alerts.',
          operatingSystem: 'Web',
        }) }}
      />
      <div className="max-w-5xl mx-auto w-full">
        <ExplorerHomeClient
          latestEvents={ser(latestEvents)}
          latestTraces={ser(latestTraces)}
          latestCalls={ser(latestCalls)}
        />
      </div>
    </>
  );
}
