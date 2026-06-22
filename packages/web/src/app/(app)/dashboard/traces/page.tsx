import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/current-user';
import { getDb } from '@/lib/db';
import { TracesClient } from './TracesClient';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Tx Traces · Kryndel' };

function serializeDoc(doc: any): any {
  return JSON.parse(JSON.stringify(doc, (_k, v) => {
    if (v && typeof v === 'object' && v._bsontype === 'ObjectId') return v.toString();
    if (v instanceof Date) return v.toISOString();
    return v;
  }));
}

export default async function TracesPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const db = await getDb();

  // Fetch stored traces for this user, most recent first
  const rawTraces = await db
    .collection('traces')
    .find({ userId: user._id })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();

  const traces = rawTraces.map((t) => serializeDoc({
    id:              t._id?.toString() ?? String(t.txHash),
    txHash:          t.txHash as string,
    contractAddress: (t.contractAddress as string) ?? '—',
    method:          (t.method as string) ?? 'unknown',
    status:          (t.status as 'success' | 'reverted') ?? 'reverted',
    blockNumber:     t.blockNumber ?? null,
    surface:         (t.surface as 'evm' | 'native') ?? 'evm',
    durationMs:      t.durationMs ?? 0,
    createdAt:       t.createdAt ? new Date(t.createdAt).toISOString() : null,
  }));

  // Fetch user contracts for context (contract name lookup)
  const contracts = await db
    .collection('contracts')
    .find({ userId: user._id })
    .toArray();

  const contractNames: Record<string, string> = {};
  for (const c of contracts) {
    if (c.address && c.name) contractNames[(c.address as string).toLowerCase()] = c.name as string;
  }

  return (
    <TracesClient
      traces={traces}
      contractNames={contractNames}
    />
  );
}
