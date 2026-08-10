/**
 * Worker entry point -- Kali/PM2 24/7 process.
 *
 * Starts:
 * 1. Loopback HTTP server on PORT -- serves /healthz
 * 2. WatcherPool + reconcile loop
 * 3. Webhook retry loop (processRetries every 60s)
 *
 * Shutdown: SIGTERM/SIGINT -> stop watchers, close DB, exit 0.
 */
import { createServer } from 'node:http';
import { WatcherPool }       from './watcher-pool.js';
import { startReconcileLoop } from './reconcile.js';
import { closeDb, getDb }    from './db.js';
import { processRetries }    from './webhook-deliverer.js';
import { startSentinelLoop } from './sentinel-loop.js';
import { startHeartbeatLoop, getHeartbeatState } from './heartbeat.js';
import { startSentinelReportLoop } from './sentinel-report-job.js';

const PORT = parseInt(process.env.PORT ?? '8080', 10);
const WORKER_VERSION = '0.4.2';

// Seguridad: escuchar SOLO en loopback por defecto. El worker es OUTBOUND (Mongo Atlas,
// RPC/WS de XRPL, alertas Telegram/Resend); su único endpoint inbound es /healthz, que solo
// usaba el healthcheck de Railway. En el Kali (pm2, sin túnel) nadie más debe alcanzar el
// puerto: bindear a *:PORT lo exponía en todas las interfaces (incl. la IPv6 pública del host).
// Abrirlo tiene que ser un HOST=0.0.0.0 deliberado.
const HOST = process.env.HOST ?? '127.0.0.1';

// ── Required env check ────────────────────────────────────────────────────────

const REQUIRED_ENV = ['MONGODB_URI'] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[worker] Missing required env var: ${key}`);
    process.exit(1);
  }
}

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.warn('[worker] TELEGRAM_BOT_TOKEN not set -- Telegram alerts disabled');
}

// ── Pool + reconcile ──────────────────────────────────────────────────────────

const pool = new WatcherPool();
const stopReconcile = startReconcileLoop(pool);

// ── Sentinel: XRPL issuer security & health watcher ───────────────────────────

const stopSentinel = startSentinelLoop();

// ── Heartbeat: real indexer-health signal for the dashboard ───────────────────

const stopHeartbeat = startHeartbeatLoop(() => pool.size);

// ── Sentinel weekly report job (hourly check; emails each issuer owner every 7d) ─

const stopSentinelReport = startSentinelReportLoop();

// ── Webhook retry loop (60s interval) ─────────────────────────────────────────

let _retryLoopActive = true;

async function retryLoop(): Promise<void> {
  while (_retryLoopActive) {
    try {
      const db = await getDb();
      await processRetries(db);
    } catch (err) {
      console.error('[worker] retry loop error:', err);
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 60_000));
  }
}

void retryLoop();

// ── Health check HTTP server ──────────────────────────────────────────────────

const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/healthz') {
    const heartbeat = getHeartbeatState();
    const body = JSON.stringify({
      status:          'ok',
      build:           `worker-v${WORKER_VERSION}`,
      uptime:          process.uptime(),
      watchers:        pool.size,
      activeKeys:      pool.activeKeys,
      evmRpcEndpoint:  pool.evmRpcEndpoint ?? heartbeat.source,
      heartbeat,
      ts:              new Date().toISOString(),
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(body);
    return;
  }
  res.writeHead(404);
  res.end('not found');
});

server.listen(PORT, HOST, () => {
  console.log(`[worker] /healthz listening on ${HOST}:${PORT}`);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  console.log(`[worker] ${signal} received -- shutting down`);
  _retryLoopActive = false;
  stopReconcile();
  stopSentinel();
  stopHeartbeat();
  stopSentinelReport();
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

console.log(`[worker] started v${WORKER_VERSION}`);
