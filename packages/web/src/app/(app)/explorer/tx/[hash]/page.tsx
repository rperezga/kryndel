/**
 * /explorer/tx/[hash] — Etapa 13
 * RSC: fetches trace from DB (or runs traceEvmTx), renders TxExplorerClient.
 * Public explorer — no auth required to VIEW, but traceEvmTx called only if cached.
 */
import type { Metadata }      from 'next';
import { notFound }           from 'next/navigation';
import { getDb }              from '@/lib/db';
import { validateTxHash }     from '@/lib/validate';
import { TxExplorerClient }   from './TxExplorerClient';

interface Props { params: Promise<{ hash: string }> }

// ── Serialise ─────────────────────────────────────────────────────────────────

function ser<T>(v: T): T {
  return JSON.parse(JSON.stringify(v, (_k, val) => {
    if (val && typeof val === 'object' && val.constructor?.name === 'ObjectId') return String(val);
    if (val instanceof Date)   return val.toISOString();
    if (typeof val === 'bigint') return val.toString();
    return val;
  }));
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { hash } = await params;
  if (!validateTxHash(hash)) return { title: 'Transaction not found' };
  const short = hash.slice(0, 10) + '…' + hash.slice(-6);
  return {
    title: `${short} · Tx · Kryndel Explorer`,
    description: `Execution timeline, decoded logs and raw payload for XRPL EVM transaction ${hash}.`,
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TxExplorerPage({ params }: Props) {
  const { hash } = await params;

  if (!validateTxHash(hash)) notFound();

  const txHash = hash.toLowerCase();
  const db = await getDb();

  // Look up in traces collection — public, not userId-scoped
  const stored = await db.collection('traces').findOne(
    { txHash },
    { sort: { createdAt: -1 } }
  );

  // Decoded events for the "Logs" table (from events collection)
  const decodedEvents = await db.collection('events')
    .find({
      $or: [
        { txHash },
        { transactionHash: txHash },
      ]
    })
    .sort({ logIndex: 1 })
    .limit(50)
    .toArray();

  // Related alert rules that matched this tx (by contract)
  const contractAddress = (stored?.contractAddress ?? '') as string;
  let relatedRules: Record<string, unknown>[] = [];
  if (contractAddress) {
    relatedRules = await db.collection('alert_rules')
      .find({
        $or: [
          { contract: contractAddress.toLowerCase() },
          { contract: contractAddress },
        ],
        active: true,
      })
      .limit(10)
      .toArray() as unknown as Record<string, unknown>[];
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: `Transaction ${txHash}`,
          url: `https://kryndel.dev/explorer/tx/${txHash}`,
          description: `Execution timeline and decoded logs for XRPL EVM transaction ${txHash}.`,
        }) }}
      />
      <TxExplorerClient
        txHash={txHash}
        stored={ser(stored ?? null)}
        decodedEvents={ser(decodedEvents) as Record<string, unknown>[]}
        relatedRules={ser(relatedRules) as Record<string, unknown>[]}
      />
    </>
  );
}
