import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { currentUser } from '@/lib/current-user';
import { getDb } from '@/lib/db';
import { getIssuerSnapshotCached } from '@/lib/sentinel-cache';
import { PLAN_LIMITS, type Plan } from '@/lib/models/user';
import { SentinelClient } from './SentinelClient';
import type { IssuerSnapshot } from '@kryndel/core';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Sentinel · Token Health · Kryndel' };

export default async function SentinelDashboardPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const db = await getDb();
  const issuersRaw = await db
    .collection('issuers')
    .find({ userId: user._id })
    .sort({ createdAt: 1 })
    .toArray();

  const issuers = await Promise.all(
    issuersRaw.map(async (i) => {
      const address = String(i.address);
      let snapshot: IssuerSnapshot | null = null;
      try {
        snapshot = await getIssuerSnapshotCached(address);
      } catch {
        snapshot = null;
      }
      return {
        address,
        label: String(i.label ?? address),
        active: i.active !== false,
        snapshot,
      };
    }),
  );

  const plan: Plan = user.plan === 'pro' ? 'pro' : 'free';

  return <SentinelClient issuers={issuers} maxIssuers={PLAN_LIMITS[plan].maxIssuers} plan={plan} />;
}
