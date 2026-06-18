/**
 * GET /api/v1/webhooks/[id]/deliveries -- last 50 deliveries for an endpoint.
 * Verifies endpoint belongs to the authenticated user.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { ObjectId }    from 'mongodb';
import { withApiKey }  from '@/lib/v1-middleware';
import { getDb }       from '@/lib/db';

export const dynamic = 'force-dynamic';

export function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiKey(req, async (ctx) => {
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: { message: 'Invalid id.', code: 'VALIDATION_ERROR' } }, { status: 400 });
    }

    const db = await getDb();

    // Verify ownership
    const endpoint = await db.collection('webhook_endpoints').findOne({
      _id:    new ObjectId(id),
      userId: ctx.userId,
    });

    if (!endpoint) {
      return NextResponse.json({ error: { message: 'Not found.', code: 'NOT_FOUND' } }, { status: 404 });
    }

    const deliveries = await db.collection('webhook_deliveries')
      .find({ endpointId: new ObjectId(id), userId: ctx.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json({ data: deliveries });
  });
}
