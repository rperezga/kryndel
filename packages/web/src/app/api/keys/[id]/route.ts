/**
 * DELETE /api/keys/[id]  -- revoke API key (soft-delete: active = false)
 *
 * Session-auth. Verifies key belongs to current user.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { requireUser } from '@/lib/current-user';
import { getDb }       from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let user;
  try { user = await requireUser(); } catch (e) { return e as Response; }

  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: { message: 'Invalid key id.' } }, { status: 400 });
  }

  const db     = await getDb();
  const result = await db.collection('api_keys').updateOne(
    { _id: new ObjectId(id), userId: user._id },
    { $set: { active: false } },
  );

  if (result.matchedCount === 0) {
    return NextResponse.json({ error: { message: 'Not found.' } }, { status: 404 });
  }

  return NextResponse.json({ revoked: true });
}
