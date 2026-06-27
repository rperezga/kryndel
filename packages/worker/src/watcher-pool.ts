/**
 * WatcherPool -- manages a set of live Watcher instances.
 *
 * Keeps a Map<contractKey, Watcher> where contractKey = `${surface}:${address}`.
 * sync() is called by the reconcile loop: starts new watchers, stops removed ones.
 * Watcher events are forwarded to the provided onActivity callback.
 *
 * PB-core: after dispatching alerts, also triggers deliverWebhooks for
 * outbound signed delivery to user-registered webhook endpoints.
 */
import { createEvmWatcher, createNativeWatcher, createEvmDecoder } from '@kryndel/core/full';
import type { Watcher, ContractActivity } from '@kryndel/core/full';
import type { WContract, WAlertRule } from './types.js';
import { dispatch }          from './dispatcher.js';
import { deliverWebhooks }   from './webhook-deliverer.js';
import { getDb }             from './db.js';

/**
 * F1: Decode an EVM ContractActivity using the cascade decoder.
 * Resolves the raw topic0 (.name) to a human-readable event name and populates
 * .args so the dispatcher can apply arg-level filter rules.
 *
 * Each call is cheap (no network I/O — pure ABI lookup + viem decode).
 * ABI changes from the reconcile loop take effect on the next event without
 * restarting the pool (no decoder instance is cached).
 *
 * On any error, returns the original activity unchanged — never crashes the pool.
 */
function decodeEvmActivity(
  activity: ContractActivity,
  contract: WContract,
): ContractActivity {
  if (activity.kind !== 'event' || !activity.raw) return activity;
  try {
    const decoded = createEvmDecoder({
      surface: 'evm',
      address: contract.address,
      abi:     contract.abi,
    }).decodeEvent(activity.raw);
    return { ...activity, name: decoded.name, args: decoded.args };
  } catch {
    return activity;
  }
}

/**
 * F1b: Persist a decoded event to the `events` collection.
 *
 * Until now the live 24/7 worker decoded events only to dispatch alerts and
 * webhooks — it never wrote them, so the dashboard / explorer Event Stream was
 * fed only by seed.mjs (fabricated, name = raw topic0 hash) and manual
 * watch-seed runs. This writes the DECODED event (human name + args) so the
 * Event Stream reflects real live activity.
 *
 * Dedup mirrors the core MongoIndexer unique index
 * {contract, txHash, name, logIndex}. Never throws — a persistence failure must
 * not crash the watcher pool.
 */
async function persistEvent(
  activity: ContractActivity,
  contract: WContract,
): Promise<void> {
  if (activity.kind !== 'event') return;
  try {
    const db  = await getDb();
    const log = (activity.raw ?? {}) as {
      logIndex?: number; blockNumber?: bigint | number; transactionHash?: string;
    };
    const address  = contract.address.toLowerCase();
    const txHash   = activity.txHash ?? log.transactionHash ?? undefined;
    const logIndex = typeof log.logIndex === 'number' ? log.logIndex : null;
    const name     = activity.name ?? 'unknown';

    const doc = {
      contract:        address,
      contractAddress: address,
      name,
      args:            activity.args ?? {},
      txHash,
      logIndex,
      ledgerOrBlock:   log.blockNumber != null ? Number(log.blockNumber) : undefined,
      indexedAt:       new Date(),
    };

    if (txHash) {
      await db.collection('events').updateOne(
        { contract: address, txHash, name, logIndex },
        { $setOnInsert: doc },
        { upsert: true },
      );
    } else {
      await db.collection('events').insertOne(doc);
    }
  } catch (e) {
    console.error(
      `[pool] persistEvent error for ${contract.surface}:${contract.address.slice(0, 8)}…:`,
      e,
    );
  }
}

export type ActivityHandler = (
  activity:  ContractActivity,
  contract:  WContract,
  rules:     WAlertRule[],
) => Promise<void>;

interface PoolEntry {
  watcher:  Watcher;
  contract: WContract;
  rules:    WAlertRule[];
}

export class WatcherPool {
  private entries = new Map<string, PoolEntry>();

  /** Current number of active watchers. */
  get size(): number { return this.entries.size; }

