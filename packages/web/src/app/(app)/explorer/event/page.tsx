/**
 * /explorer/event?id=<mongo_id> — Etapa 13
 * Decoded event page: name, args, link to tx, link to contract.
 * Uses query param ?id= to identify the event document.
 */
import type { Metadata }  from 'next';
import { notFound }       from 'next/navigation';
import { getDb }          from '@/lib/db';
import { EventDetailClient } from './EventDetailClient';

interface Props { searchParams: Promise<{ id?: string; txHash?: string; name?: string }> }

function ser<T>(v: T): T {
  return JSON.parse(JSON.stringify(v, (_k, val) => {
    if (val && typeof val === 'object' && val.constructor?.name === 'ObjectId') return String(val);
    if (val instanceof Date) return val.toISOString();
    return val;
  }));
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { name, id } = await searchParams;
  const evName = name ?? id ?? 'Event';
  return {
    title: `${evName} · Event · Kryndel Explorer`,
    description: `Decoded event ${evName} — args, topic0, contract, and delivery pipeline on XRPL EVM.`,
  };
}

export default async function EventExplorerPage({ searchParams }: Props) {
  const { id, txHash, name: evName } = await searchParams;
  const db = await getDb();

  let event: Record<string, unknown> | null = null;

  // Strategy 1: fetch by MongoDB _id
  if (id) {
    try {
      const { ObjectId } = await import('mongodb');
      event = await db.collection('events').findOne({ _id: new ObjectId(id) }) as Record<string, unknown> | null;
    } catch { /* invalid ObjectId */ }
  }

  // Strategy 2: fetch by txHash + optional event name
  if (!event && txHash) {
    const q: Record<string, unknown> = {
      $or: [{ txHash }, { transactionHash: txHash }]
    };
    if (evName) q.name = evName;
    event = await db.collection('events').findOne(q, { sort: { logIndex: 1 } }) as Record<string, unknown> | null;
  }

  if (!event) notFound();

  const contractAddr = (event.contractAddress ?? event.contract ?? '') as string;

  // Matched alert rules for this event's contract + event name
  const alertRules = contractAddr
    ? await db.collection('alert_rules')
        .find({
          $or: [{ contract: contractAddr.toLowerCase() }, { contract: contractAddr }],
          event: event.name,
          active: true,
        })
        .limit(5)
        .toArray()
    : [];

  return (
    <EventDetailClient
      event={ser(event) as Record<string, unknown>}
      alertRules={ser(alertRules) as Record<string, unknown>[]}
    />
  );
}
