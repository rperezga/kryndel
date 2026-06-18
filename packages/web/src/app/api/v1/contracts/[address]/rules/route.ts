/**
 * GET /api/v1/contracts/[address]/rules
 * Returns user's rules for the specified contract.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { withApiKey } from '@/lib/v1-middleware';
import { getDb }      from '@/lib/db';

export const dynamic = 'force-dynamic';

export function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  return withApiKey(req, async (ctx) => {
    const { address } = await params;
    const db = await getDb();

    // Verify contract ownership first
    const contract = await db.collection('contracts').findOne({
      userId: ctx.userId,
      address: address.toLowerCase(),
    });
    if (!contract) {
      return NextResponse.json({ error: { message: 'Contract not found.', code: 'NOT_FOUND' } }, { status: 404 });
    }

    const rules = await db.collection('alert_rules')
      .find({ userId: ctx.userId, contractAddress: address.toLowerCase() })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ data: rules });
  });
}
