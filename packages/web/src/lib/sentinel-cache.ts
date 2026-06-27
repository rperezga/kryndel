/**
 * sentinel-cache — read-through cache for XRPL issuer snapshots.
 *
 * Snapshots are shared across the public tool and the dashboard via the
 * `sentinel_snapshots` collection (keyed by address). A snapshot is reused for
 * up to FRESH_MS; otherwise it is re-fetched live from XRPL and stored.
 */
import { getDb } from './db';
import { fetchIssuerSnapshot, type IssuerSnapshot } from '@kryndel/core';

const FRESH_MS = 5 * 60_000;
const XRPL_RPC_URL = process.env.XRPL_RPC_URL ?? 'https://xrplcluster.com';

function plain<T>(v: T): T {
  return JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x)));
}

/**
 * Return a (possibly cached) snapshot for an issuer. Re-fetches live when the
 * cached copy is older than 5 minutes. Returns null only if there is no cache
 * AND the live fetch fails.
 */
export async function getIssuerSnapshotCached(address: string): Promise<IssuerSnapshot | null> {
  const db = await getDb();
  const cached = await db.collection('sentinel_snapshots').findOne({ address });
  const fresh =
    !!cached &&
    !!cached.snapshot &&
    !!cached.cachedAt &&
    Date.now() - new Date(cached.cachedAt).getTime() < FRESH_MS;

  if (fresh && cached) return plain(cached.snapshot) as IssuerSnapshot;

  try {
    const snap = await fetchIssuerSnapshot(address, { endpoint: XRPL_RPC_URL, timeoutMs: 12_000 });
    await db.collection('sentinel_snapshots').updateOne(
      { address },
      { $set: { address, snapshot: plain(snap), cachedAt: new Date() } },
      { upsert: true },
    );
    return snap;
  } catch {
    if (cached && cached.snapshot) return plain(cached.snapshot) as IssuerSnapshot;
    return null;
  }
}
