import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/current-user';
import { getDb } from '@/lib/db';
import { PLAN_LIMITS, type Plan } from '@/lib/models/user';
import { STANDARD_EVENT_NAMES } from '@kryndel/core';
import { RulesClient } from './RulesClient';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Alert Rules · Kryndel' };

export default async function RulesPage({
  searchParams,
}: {
  searchParams: Promise<{ contract?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/login');

  const { contract: contractFilter } = await searchParams;

  const db = await getDb();

  // 1. Fetch user alert rules
  const rules = await db.collection('alert_rules')
    .find({ userId: user._id })
    .sort({ createdAt: -1 })
    .toArray();

  // 2. Fetch user watched contracts
  const contracts = await db.collection('contracts')
    .find({ userId: user._id })
    .sort({ createdAt: -1 })
    .toArray();

  // 3. Pre-map contracts with their standard + custom ABI event names lists
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

  const plan: Plan = user.plan === 'pro' ? 'pro' : 'free';
  const limits = PLAN_LIMITS[plan];

  const serializeMongo = (val: any) => JSON.parse(JSON.stringify(val));

  return (
    <div className="space-y-6">
      <RulesClient
        initialRules={serializeMongo(rules)}
        contracts={mappedContracts}
        initialContractFilter={contractFilter || 'all'}
        limits={limits}
        plan={plan}
      />
    </div>
  );
}
