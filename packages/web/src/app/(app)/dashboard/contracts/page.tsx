import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/current-user';
import { getDb } from '@/lib/db';
import { PLAN_LIMITS, type Plan } from '@/lib/models/user';
import { ContractsClient } from './ContractsClient';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Contracts Management · Kryndel' };

export default async function ContractsPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const db = await getDb();

  // 1. Fetch user contracts
  const contracts = await db
    .collection('contracts')
    .find({ userId: user._id })
    .sort({ createdAt: -1 })
    .toArray();

  const userAddresses = contracts.map((c) => c.address.toLowerCase());

  // 2. Fetch user's alert rules to calculate watched events
  const alertRules = await db
    .collection('alert_rules')
    .find({ userId: user._id })
    .toArray();

  // 3. Optimized bulk query for last activity and total event counts
  let eventCounts: Record<string, number> = {};
  let lastActivities: Record<string, string> = {};

  if (userAddresses.length > 0) {
    // Get total events indexed count per contract
    const counts = await db
      .collection('events')
      .aggregate([
        {
          $match: {
            $or: [
              { contractAddress: { $in: userAddresses } },
              { contract: { $in: userAddresses } },
            ],
          },
        },
        {
          $project: {
            address: {
              $cond: {
                if: { $in: ['$contractAddress', userAddresses] },
                then: '$contractAddress',
                else: '$contract',
              },
            },
          },
        },
        {
          $group: {
            _id: '$address',
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    for (const group of counts) {
      if (group._id) {
        eventCounts[group._id.toLowerCase()] = group.count;
      }
    }

    // Get latest indexed event/call date per contract address
    const [eventsList, callsList] = await Promise.all([
      db
        .collection('events')
        .find({
          $or: [
            { contractAddress: { $in: userAddresses } },
            { contract: { $in: userAddresses } },
          ],
        })
        .project({ contractAddress: 1, contract: 1, indexedAt: 1 })
        .sort({ indexedAt: -1 })
        .limit(100)
        .toArray(),
      db
        .collection('calls')
        .find({ contract: { $in: userAddresses } })
        .project({ contract: 1, indexedAt: 1 })
        .sort({ indexedAt: -1 })
        .limit(100)
        .toArray(),
    ]);

    // Compute latest activity per address
    const latestDates: Record<string, Date> = {};
    const trackDate = (addr: string, date: any) => {
      if (!addr || !date) return;
      const d = new Date(date);
      const key = addr.toLowerCase();
      if (!latestDates[key] || d > latestDates[key]) {
        latestDates[key] = d;
      }
    };

    for (const ev of eventsList) {
      trackDate(ev.contractAddress || ev.contract, ev.indexedAt);
    }
    for (const c of callsList) {
      trackDate(c.contract, c.indexedAt);
    }

    // Format relative time or keep as ISO/timestamp string for client formatting
    for (const [addr, date] of Object.entries(latestDates)) {
      lastActivities[addr] = date.toISOString();
    }
  }

  const plan: Plan = user.plan === 'pro' ? 'pro' : 'free';
  const limits = PLAN_LIMITS[plan];

  const serializeMongo = (val: any) => JSON.parse(JSON.stringify(val));

  return (
    <div className="space-y-6">
      <ContractsClient
        initialContracts={serializeMongo(contracts)}
        alertRules={serializeMongo(alertRules)}
        eventCounts={eventCounts}
        lastActivities={lastActivities}
        limits={limits}
        plan={plan}
      />
    </div>
  );
}
