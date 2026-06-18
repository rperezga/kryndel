/**
 * GET  /api/v1/webhooks  -- list user's webhook endpoints
 * POST /api/v1/webhooks  -- create outbound webhook (Pro via withApiKey)
 *
 * Security:
 *   - URL validated with assertSafePublicUrl from @/lib/ssrf
 *   - secret stored in plain text (Atlas encrypts at rest)
 *   - secret shown ONCE in creation response
 */
import { type NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes }        from 'node:crypto';
import { ObjectId }                       from 'mongodb';
import { withApiKey }                     from '@/lib/v1-middleware';
import { getDb }                          from '@/lib/db';
import { assertSafePublicUrl }            from '@/lib/ssrf';
import { toPublicWebhook }                from '@/lib/models/webhook';

export const dynamic = 'force-dynamic';

const MAX_WEBHOOKS = 10;

// ── GET ───────────────────────────────────────────────────────────────────────

export function GET(req: NextRequest) {
  return withApiKey(req, async (ctx) => {
    const db       = await getDb();
    const endpoints = await db
      .collection('webhook_endpoints')
      .find({ userId: ctx.userId })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({
      data: endpoints.map(toPublicWebhook as (ep: unknown) => unknown),
    });
  });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export function POST(req: NextRequest) {
  return withApiKey(req, async (ctx) => {
    const body = await req.json().catch(() => null) as {
      url?: string;
      description?: string;
      contractAddresses?: string[];
      eventNames?: string[];
    } | null;

    const url = String(body?.url ?? '').trim();
    if (!url) {
      return NextResponse.json(
        { error: { message: 'url is required.', code: 'VALIDATION_ERROR' } },
        { status: 400 },
      );
    }

    // SSRF protection
    try {
      await assertSafePublicUrl(url);
    } catch (err) {
      return NextResponse.json(
        { error: { message: (err as Error).message, code: 'INVALID_URL' } },
        { status: 400 },
      );
    }

    const db    = await getDb();
    const count = await db.collection('webhook_endpoints').countDocuments({
      userId: ctx.userId,
      active: true,
    });
    if (count >= MAX_WEBHOOKS) {
      return NextResponse.json(
        { error: { message: `Maximum ${MAX_WEBHOOKS} webhook endpoints per account.`, code: 'LIMIT_EXCEEDED' } },
        { status: 403 },
      );
    }

    // Generate HMAC secret (32 bytes -> 64 hex chars)
    const rawSecret    = randomBytes(32).toString('hex');
    const secretHash   = createHash('sha256').update(rawSecret).digest('hex');
    const secretPrefix = rawSecret.slice(0, 8);

    const description       = String(body?.description ?? '').trim().slice(0, 200) || undefined;
    const contractAddresses = Array.isArray(body?.contractAddresses)
      ? body!.contractAddresses.map((a: string) => String(a).toLowerCase())
      : [];
    const eventNames = Array.isArray(body?.eventNames)
      ? body!.eventNames.map((e: string) => String(e))
      : [];

    const now = new Date();
    const doc = {
      userId:             ctx.userId,
      url,
      secret:             rawSecret, // plain text -- Atlas encrypts at rest
      secretHash,
      secretPrefix,
      description,
      active:             true,
      createdAt:          now,
      contractAddresses:  contractAddresses.length ? contractAddresses : [],
      eventNames:         eventNames.length ? eventNames : [],
    };

    const result = await db.collection('webhook_endpoints').insertOne(doc);

    return NextResponse.json(
      {
        webhook: toPublicWebhook({ _id: result.insertedId, ...doc } as Parameters<typeof toPublicWebhook>[0]),
        secret:  rawSecret, // shown ONCE
      },
      { status: 201 },
    );
  });
}
