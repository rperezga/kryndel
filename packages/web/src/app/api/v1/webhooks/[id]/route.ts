/**
 * DELETE /api/v1/webhooks/[id]  -- soft-delete (active = false)
 */
import { type NextRequest, NextResponse } from 'next/server';
import { ObjectId }    from 'mongodb';
import { withApiKey }  from '@/lib/v1-middleware';
import { getDb }       from '@/lib/db';

export const dynamic = 'force-dynamic';

export function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiKey(req, async (ctx) => {
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: { message: 'Invalid id.', code: 'VALIDATION_ERROR' } }, { status: 400 });
    }

    const db     = await getDb();
    const result = await db.collection('webhook_endpoints').updateOne(
      { _id: new ObjectId(id), userId: ctx.userId },
      { $set: { active: false } },
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: { message: 'Not found.', code: 'NOT_FOUND' } }, { status: 404 });
    }

    return NextResponse.json({ deleted: true });
  });
}
