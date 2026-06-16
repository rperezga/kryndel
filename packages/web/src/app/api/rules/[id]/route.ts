/**
 * DELETE /api/rules/[id] — delete an alert rule
 * PATCH  /api/rules/[id] — toggle active state
 */
import { type NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/current-user.js';
import { getDb }       from '@/lib/db.js';
import { ObjectId }    from 'mongodb';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let user;
  try { user = await requireUser(); } catch (e) { return e as Response; }

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid rule id.' }, { status: 400 });
  }

  const db  = await getDb();
  const del = await db.collection('alert_rules').deleteOne({
    _id: new ObjectId(id), userId: user._id,
  });

  if (del.deletedCount === 0) {
    return NextResponse.json({ error: 'Rule not found.' }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let user;
  try { user = await requireUser(); } catch (e) { return e as Response; }

  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid rule id.' }, { status: 400 });
  }

  const { active } = await req.json().catch(() => ({})) as { active?: boolean };
  if (typeof active !== 'boolean') {
    return NextResponse.json({ error: '"active" boolean required.' }, { status: 400 });
  }

  const db  = await getDb();
  const res = await db.collection('alert_rules').updateOne(
    { _id: new ObjectId(id), userId: user._id },
    { $set: { active, updatedAt: new Date() } },
  );

  if (res.matchedCount === 0) {
    return NextResponse.json({ error: 'Rule not found.' }, { status: 404 });
  }
  return NextResponse.json({ updated: true });
}
