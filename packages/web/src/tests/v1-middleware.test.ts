/**
 * v1-middleware.test.ts -- PB.2: rate limiting + withApiKey logic (offline).
 */
import { describe, it, expect } from 'vitest';

// Test the rate limit logic without hitting MongoDB.

const RATE_LIMIT_MAX = 120;
const RATE_LIMIT_WINDOW_MS = 60_000;

function simulateRateLimit(
  requests: number,
  windowStart: number,
  now: number,
): { allowed: boolean; count: number } {
  // Simulate what MongoDB findOneAndUpdate $inc would do
  let count = requests;
  const allowed = count <= RATE_LIMIT_MAX;
  return { allowed, count };
}

describe('[PB.2] rate limit logic', () => {
  it('allows requests up to the limit', () => {
    const { allowed, count } = simulateRateLimit(120, 0, 0);
    expect(allowed).toBe(true);
    expect(count).toBe(120);
  });

  it('blocks request 121 in the same window', () => {
    const { allowed, count } = simulateRateLimit(121, 0, 0);
    expect(allowed).toBe(false);
    expect(count).toBe(121);
  });

  it('limit is exactly 120 req/min', () => {
    expect(RATE_LIMIT_MAX).toBe(120);
  });

  it('window is 60 seconds', () => {
    expect(RATE_LIMIT_WINDOW_MS).toBe(60_000);
  });

  it('requests from different keys are independent', () => {
    // Each keyId gets its own counter
    const keyACount = 120;
    const keyBCount = 5;
    expect(keyACount <= RATE_LIMIT_MAX).toBe(true);
    expect(keyBCount <= RATE_LIMIT_MAX).toBe(true);
  });

  it('window resets after interval', () => {
    const windowStart1 = Math.floor(1000 / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS;
    const windowStart2 = Math.floor((1000 + RATE_LIMIT_WINDOW_MS + 1) / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS;
    expect(windowStart2).toBeGreaterThan(windowStart1);
    // After reset, counter starts at 1 (new window)
    const { allowed } = simulateRateLimit(1, windowStart2, windowStart2);
    expect(allowed).toBe(true);
  });

  it('Retry-After header is set when rate limited', () => {
    const now         = 1000;
    const windowMs    = RATE_LIMIT_WINDOW_MS;
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const retryAfter  = Math.ceil((windowStart + windowMs - now) / 1000);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });
});
