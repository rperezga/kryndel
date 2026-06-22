/**
 * /explorer/address/[address] — Etapa 13
 * RSC: address summary, recent activity (events + calls), link to contract if indexed.
 */
import type { Metadata }    from 'next';
import { notFound }         from 'next/navigation';
import { validateAddress }  from '@/lib/validate';
import { getDb }            from '@/lib/db';
import { AddressClient }    from './AddressClient';

interface Props { params: Promise<{ address: string }> }

function ser<T>(v: T): T {
  return JSON.parse(JSON.stringify(v, (_k, val) => {
    if (val && typeof val === 'object' && val.constructor?.name === 'ObjectId') return String(val);
    if (val instanceof Date) return val.toISOString();
    return val;
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address } = await params;
  if (!validateAddress(address)) return { title: 'Address not found' };
  const short = address.slice(0, 10) + '…';
  return {
    title: `${short} · Address · Kryndel Explorer`,
    description: `Recent activity, events and calls for address ${address} on XRPL EVM Sidechain.`,
  };
}

export default async function AddressExplorerPage({ params }: Props) {
  const { address } = await params;

  if (!validateAddress(address)) notFound();

  const addrLow = address.toLowerCase();
  const db      = await getDb();

  // Check if this address is an indexed contract
  const contract = await db.collection('contracts').findOne({
    $or: [{ address: addrLow }, { address }],
  });

  // Recent events FROM or TO this address
  const events = await db.collection('events')
    .find({
      $or: [
        { contract: addrLow   }, { contract: address },
        { contractAddress: addrLow }, { contractAddress: address },
        // Also check args fields for from/to
        { 'args.from': addrLow }, { 'args.to': addrLow },
      ],
    })
    .sort({ indexedAt: -1 })
    .limit(30)
    .toArray();

  // Recent calls
  const calls = await db.collection('calls')
    .find({
      $or: [{ contract: addrLow }, { contract: address }],
    })
    .sort({ indexedAt: -1 })
    .limit(20)
    .toArray();

  // Recent traces (by contractAddress)
  const traces = await db.collection('traces')
    .find({
      $or: [
        { contractAddress: addrLow }, { contractAddress: address }
      ],
    })
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();

  const totalEvents = await db.collection('events').countDocuments({
    $or: [{ contract: addrLow }, { contractAddress: addrLow }],
  });

  return (
    <AddressClient
      address={address}
      contract={ser(contract ?? null) as Record<string, unknown> | null}
      events={ser(events) as Record<string, unknown>[]}
      calls={ser(calls) as Record<string, unknown>[]}
      traces={ser(traces) as Record<string, unknown>[]}
      totalEventsCount={totalEvents}
    />
  );
}
