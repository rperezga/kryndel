/**
 * GET /api/v1/events
 * Query: page=1, limit=50, address=0x...(optional), event=Transfer(optional)
 * All contracts of the user. Applies historyCutoff per plan.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { withApiKey }    from '@/lib/v1-middleware';
import { getDb }         from '@/lib/db';
import { historyCutoff } from '@/lib/models/user';

export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
  return withApiKey(req, async (ctx) => {
    const url       = new URL(req.url);
    const page      = Math.max(1, parseInt(url.searchParams.get('page')  ?? '1', 10));
    const limit     = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '50', 10)));
    const address   = url.searchParams.get('address')?.toLowerCase();
    const eventName = url.searchParams.get('event');

    const db = await getDb();

    // Get all of the user's contracts to filter events
    const userContracts = await db.collection('contracts')
      .find({ userId: ctx.userId })
      .project({ address: 1 })
      .toArray();

    const userAddresses = userContracts.map((c: { address?: string }) => c.address as string);

    if (userAddresses.length === 0) {
      return NextResponse.json({
        data: [],
        pagination: { page, limit, total: 0, hasMore: false },
      });
    }

    const cutoff = historyCutoff(ctx.user.plan);
    const filter: Record<string, unknown> = {
      contractAddress: address
        ? address
        : { $in: userAddresses },
      createdAt: { $gte: cutoff },
    };

    // If address provided, verify it belongs to this user
    if (address && !userAddresses.includes(address)) {
      return NextResponse.json({
        data: [],
        pagination: { page, limit, total: 0, hasMore: false },
      });
    }

    if (eventName) filter.name = eventName;

    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      db.collection('events')
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection('events').countDocuments(filter),
    ]);

    return NextResponse.json({
      data: events,
      pagination: { page, limit, total, hasMore: skip + events.length < total },
    });
  });
}
