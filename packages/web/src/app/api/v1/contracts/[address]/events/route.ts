/**
 * GET /api/v1/contracts/[address]/events
 * Query: page=1, limit=50, surface=evm|native
 * Applies historyCutoff per plan.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { withApiKey }       from '@/lib/v1-middleware';
import { getDb }            from '@/lib/db';
import { historyCutoff }    from '@/lib/models/user';

export const dynamic = 'force-dynamic';

export function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  return withApiKey(req, async (ctx) => {
    const { address } = await params;
    const url     = new URL(req.url);
    const page    = Math.max(1, parseInt(url.searchParams.get('page')  ?? '1', 10));
    const limit   = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '50', 10)));
    const surface = url.searchParams.get('surface') ?? undefined;

    const db = await getDb();

    // Verify contract belongs to this user
    const contractFilter: Record<string, unknown> = { userId: ctx.userId, address: address.toLowerCase() };
    if (surface && ['evm', 'native'].includes(surface)) contractFilter.surface = surface;

    const contract = await db.collection('contracts').findOne(contractFilter);
    if (!contract) {
      return NextResponse.json({ error: { message: 'Contract not found.', code: 'NOT_FOUND' } }, { status: 404 });
    }

    const cutoff = historyCutoff(ctx.user.plan);
    const skip   = (page - 1) * limit;

    const eventsFilter: Record<string, unknown> = {
      contractAddress: address.toLowerCase(),
      createdAt:       { $gte: cutoff },
    };

    const [events, total] = await Promise.all([
      db.collection('events')
        .find(eventsFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection('events').countDocuments(eventsFilter),
    ]);

    return NextResponse.json({
      data: events,
      pagination: { page, limit, total, hasMore: skip + events.length < total },
    });
  });
}