  /** Keys of active watchers: `surface:address` */
  get activeKeys(): string[] { return [...this.entries.keys()]; }

  /**
   * Synchronise the pool with the given list of contracts + their rules.
   * - Starts a watcher for each contract not yet in the pool.
   * - Stops watchers whose contract is no longer in the list.
   * Returns counts for observability.
   */
  async sync(
    contracts: WContract[],
    rulesByContract: Map<string, WAlertRule[]>,
  ): Promise<{ started: number; stopped: number }> {
    const desired = new Map(contracts.map((c) => [`${c.surface}:${c.address}`, c]));

    // Stop watchers for contracts no longer active.
    let stopped = 0;
    for (const [key, entry] of this.entries) {
      if (!desired.has(key)) {
        await entry.watcher.stop().catch((e) =>
          console.error(`[pool] stop error for ${key}:`, e),
        );
        this.entries.delete(key);
        stopped++;
        console.log(`[pool] stopped watcher ${key}`);
      }
    }

    // Start new watchers; refresh contract + rules on existing ones so ABI /
    // rule changes from the reconcile loop take effect within one interval
    // (no restart needed — e.g. an auto-fetched ABI starts decoding live).
    let started = 0;
    for (const [key, contract] of desired) {
      const rules = rulesByContract.get(key) ?? [];

      const existing = this.entries.get(key);
      if (existing) {
        existing.contract = contract; // pick up ABI / label changes
        existing.rules = rules;       // pick up rule changes
        continue;
      }

      const watcher = this.createWatcher(contract, rulesByContract);
      this.entries.set(key, { watcher, contract, rules });

      watcher.start(async (activity) => {
        // Read the LATEST contract + rules from the live entry, so an ABI or rule
        // update applies on the next event without restarting the watcher.
        const cur = this.entries.get(key);
        const liveContract = cur?.contract ?? contract;
        const liveRules = cur?.rules ?? rules;

        // F1: Decode EVM events before dispatching (topic0 → named event + args)
        const decoded = liveContract.surface === 'evm'
          ? decodeEvmActivity(activity, liveContract)
          : activity;

        // 1. Dispatch alert rules (Telegram/Discord/webhook alerts)
        await dispatch(decoded, liveRules, liveContract.address).catch((e) =>
          console.error(`[pool] dispatch error for ${key}:`, e),
        );

        // 2. Persist the DECODED event so the dashboard / explorer Event Stream
        //    reflects live worker activity (previously only seed / watch-seed).
        await persistEvent(decoded, liveContract);

        // 3. Deliver to outbound webhook endpoints (PB-core) with the DECODED
        //    activity so eventName filtering + payload use the human name.
        getDb().then((db) =>
          deliverWebhooks(db, liveContract.address, decoded, liveContract.userId).catch((e) =>
            console.error(`[pool] webhook delivery error for ${key}:`, e),
          ),
        ).catch((e) => console.error(`[pool] getDb error:`, e));
      }).catch((e) => {
        console.error(`[pool] start error for ${key}:`, e);
        this.entries.delete(key);
      });

      started++;
      console.log(`[pool] started watcher ${key}`);
    }

    return { started, stopped };
  }

  /** Stop all watchers (called on shutdown). */
  async stopAll(): Promise<void> {
    await Promise.allSettled(
      [...this.entries.values()].map((e) => e.watcher.stop()),
    );
    this.entries.clear();
    console.log('[pool] all watchers stopped');
  }

  private createWatcher(contract: WContract, _rules: Map<string, WAlertRule[]>): Watcher {
    const evmEndpoint    = process.env.EVM_RPC_URL    ?? 'https://rpc.xrplevm.org';
    const nativeEndpoint = process.env.NATIVE_WS_URL  ?? 'wss://clio.xrpl-labs.com';

    const opts = {
      surface:    contract.surface,
      endpoint:   contract.surface === 'evm' ? evmEndpoint : nativeEndpoint,
      contract:   contract.address,
      onStatus:   (status: string, detail?: string) =>
        console.log(`[pool] ${contract.surface}:${contract.address.slice(0, 8)}... -> ${status}${detail ? ' ' + detail : ''}`),
    };

    return contract.surface === 'evm'
      ? createEvmWatcher(opts)
      : createNativeWatcher(opts);
  }
}
