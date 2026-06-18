/**
 * Cliente MongoDB para Next.js + worker — singleton cacheado.
 *
 * Pooling: maxPoolSize:10 / minPoolSize:1 para M0 (100 conexiones máx).
 * En serverless (Vercel) cada invocación crea su propio proceso; el singleton
 * evita conexiones múltiples dentro del mismo proceso en dev y en worker.
 *
 * Las variables de entorno sin prefijo NEXT_PUBLIC_ son server-only.
 *
 * NOTE: env guard is lazy (inside getDb) so pure model helpers (PLAN_LIMITS,
 * historyCutoff, etc.) can be imported in test environments without a real DB.
 */
import { MongoClient, type Db } from 'mongodb';

// Connection pool: explicit limits to stay within Atlas M0 (100 connections).
// Vercel serverless: each Lambda has its own pool; 10 concurrent lambdas × 10 = 100 — at the limit.
// Worker: single long-running process; 10 is more than enough.
const opts = {
  serverSelectionTimeoutMS: 8_000,
  maxPoolSize: 10,
  minPoolSize: 1,
};

declare global {
  // pnpm hot-reload reutiliza el módulo; evitamos abrir N conexiones en dev.
  // eslint-disable-next-line no-var
  var _kryndelMongoClient: MongoClient | undefined;
  // eslint-disable-next-line no-var
  var _kryndelIndexesEnsured: boolean | undefined;
}

function makeClient(uri: string): MongoClient {
  return new MongoClient(uri, opts);
}

let _client: MongoClient | null = null;

function getClient(): MongoClient {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI no está definida — añádela al .env local o a las variables de entorno.');
  }
  if (_client) return _client;

  if (process.env.NODE_ENV === 'development') {
    if (!global._kryndelMongoClient) {
      global._kryndelMongoClient = makeClient(uri);
    }
    _client = global._kryndelMongoClient;
  } else {
    _client = makeClient(uri);
  }
  return _client;
}

/** Connect lazily and return the named database (default: 'kryndel'). */
export async function getDb(dbName = 'kryndel'): Promise<Db> {
  const client = getClient();
  await client.connect(); // idempotent — no-op if already connected
  return client.db(dbName);
}

/**
 * Ensure all required indexes exist.
 * Safe to call on every startup — MongoDB skips indexes that already exist.
 * Call once at worker boot and once in Next.js instrumentation.ts.
 */
let _indexPromise: Promise<void> | null = null;

export function ensureIndexes(): Promise<void> {
  // Deduplicate concurrent calls (e.g. Next.js parallel route handlers).
  if (_indexPromise) return _indexPromise;
  _indexPromise = _ensureIndexesImpl().catch((err) => {
    // Reset so next call retries, but don't crash.
    _indexPromise = null;
    console.error('[kryndel/db] ensureIndexes failed:', err);
  }) as Promise<void>;
  return _indexPromise;
}

async function _ensureIndexesImpl(): Promise<void> {
  const db = await getDb();

  await Promise.all([
    // ── users ────────────────────────────────────────────────────────────────
    db.collection('users').createIndex(
      { email: 1 },
      { unique: true, name: 'users_email_unique' },
    ),

    // ── sessions — TTL: MongoDB removes docs automatically after expiresAt ──
    db.collection('sessions').createIndex(
      { tokenHash: 1 },
      { unique: true, name: 'sessions_tokenHash_unique' },
    ),
    db.collection('sessions').createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, name: 'sessions_expiresAt_ttl' },
    ),

    // ── alert_rules ──────────────────────────────────────────────────────────
    db.collection('alert_rules').createIndex(
      { userId: 1, contractAddress: 1 },
      { name: 'rules_userId_contract' },
    ),
    db.collection('alert_rules').createIndex(
      { userId: 1 },
      { name: 'rules_userId' },
    ),

    // ── contracts — per-user lookup + uniqueness ────────────────────────────
    // sparse: docs antiguos del pipeline CLI (sin userId) quedan fuera del
    // índice. Útil para queries por userId.
    db.collection('contracts').createIndex(
      { userId: 1 },
      { sparse: true, name: 'contracts_userId' },
    ),
    // PA-BILLING (2026-06-17): unicidad por usuario en lugar de global.
    // Permite que dos cuentas vigilen el mismo contrato sin chocar; previene
    // duplicados accidentales dentro de la misma cuenta. partialFilterExpression
    // limita el índice a docs que realmente tienen userId (compatibilidad con
    // huérfanos sin userId si quedaran).
    db.collection('contracts').createIndex(
      { userId: 1, address: 1, surface: 1 },
      {
        unique: true,
        name:   'contracts_userId_address_surface_unique',
        partialFilterExpression: { userId: { $exists: true } },
      },
    ),

    // ── events — TTL: 90 days global cleanup to keep Atlas M0 storage bounded.
    // This does NOT replace per-plan query filtering (historyCutoff in user.ts).
    // Pro users see up to 90 days; Free users see up to 7 days — enforced in queries.
    db.collection('events').createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: 90 * 24 * 60 * 60, name: 'events_createdAt_ttl_90d' },
    ),

    // ── api_keys — PB-core (2026-06-17) ──────────────────────────────────────
    db.collection('api_keys').createIndex(
      { keyHash: 1 },
      { unique: true, name: 'api_keys_keyHash_unique' },
    ),
    db.collection('api_keys').createIndex(
      { userId: 1 },
      { name: 'api_keys_userId' },
    ),

    // ── rate_limit_windows — PB-core (2026-06-17) ─────────────────────────────
    // TTL: auto-expire windows after 120s (2 windows).
    db.collection('rate_limit_windows').createIndex(
      { keyId: 1, windowStart: 1 },
      { name: 'rate_limit_windows_keyId_windowStart' },
    ),
    db.collection('rate_limit_windows').createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: 120, name: 'rate_limit_windows_createdAt_ttl_120s' },
    ),

    // ── webhook_endpoints — PB-core (2026-06-17) ──────────────────────────────
    db.collection('webhook_endpoints').createIndex(
      { userId: 1 },
      { name: 'webhook_endpoints_userId' },
    ),

    // ── webhook_deliveries — PB-core (2026-06-17) — TTL 30 days ──────────────
    db.collection('webhook_deliveries').createIndex(
      { endpointId: 1, createdAt: -1 },
      { name: 'webhook_deliveries_endpointId_createdAt' },
    ),
    db.collection('webhook_deliveries').createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: 30 * 24 * 60 * 60, name: 'webhook_deliveries_createdAt_ttl_30d' },
    ),
    // Index for retry loop
    db.collection('webhook_deliveries').createIndex(
      { status: 1, nextRetryAt: 1 },
      { name: 'webhook_deliveries_status_nextRetryAt', sparse: true },
    ),
  ]);

  console.log('[kryndel/db] indexes ensured');
}
