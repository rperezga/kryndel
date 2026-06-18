/**
 * GET /api/v1/contracts -- list user's contracts (API key auth).
 * Query: page=1 (1-based), limit=50 (max 100)
 */
import { type NextRequest, NextResponse } from 'next/server';
import { withApiKey }   from '@/lib/v1-middleware';
import { getDb }        from '@/lib/db';

export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
  return withApiKey(req, async (ctx) => {
    const url   = new URL(req.url);
    const page  = Math.max(1, parseInt(url.searchParams.get('page')  ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '50', 10)));

    const db   = await getDb();
    const skip = (page - 1) * limit;

    const [contracts, total] = await Promise.all([
      db.collection('contracts')
        .find({ userId: ctx.userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection('contracts').countDocuments({ userId: ctx.userId }),
    ]);

    return NextResponse.json({
      data: contracts,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + contracts.length < total,
      },
    });
  });
}
