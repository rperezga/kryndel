/**
 * v1 API middleware -- wraps route handlers with API key auth + rate limiting.
 *
 * Rate limit: 120 req/min per keyId, using MongoDB collection
 * `rate_limit_windows` with TTL 120s. Pattern: findOneAndUpdate $inc + upsert.
 *
 * Usage:
 *   export const GET = (req: NextRequest) =>
 *     withApiKey(req, async (ctx) => { ... });
 */
import type { NextRequest } from 'next/server';
import type { ObjectId } from 'mongodb';
import { getDb }            from './db';
import { requireApiKey }    from './api-auth';
import type { ApiKeyContext } from './api-auth';

export type { ApiKeyContext };

// ── Rate limit config ─────────────────────────────────────────────────────────

const RATE_LIMIT_WINDOW_MS  = 60_000;  // 1 minute
const RATE_LIMIT_MAX        = 120;     // requests per window
const RATE_LIMIT_TTL_S      = 120;     // TTL for MongoDB docs (seconds)

// ── Main wrapper ──────────────────────────────────────────────────────────────

export async function withApiKey(
  req: NextRequest | Request,
  handler: (ctx: ApiKeyContext) => Promise<Response>,
): Promise<Response> {
  // 1. Authenticate
  let ctx: ApiKeyContext;
  try {
    ctx = await requireApiKey(req);
  } catch (e) {
    return e as Response;
  }

  // 2. Rate limit
  const rateLimitResponse = await checkRateLimit(ctx.keyId);
  if (rateLimitResponse) return rateLimitResponse;

  // 3. Delegate to handler
  return handler(ctx);
}

// ── Rate limit implementation ─────────────────────────────────────────────────

async function checkRateLimit(keyId: ObjectId): Promise<Response | null> {
  try {
    const db = await getDb();
    const now         = Date.now();
    const windowStart = new Date(Math.floor(now / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS);

    const result = await db.collection('rate_limit_windows').findOneAndUpdate(
      { keyId, windowStart },
      {
        $inc:         { count: 1 },
        $setOnInsert: { keyId, windowStart, createdAt: new Date() },
      },
      {
        upsert:         true,
        returnDocument: 'after',
      },
    );

    const count = (result as { count?: number } | null)?.count ?? 1;
    if (count > RATE_LIMIT_MAX) {
      return new Response(
        JSON.stringify({
          error: {
            message: `Rate limit exceeded: ${RATE_LIMIT_MAX} requests per minute.`,
            code:    'RATE_LIMIT_EXCEEDED',
          },
        }),
        {
          status:  429,
          headers: {
            'Content-Type':     'application/json',
            'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
            'Retry-After':       String(Math.ceil((windowStart.getTime() + RATE_LIMIT_WINDOW_MS - now) / 1000)),
          },
        },
      );
    }

    return null;
  } catch (err) {
    // Rate limit errors must not block requests -- fail open with warning
    console.error('[v1-middleware] rate limit check failed:', err);
    return null;
  }
}
