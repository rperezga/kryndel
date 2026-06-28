/**
 * Heartbeat loop — writes a liveness record so the dashboard can show the REAL
 * indexer health (is the worker alive & keeping up with the chain), independent
 * of whether watched contracts happen to be emitting events.
 *
 * Each cycle: fetch the current EVM head block and upsert a single
 * `worker_heartbeat` doc { key:'evm', ts, headBlock, watchers, build, source, error }.
 *
 * The dashboard then derives:
 *   - Indexer Health = is `ts` fresh? (worker alive)
 *   - Block Lag      = chainHead − headBlock (how far behind the worker is)
 *
 * The last fetch result is also exposed via getHeartbeatState() so /healthz can
 * surface whether the head-block read is succeeding (and, if not, the reason) —
 * no DB access required to debug.
 */
import { getDb } from './db.js';

const PRIMARY_RPC = process.env.EVM_RPC_URL ?? 'https://rpc.xrplevm.org';
const PUBLIC_RPC = 'https://rpc.xrplevm.org';
const INTERVAL_MS = 20_000;
const TIMEOUT_MS = 5_000;
const BUILD = 'heartbeat-v2';

let _active = true;

export interface HeartbeatState {
  ts: string | null;
  headBlock: number | null;
  source: string | null;
  error: string | null;
}

let _last: HeartbeatState = { ts: null, headBlock: null, source: null, error: null };

/** Last head-block fetch result, for /healthz observability. */
export function getHeartbeatState(): HeartbeatState {
  return _last;
}

export function startHeartbeatLoop(getWatcherCount: () => number): () => void {
  void loop(getWatcherCount);
  return () => {
    _active = false;
  };
}

async function loop(getWatcherCount: () => number): Promise<void> {
  while (_active) {
    try {
      const { headBlock, source, error } = await fetchHeadBlock();
      _last = { ts: new Date().toISOString(), headBlock, source, error };
      const db = await getDb();
      await db.collection('worker_heartbeat').updateOne(
        { key: 'evm' },
        {
          $set: {
            key: 'evm',
            ts: new Date(),
            headBlock,
            watchers: getWatcherCount(),
            build: BUILD,
            source,
            error,
          },
        },
        { upsert: true },
      );
    } catch (err) {
      console.error('[heartbeat] error:', err);
    }
    await new Promise<void>((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
}

/** Try the configured RPC, then the public RPC as a fallback. */
async function fetchHeadBlock(): Promise<{ headBlock: number | null; source: string | null; error: string | null }> {
  const urls = PRIMARY_RPC === PUBLIC_RPC ? [PRIMARY_RPC] : [PRIMARY_RPC, PUBLIC_RPC];
  let lastError: string | null = null;
  for (const url of urls) {
    const r = await tryRpc(url);
    if (r.headBlock !== null) return { headBlock: r.headBlock, source: url, error: null };
    lastError = r.error;
  }
  return { headBlock: null, source: null, error: lastError };
}

async function tryRpc(url: string): Promise<{ headBlock: number | null; error: string | null }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
      signal: ctrl.signal,
    });
    if (!res.ok) return { headBlock: null, error: `http ${res.status}` };
    const data = (await res.json()) as { result?: string; error?: { message?: string } };
    if (data.error) return { headBlock: null, error: `rpc: ${data.error.message ?? 'error'}` };
    if (!data.result) return { headBlock: null, error: 'no result' };
    const n = parseInt(data.result, 16);
    return Number.isFinite(n) ? { headBlock: n, error: null } : { headBlock: null, error: 'parse failed' };
  } catch (e) {
    return { headBlock: null, error: e instanceof Error ? `${e.name}: ${e.message}` : 'fetch failed' };
  } finally {
    clearTimeout(timer);
  }
}
