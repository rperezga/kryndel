import { describe, expect, it, vi } from 'vitest';
import {
  EVM_POLL_INTERVAL_MS,
  RPC_RETRY_DELAYS_MS,
  RpcRetryWarningAggregator,
  SharedEvmPoller,
  jitteredIntervalMs,
  rpcRequest,
} from '../evm-rpc.js';

describe('rpcRequest', () => {
  it('retries HTTP 403 with exponential backoff before succeeding', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(new Response('forbidden', { status: 403 }))
      .mockResolvedValueOnce(new Response('forbidden', { status: 403 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0x2a' }), { status: 200 }));
    const sleeps: number[] = [];
    const retries: string[] = [];

    const result = await rpcRequest<string>('https://rpc.example', 'eth_blockNumber', [], {
      fetchFn: fetchFn as typeof fetch,
      sleep: async (ms) => { sleeps.push(ms); },
      random: () => 0.5,
      onRetry: ({ method, reason }) => { retries.push(`${method}:${reason}`); },
    });

    expect(result).toBe('0x2a');
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(sleeps).toEqual([1_000, 2_000]);
    expect(retries).toEqual(['eth_blockNumber:http_403', 'eth_blockNumber:http_403']);
    expect(RPC_RETRY_DELAYS_MS).toEqual([1_000, 2_000, 4_000, 8_000, 16_000]);
  });

  it.each(['eth_blockNumber', 'eth_getBlockByNumber', 'eth_getLogs'])(
    'applies explicit 403 retry to %s',
    async (method) => {
      const fetchFn = vi.fn()
        .mockResolvedValueOnce(new Response('forbidden', { status: 403 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: [] }), { status: 200 }));
      const sleeps: number[] = [];

      await rpcRequest('https://rpc.example', method, [], {
        fetchFn: fetchFn as typeof fetch,
        sleep: async (ms) => { sleeps.push(ms); },
        random: () => 0.5,
      });

      expect(fetchFn).toHaveBeenCalledTimes(2);
      expect(sleeps).toEqual([1_000]);
    },
  );

  it('treats a network failure as transient', async () => {
    const fetchFn = vi.fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0x2a' }), { status: 200 }));
    const retries: string[] = [];

    const result = await rpcRequest<string>('https://rpc.example', 'eth_blockNumber', [], {
      fetchFn: fetchFn as typeof fetch,
      sleep: async () => {},
      random: () => 0.5,
      onRetry: ({ reason }) => { retries.push(reason); },
    });

    expect(result).toBe('0x2a');
    expect(retries).toEqual(['network']);
  });
});

describe('RpcRetryWarningAggregator', () => {
  it('emits one compact warning for all retried failures in the window', () => {
    const logger = vi.fn();
    const warnings = new RpcRetryWarningAggregator({ logger, autoStart: false });

    warnings.record({ method: 'eth_blockNumber', reason: 'http_403' });
    warnings.record({ method: 'eth_getLogs', reason: 'http_403' });
    warnings.flush();
    warnings.flush();

    expect(logger).toHaveBeenCalledTimes(1);
    expect(logger).toHaveBeenCalledWith(
      '[evm-rpc] transient retries (60s): total=2 reasons=http_403:2 methods=eth_blockNumber:1,eth_getLogs:1',
    );
  });
});

describe('SharedEvmPoller', () => {
  it('fetches each RPC method once and fans logs out to matching watchers', async () => {
    const addressA = `0x${'a'.repeat(40)}`;
    const addressB = `0x${'b'.repeat(40)}`;
    const rpc = vi.fn(async (method: string, params: unknown[]) => {
      if (method === 'eth_blockNumber') return '0x64';
      if (method === 'eth_getBlockByNumber') {
        expect(params).toEqual(['0x62', false]);
        return { hash: '0xblock' };
      }
      if (method === 'eth_getLogs') {
        expect(params).toEqual([{ blockHash: '0xblock' }]);
        return [
          {
            address: addressA,
            topics: ['0xtopicA'],
            logIndex: '0x0',
            blockNumber: '0x62',
            transactionHash: '0xtxA',
          },
          {
            address: addressB,
            topics: ['0xtopicB'],
            logIndex: '0x1',
            blockNumber: '0x62',
            transactionHash: '0xtxB',
          },
        ];
      }
      throw new Error(`unexpected method ${method}`);
    });
    const activitiesA: Array<{
      contract: string;
      name?: string;
      logIndex: unknown;
      blockNumber: unknown;
    }> = [];
    const activitiesB: typeof activitiesA = [];
    const poller = new SharedEvmPoller('https://rpc.example', {
      request: rpc,
      autoStart: false,
    });
    poller.subscribe(addressA, (activity) => {
      const raw = activity.raw as { logIndex?: unknown; blockNumber?: unknown };
      activitiesA.push({
        contract: activity.contract,
        name: activity.name,
        logIndex: raw.logIndex,
        blockNumber: raw.blockNumber,
      });
    });
    poller.subscribe(addressB, (activity) => {
      const raw = activity.raw as { logIndex?: unknown; blockNumber?: unknown };
      activitiesB.push({
        contract: activity.contract,
        name: activity.name,
        logIndex: raw.logIndex,
        blockNumber: raw.blockNumber,
      });
    });

    const result = await poller.pollOnce();

    expect(rpc.mock.calls.map(([method]) => method)).toEqual([
      'eth_blockNumber',
      'eth_getBlockByNumber',
      'eth_getLogs',
    ]);
    expect(result).toEqual({ headBlock: 100n, targetBlock: 98n, logs: 2, subscribers: 2 });
    expect(activitiesA).toEqual([{
      contract: addressA,
      name: '0xtopicA',
      logIndex: 0,
      blockNumber: 98n,
    }]);
    expect(activitiesB).toEqual([{
      contract: addressB,
      name: '0xtopicB',
      logIndex: 1,
      blockNumber: 98n,
    }]);
    poller.stop();
  });

  it('backfills every block advanced between polling ticks', async () => {
    const heads = ['0x64', '0x67'];
    const blockRequests: string[] = [];
    const rpc = vi.fn(async (method: string, params: unknown[]) => {
      if (method === 'eth_blockNumber') return heads.shift();
      if (method === 'eth_getBlockByNumber') {
        const blockNumber = params[0] as string;
        blockRequests.push(blockNumber);
        return { hash: `0xhash${blockNumber.slice(2)}` };
      }
      if (method === 'eth_getLogs') return [];
      throw new Error(`unexpected method ${method}`);
    });
    const poller = new SharedEvmPoller('https://rpc.example', {
      request: rpc,
      autoStart: false,
    });
    poller.subscribe(`0x${'a'.repeat(40)}`, () => {});

    await poller.pollOnce();
    await poller.pollOnce();

    expect(blockRequests).toEqual(['0x62', '0x63', '0x64', '0x65']);
    expect(rpc.mock.calls.filter(([method]) => method === 'eth_getLogs')).toHaveLength(4);
    poller.stop();
  });

  it('uses a 10 second base interval with plus or minus 20 percent jitter', () => {
    expect(EVM_POLL_INTERVAL_MS).toBe(10_000);
    expect(jitteredIntervalMs(() => 0)).toBe(8_000);
    expect(jitteredIntervalMs(() => 0.5)).toBe(10_000);
    expect(jitteredIntervalMs(() => 1)).toBe(12_000);
  });
});
