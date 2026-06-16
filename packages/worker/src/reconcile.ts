/**
 * Reconcile loop — reads active contracts + alert rules from MongoDB every
 * RECONCILE_INTERVAL_MS, then calls pool.sync() to start/stop watchers.
 *
 * Design:
 * - Pull model (worker polls DB) — avoids needing a pub/sub channel for MVP.
 * - Any change to contracts/rules takes effect within one reconcile interval.
 * - Rules are indexed by `${surface}:${address}` so the pool & dispatcher share the same key.
 */
import { collection } from './db.js';
import { WatcherPool } from './watcher-pool.js';
import type { WContract, WAlertRule } from './types.js';

const RECONCILE_INTERVAL_MS = parseInt(process.env.RECONCILE_INTERVAL_MS ?? '30000', 10);

let _timer: ReturnType<typeof setTimeout> | null = null;

/** Fetch all active contracts from MongoDB. */
async function fetchContracts(): Promise<WContract[]> {
  const coll = await collection<WContract>('contracts');
  return coll.find({ active: true }).toArray();
}

/**
 * Fetch all active alert rules, grouped by `surface:address` key.
 * Only returns rules for the given set of contracts (avoids pulling all rules).
 */
async function fetchRules(contracts: WContract[]): Promise<Map<string, WAlertRule[]>> {
  if (contracts.length === 0) return new Map();

  const addresses = contracts.map((c) => c.address);
  const coll      = await collection<WAlertRule>('alert_rules');
  const rules     = await coll.find({ contractAddress: { $in: addresses }, active: true }).toArray();

  const byKey = new Map<string, WAlertRule[]>();
  for (const rule of rules) {
    // Find the contract this rule belongs to (match by address + surface).
    const contract = contracts.find(
      (c) => c.address === rule.contractAddress && c.surface === rule.surface,
    );
    if (!contract) continue;
    const key = `${contract.surface}:${contract.address}`;
    const existing = byKey.get(key) ?? [];
    existing.push(rule);
    byKey.set(key, existing);
  }
  return byKey;
}

/** Run one reconcile tick. */
async function tick(pool: WatcherPool): Promise<void> {
  try {
    const contracts = await fetchContracts();
    const rules     = await fetchRules(contracts);
    const { started, stopped } = await pool.sync(contracts, rules);

    if (started || stopped) {
      console.log(`[reconcile] tick — pool size: ${pool.size} (+${started} -${stopped})`);
    } else {
      console.log(`[reconcile] tick — pool stable, ${pool.size} watcher(s)`);
    }
  } catch (err) {
    console.error('[reconcile] tick error:', err);
    // Don't crash the loop — try again next interval.
  }
}

/** Start the reconcile loop. Returns a stop function. */
export function startReconcileLoop(pool: WatcherPool): () => void {
  console.log(`[reconcile] starting (interval: ${RECONCILE_INTERVAL_MS}ms)`);

  // Run immediately, then on interval.
  void tick(pool);

  function schedule(): void {
    _timer = setTimeout(() => {
      void tick(pool);
      schedule();
    }, RECONCILE_INTERVAL_MS);
  }

  schedule();

  return () => {
    if (_timer) { clearTimeout(_timer); _timer = null; }
    console.log('[reconcile] stopped');
  };
}
