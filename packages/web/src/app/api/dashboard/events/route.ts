import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/current-user';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  // Fetch recent events matching user's contracts
  const events = await db
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

  return NextResponse.json({ events });
}
