/**
 * Heartbeat loop — writes a liveness record so the dashboard can show the REAL
 * indexer health (is the worker alive & keeping up with the chain), independent
 * of whether watched contracts happen to be emitting events.
 *
 * Each cycle: fetch the current EVM head block and upsert a single
 * `worker_heartbeat` doc { key:'evm', ts, headBlock, watchers, build }.
 *
 * The dashboard then derives:
 *   - Indexer Health = is `ts` fresh? (worker alive)
 *   - Block Lag      = chainHead − headBlock (how far behind the worker is)
 */
import { getDb } from './db.js';

const EVM_RPC_URL = process.env.EVM_RPC_URL ?? 'https://rpc.xrplevm.org';
const INTERVAL_MS = 20_000;
const BUILD = 'heartbeat-v1';

let _active = true;

export function startHeartbeatLoop(getWatcherCount: () => number): () => void {
  void loop(getWatcherCount);
  return () => {
    _active = false;
  };
}

async function loop(getWatcherCount: () => number): Promise<void> {
  while (_active) {
    try {
      const headBlock = await fetchHeadBlock();
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

async function fetchHeadBlock(): Promise<number | null> {
  try {
    const res = await fetch(EVM_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: string };
    return data.result ? parseInt(data.result, 16) : null;
  } catch {
    return null;
  }
}
