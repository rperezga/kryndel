/**
 * WatcherPool — manages a set of live Watcher instances.
 *
 * Keeps a Map<contractKey, Watcher> where contractKey = `${surface}:${address}`.
 * sync() is called by the reconcile loop: starts new watchers, stops removed ones.
 * Watcher events are forwarded to the provided onActivity callback.
 */
import { createEvmWatcher, createNativeWatcher } from '@kryndel/core';
import type { Watcher, ContractActivity } from '@kryndel/core';
import type { WContract, WAlertRule } from './types.js';
import { dispatch } from './dispatcher.js';

export type ActivityHandler = (
  activity:  ContractActivity,
  contract:  WContract,
  rules:     WAlertRule[],
) => Promise<void>;

interface PoolEntry {
  watcher:  Watcher;
  contract: WContract;
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

    // Start watchers for new contracts.
    let started = 0;
    for (const [key, contract] of desired) {
      if (this.entries.has(key)) continue;

      const watcher = this.createWatcher(contract, rulesByContract);
      this.entries.set(key, { watcher, contract });

      watcher.start(async (activity) => {
        const rules = rulesByContract.get(key) ?? [];
        await dispatch(activity, rules, contract.address).catch((e) =>
          console.error(`[pool] dispatch error for ${key}:`, e),
        );
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
        console.log(`[pool] ${contract.surface}:${contract.address.slice(0, 8)}… → ${status}${detail ? ' ' + detail : ''}`),
    };

    return contract.surface === 'evm'
      ? createEvmWatcher(opts)
      : createNativeWatcher(opts);
  }
}
