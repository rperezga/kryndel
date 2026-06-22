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
  const deliveries = await db
    .collection('webhook_deliveries')
    .find({ userId: user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();

  return NextResponse.json({ deliveries });
}
