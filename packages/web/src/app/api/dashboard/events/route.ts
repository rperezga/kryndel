import { type NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/current-user';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const contractParam = url.searchParams.get('contract')?.toLowerCase();
  const eventParam = url.searchParams.get('event');
  const statusParam = url.searchParams.get('status');
  const rangeParam = url.searchParams.get('range');

  const db = await getDb();
  const userContracts = await db
    .collection('contracts')
    .find({ userId: user._id })
    .project({ address: 1 })
    .toArray();

  const userAddresses = userContracts.map((c) => c.address.toLowerCase());
  if (userAddresses.length === 0) {
    return NextResponse.json({ events: [] });
  }

  // Determine contract filter (isolate to user's contracts)
  let targetAddresses = userAddresses;
  if (contractParam && contractParam !== 'all') {
    if (userAddresses.includes(contractParam)) {
      targetAddresses = [contractParam];
    } else {
      // Trying to query contract not monitored by this user
      return NextResponse.json({ events: [] });
    }
  }

  // Base query: scoped to target contracts
  const query: Record<string, any> = {
    $or: [
      { contractAddress: { $in: targetAddresses } },
      { contract: { $in: targetAddresses } },
    ],
  };

  // Event name filter
  if (eventParam && eventParam !== 'all') {
    query.name = eventParam;
  }

  // Status filter (e.g. success, reverted)
  if (statusParam && statusParam !== 'all') {
    query.status = statusParam;
  }

  // Time range filter
  if (rangeParam && rangeParam !== 'all') {
    let cutoff: Date | null = null;
    const now = Date.now();
    if (rangeParam === '1h') {
      cutoff = new Date(now - 60 * 60 * 1000);
    } else if (rangeParam === '24h') {
      cutoff = new Date(now - 24 * 60 * 60 * 1000);
    } else if (rangeParam === '7d') {
      cutoff = new Date(now - 7 * 24 * 60 * 60 * 1000);
    }

    if (cutoff) {
      query.$and = [
        {
          $or: [
            { indexedAt: { $gte: cutoff } },
            { createdAt: { $gte: cutoff } }
          ]
        }
      ];
    }
  }

  // Fetch recent events matching user's contracts & filters
  const events = await db
    .collection('events')
    .find(query)
    .sort({ indexedAt: -1 })
    .limit(100)
    .toArray();

  return NextResponse.json({ events });
}
