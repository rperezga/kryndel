/**
 * rate-limit — fixed-window limiter keyed by an arbitrary string (e.g. a client
 * IP for public, unauthenticated endpoints like the /decode tool).
 *
 * Backed by the `rate_limit_windows` collection, mirroring the v1 API limiter
 * (lib/v1-middleware.ts) but keyed by `rlKey` instead of an API keyId so the two
 * never collide. Fails OPEN: if the DB check errors, the request is allowed
 * (availability over strict enforcement for a free public tool).
 */
import { getDb } from './db';

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterS: number;
}

export async function rateLimit(
  key: string,
  opts: { max?: number; windowMs?: number } = {},
): Promise<RateLimitResult> {
  const max = opts.max ?? 15;
  const windowMs = opts.windowMs ?? 60_000;

  try {
    const db = await getDb();
    const now = Date.now();
    const windowStart = new Date(Math.floor(now / windowMs) * windowMs);

    const result = await db.collection('rate_limit_windows').findOneAndUpdate(
      { rlKey: key, windowStart },
      {
        $inc: { count: 1 },
        $setOnInsert: { rlKey: key, windowStart, createdAt: new Date() },
      },
      { upsert: true, returnDocument: 'after' },
    );

    const count = (result as { count?: number } | null)?.count ?? 1;
    const remaining = Math.max(0, max - count);
    const retryAfterS = Math.max(
      1,
      Math.ceil((windowStart.getTime() + windowMs - now) / 1000),
    );
    return { ok: count <= max, remaining, retryAfterS };
  } catch (err) {
    console.error('[rate-limit] check failed (fail-open):', err);
    return { ok: true, remaining: 1, retryAfterS: 0 };
  }
}

/**
 * Extract a best-effort client IP from forwarded headers (Vercel sets these).
 * Accepts anything header-like (Web `Headers` or Next's `ReadonlyHeaders`).
 */
export function clientIpFrom(headerList: { get(name: string): string | null }): string {
  const fwd = headerList.get('x-forwarded-for') ?? '';
  const first = fwd.split(',')[0]?.trim();
  return first || headerList.get('x-real-ip') || 'unknown';
}
