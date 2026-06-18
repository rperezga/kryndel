/**
 * GET /api/v1/me -- user info + plan + limits.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { withApiKey }    from '@/lib/v1-middleware';
import { getDb }         from '@/lib/db';
import { PLAN_LIMITS }   from '@/lib/models/user';

export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
  return withApiKey(req, async (ctx) => {
    const db = await getDb();

    const [contracts, rules] = await Promise.all([
      db.collection('contracts').countDocuments({ userId: ctx.userId }),
      db.collection('alert_rules').countDocuments({ userId: ctx.userId }),
    ]);

    return NextResponse.json({
      plan:      ctx.user.plan,
      limits:    PLAN_LIMITS[ctx.user.plan],
      contracts,
      rules,
    });
  });
}
