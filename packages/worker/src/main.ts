/**
 * Worker entry point — Railway 24/7 process.
 *
 * Starts:
 * 1. HTTP server on PORT (Railway injects this) — serves /healthz
 * 2. WatcherPool + reconcile loop
 *
 * Shutdown: SIGTERM/SIGINT → stop watchers, close DB, exit 0.
 */
import { createServer } from 'node:http';
import { WatcherPool } from './watcher-pool.js';
import { startReconcileLoop } from './reconcile.js';
import { closeDb } from './db.js';

const PORT = parseInt(process.env.PORT ?? '8080', 10);

// ── Required env check ────────────────────────────────────────────────────────

const REQUIRED_ENV = ['MONGODB_URI'] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[worker] Missing required env var: ${key}`);
    process.exit(1);
  }
}

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.warn('[worker] TELEGRAM_BOT_TOKEN not set — Telegram alerts disabled');
}

// ── Pool + reconcile ──────────────────────────────────────────────────────────

const pool = new WatcherPool();
const stopReconcile = startReconcileLoop(pool);

// ── Health check HTTP server ──────────────────────────────────────────────────

const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/healthz') {
    const body = JSON.stringify({
      status:       'ok',
      uptime:       process.uptime(),
      watchers:     pool.size,
      activeKeys:   pool.activeKeys,
      ts:           new Date().toISOString(),
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(body);
    return;
  }
  res.writeHead(404);
  res.end('not found');
});

server.listen(PORT, () => {
  console.log(`[worker] /healthz listening on :${PORT}`);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  console.log(`[worker] ${signal} received — shutting down`);
  stopReconcile();
  await pool.stopAll();
  await closeDb();
  server.close(() => {
    console.log('[worker] HTTP server closed');
    process.exit(0);
  });
  // Force exit after 10s if graceful shutdown hangs.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT',  () => void shutdown('SIGINT'));

console.log('[worker] started');
