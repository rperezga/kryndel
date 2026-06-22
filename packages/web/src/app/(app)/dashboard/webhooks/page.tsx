import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/current-user';
import { getDb } from '@/lib/db';
import { PLAN_LIMITS, type Plan } from '@/lib/models/user';
import { WebhooksClient } from './WebhooksClient';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Outbound Webhooks · Kryndel' };

export default async function WebhooksPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const db = await getDb();

  // 1. Fetch active webhook endpoints
  const endpoints = await db
    .collection('webhook_endpoints')
    .find({ userId: user._id, active: true })
    .sort({ createdAt: -1 })
    .toArray();

  // 2. Fetch recent webhook deliveries
  const deliveries = await db
    .collection('webhook_deliveries')
    .find({ userId: user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();

  // 3. Fetch user monitored contracts
  const contracts = await db
    .collection('contracts')
    .find({ userId: user._id })
    .sort({ createdAt: -1 })
    .toArray();

  const mappedContracts = contracts.map((c) => ({
    _id: String(c._id),
    address: c.address,
    name: c.name,
    surface: c.surface as 'evm' | 'native',
  }));

  const plan: Plan = user.plan === 'pro' ? 'pro' : 'free';
  const limits = PLAN_LIMITS[plan];

  const serializeMongo = (val: any) => JSON.parse(JSON.stringify(val));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-ds-sans text-2xl font-bold tracking-tight text-ds-text">Outbound Webhooks</h1>
        <p className="font-ds-mono text-xs text-ds-text-3 mt-1">
          Deliver signed contract activity payloads to your servers in real-time
        </p>
      </div>

      <WebhooksClient
        initialEndpoints={serializeMongo(endpoints)}
        initialDeliveries={serializeMongo(deliveries)}
        contracts={mappedContracts}
        plan={plan}
        limits={limits}
      />
    </div>
  );
}
