/**
 * Next.js instrumentation hook — runs once at server startup (Node.js runtime).
 * We use it to ensure MongoDB indexes exist before any request is served.
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run in the Node.js runtime, not in the Edge runtime.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Skip during build (MONGODB_URI may not be set in CI build step).
    if (!process.env.MONGODB_URI) return;
    try {
      const { ensureIndexes } = await import('./lib/db.js');
      await ensureIndexes();
    } catch (err) {
      // Non-fatal: app still starts, but indexes may be missing.
      console.error('[kryndel] instrumentation: ensureIndexes failed', err);
    }
  }
}
