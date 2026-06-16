/**
 * DELETE /api/contracts/[address] — remove a user's watched contract (and its rules)
 */
import { type NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/current-user.js';
import { getDb }       from '@/lib/db.js';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  let user;
  try { user = await requireUser(); } catch (e) { return e as Response; }

  const { address } = await params;
  const db = await getDb();

  // Delete the contract (only if owned by this user)
  const del = await db.collection('contracts').deleteOne({
    userId: user._id,
    address: address.toLowerCase(),
  });

  if (del.deletedCount === 0) {
    return NextResponse.json({ error: 'Contract not found.' }, { status: 404 });
  }

  // Cascade: delete all alert rules for this contract
  await db.collection('alert_rules').deleteMany({
    userId: user._id,
    contractAddress: address.toLowerCase(),
  });

  return NextResponse.json({ deleted: true });
}
