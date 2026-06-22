import { redirect, notFound } from 'next/navigation';
import { currentUser } from '@/lib/current-user';
import { getDb } from '@/lib/db';
import { traceEvmTx } from '@kryndel/core';
import { TraceDetailClient } from './TraceDetailClient';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ hash: string }>;
}

function sanitizeTxHash(raw: string): string {
  const h = raw.toLowerCase().trim();
  if (!/^0x[0-9a-f]{64}$/.test(h)) throw new Error('Invalid tx hash format');
  return h;
}

function serializeDoc(doc: any): any {
  return JSON.parse(JSON.stringify(doc, (_k, v) => {
    if (v && typeof v === 'object' && v._bsontype === 'ObjectId') return v.toString();
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'bigint') return v.toString();
    return v;
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { hash } = await params;
  const short = hash.slice(0, 10) + '…' + hash.slice(-6);
  return { title: `Trace ${short} · Kryndel` };
}

export default async function TraceDetailPage({ params }: Props) {
  const user = await currentUser();
  if (!user) redirect('/login');

  const { hash: rawHash } = await params;

  let txHash: string;
  try {
    txHash = sanitizeTxHash(rawHash);
  } catch {
    notFound();
  }

  const db = await getDb();
  const EVM_RPC_URL = process.env.EVM_RPC_URL ?? 'https://rpc.xrplevm.org';

  // 1. Try to load from cache
  let stored: any = await db.collection('traces').findOne(
    { userId: user._id, txHash },
    { sort: { createdAt: -1 } }
  );

  let traceError: string | null = null;

  // 2. If not cached, run traceEvmTx server-side
  if (!stored) {
    try {
      const trace = await traceEvmTx(txHash, { endpoint: EVM_RPC_URL });

      const call = trace.call;
      const method = call?.name ?? 'unknown';
      const contractAddress = trace.contract.address;
      const emitEvent = trace.events.find((e) => e.kind === 'emit');
      const txStatus = emitEvent?.label === 'tx_success' ? 'success' : 'reverted';
      const blockNumber = emitEvent?.data?.block ?? null;

      stored = {
        userId: user._id,
        txHash,
        contractAddress,
        method,
        status: txStatus,
        blockNumber,
        surface: 'evm',
        durationMs: trace.durationMs,
        trace,
        createdAt: new Date(),
      };
      await db.collection('traces').updateOne(
        { userId: user._id, txHash },
        { $set: stored },
        { upsert: true }
      );
    } catch (err) {
      traceError = err instanceof Error ? err.message : 'Trace failed';
    }
  }

  // 3. Load related alert rules for this contract
  const contractAddress = stored?.contractAddress ?? null;
  let relatedRules: any[] = [];
  if (contractAddress) {
    const rules = await db
      .collection('alert_rules')
      .find({ userId: user._id, contract: contractAddress.toLowerCase() })
      .toArray();
    relatedRules = rules.map((r) => serializeDoc({
      id: r._id.toString(),
      event: r.event,
      channel: r.channel,
      target: r.target,
      active: r.active,
    }));
  }

  // 4. Contract name lookup
  let contractName: string | null = null;
  if (contractAddress) {
    const contract = await db.collection('contracts').findOne({
      userId: user._id,
      address: contractAddress.toLowerCase(),
    });
    contractName = (contract?.name as string) ?? null;
  }

  const serializedStored = stored ? serializeDoc(stored) : null;

  return (
    <TraceDetailClient
      txHash={txHash}
      stored={serializedStored}
      traceError={traceError}
      relatedRules={relatedRules}
      contractName={contractName}
    />
  );
}
