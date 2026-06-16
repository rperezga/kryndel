/**
 * Cliente MongoDB para Next.js + worker — singleton cacheado.
 *
 * Pooling: maxPoolSize:10 / minPoolSize:1 para M0 (100 conexiones máx).
 * En serverless (Vercel) cada invocación crea su propio proceso; el singleton
 * evita conexiones múltiples dentro del mismo proceso en dev y en worker.
 *
 * Las variables de entorno sin prefijo NEXT_PUBLIC_ son server-only.
 */
import { MongoClient, type Db } from 'mongodb';

if (!process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI no está definida — añádela al .env local o a las variables de entorno.');
}

const uri = process.env.MONGODB_URI;

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

function makeClient(): MongoClient {
  return new MongoClient(uri, opts);
}

let client: MongoClient;

if (process.env.NODE_ENV === 'development') {
  if (!global._kryndelMongoClient) {
    global._kryndelMongoClient = makeClient();
  }
  client = global._kryndelMongoClient;
} else {
  client = makeClient();
}

/** Connect lazily and return the named database (default: 'kryndel'). */
export async function getDb(dbName = 'kryndel'): Promise<Db> {
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

    // ── contracts — add userId lookup (userId is optional; existing docs have none) ─
    db.collection('contracts').createIndex(
      { userId: 1 },
      { sparse: true, name: 'contracts_userId' },
    ),

    // ── events — TTL: 90 days global cleanup to keep Atlas M0 storage bounded.
    // This does NOT replace per-plan query filtering (historyCutoff in user.ts).
    // Pro users see up to 90 days; Free users see up to 7 days — enforced in queries.
    db.collection('events').createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: 90 * 24 * 60 * 60, name: 'events_createdAt_ttl_90d' },
    ),
  ]);

  console.log('[kryndel/db] indexes ensured');
}
