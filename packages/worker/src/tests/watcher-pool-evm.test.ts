import { describe, expect, it, vi } from 'vitest';
import type { WContract } from '../types.js';

const coreMocks = vi.hoisted(() => ({
  createEvmWatcher: vi.fn(() => ({ start: vi.fn(async () => {}), stop: vi.fn(async () => {}) })),
  createNativeWatcher: vi.fn(() => ({ start: vi.fn(async () => {}), stop: vi.fn(async () => {}) })),
  createEvmDecoder: vi.fn(() => ({ decodeEvent: vi.fn() })),
}));

vi.mock('@kryndel/core/full', () => coreMocks);

import { WatcherPool } from '../watcher-pool.js';

describe('WatcherPool EVM integration', () => {
  it('creates all EVM watchers from one injected shared poller', async () => {
    const sharedWatcher = { start: vi.fn(async () => {}), stop: vi.fn(async () => {}) };
    const sharedPoller = {
      createWatcher: vi.fn(() => sharedWatcher),
      stop: vi.fn(),
    };
    const contracts = Array.from({ length: 16 }, (_, index) => ({
      address: `0x${index.toString(16).padStart(40, '0')}`,
      surface: 'evm',
      active: true,
    })) as WContract[];
    const pool = new WatcherPool(sharedPoller);

    await pool.sync(contracts, new Map());

    expect(sharedPoller.createWatcher).toHaveBeenCalledTimes(16);
    expect(coreMocks.createEvmWatcher).not.toHaveBeenCalled();
    expect(pool.size).toBe(16);

    await pool.stopAll();
    expect(sharedPoller.stop).toHaveBeenCalledTimes(1);
  });
});
