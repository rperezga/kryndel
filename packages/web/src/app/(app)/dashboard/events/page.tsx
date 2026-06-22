import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/current-user';
import { getDb } from '@/lib/db';
import { STANDARD_EVENT_NAMES } from '@kryndel/core';
import { EventsClient } from './EventsClient';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Live Events Stream · Kryndel' };

export default async function EventsPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const db = await getDb();

  // 1. Fetch user's monitored contracts
  const contracts = await db
    .collection('contracts')
    .find({ userId: user._id })
    .sort({ createdAt: -1 })
    .toArray();

  // 2. Pre-map contracts with their standard + custom ABI event names lists
  const mappedContracts = contracts.map((c) => {
    const abiEventNames: string[] = [];
    if (Array.isArray(c.abi)) {
      for (const entry of c.abi as unknown[]) {
        if (
          entry &&
          typeof entry === 'object' &&
          !Array.isArray(entry) &&
          (entry as Record<string, unknown>).type === 'event' &&
          typeof (entry as Record<string, unknown>).name === 'string'
        ) {
          const n = ((entry as Record<string, unknown>).name as string).trim();
          if (n) abiEventNames.push(n);
        }
      }
    }
    const knownEvents = [...new Set([...abiEventNames, ...STANDARD_EVENT_NAMES])].sort();
    return {
      _id: String(c._id),
      address: c.address,
      name: c.name,
      surface: c.surface as 'evm' | 'native',
      knownEvents,
      hasAbi: !!c.abi,
    };
  });

  // Get unique union of all known event names across user's contracts
  const allKnownEvents = [...new Set([
    ...mappedContracts.flatMap((c) => c.knownEvents),
    ...STANDARD_EVENT_NAMES
  ])].sort();

  // 3. Fetch initial events scoped to user contracts
  const userAddresses = contracts.map((c) => c.address.toLowerCase());
  let initialEvents: any[] = [];
  if (userAddresses.length > 0) {
    initialEvents = await db
      .collection('events')
      .find({
        $or: [
          { contractAddress: { $in: userAddresses } },
          { contract: { $in: userAddresses } },
        ],
      })
      .sort({ indexedAt: -1 })
      .limit(50)
      .toArray();
  }

  const serializeMongo = (val: any) => JSON.parse(JSON.stringify(val));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-ds-sans text-2xl font-bold tracking-tight text-ds-text">Live Events</h1>
        <p className="font-ds-mono text-xs text-ds-text-3 mt-1">
          Real-time activity and events stream across all your monitored contracts
        </p>
      </div>

      <EventsClient
        initialEvents={serializeMongo(initialEvents)}
        contracts={mappedContracts}
        knownEventNames={allKnownEvents}
      />
    </div>
  );
}
