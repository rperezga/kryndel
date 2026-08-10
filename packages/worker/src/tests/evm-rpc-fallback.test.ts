import { afterEach, describe, expect, it, vi } from 'vitest';
import { SharedEvmPoller, createRpcFallbackRequest } from '../evm-rpc.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('worker multi-RPC fallback', () => {
  it('uses one URL without changing request semantics', async () => {
    const requestEndpoint = vi.fn(async (_endpoint: string, method: string) => {
      if (method === 'eth_blockNumber') return '0x64';
      throw new Error(`unexpected method ${method}`);
    });
    const request = createRpcFallbackRequest('https://only.example', requestEndpoint);

    await expect(request('eth_blockNumber', [])).resolves.toBe('0x64');
    expect(requestEndpoint).toHaveBeenCalledWith(
      'https://only.example',
      'eth_blockNumber',
      [],
    );
  });

  it('continues the shared watcher on the next RPC when the first fails', async () => {
    const first = 'https://first.example';
    const second = 'https://second.example';
    const third = 'https://third.example';
    const address = `0x${'a'.repeat(40)}`;
    const requestEndpoint = vi.fn(async (endpoint: string, method: string) => {
      if (endpoint === first) throw new Error('first RPC unavailable');
      if (method === 'eth_blockNumber') return '0x64';
      if (method === 'eth_getBlockByNumber') return { hash: '0xblock' };
      if (method === 'eth_getLogs') return [{
        address,
        topics: ['0xtopic'],
        logIndex: '0x0',
        blockNumber: '0x62',
        transactionHash: '0xtx',
      }];
      throw new Error(`unexpected method ${method}`);
    });
    const activities: unknown[] = [];
    const poller = new SharedEvmPoller([first, second, third], {
      requestEndpoint,
      autoStart: false,
    });
    poller.subscribe(address, (activity) => { activities.push(activity); });

    const result = await poller.pollOnce();

    expect(requestEndpoint.mock.calls.slice(0, 2).map(([endpoint, method]) => [endpoint, method]))
      .toEqual([
        [first, 'eth_blockNumber'],
        [second, 'eth_blockNumber'],
      ]);
    expect(requestEndpoint.mock.calls.slice(2).every(([endpoint]) => endpoint === second)).toBe(true);
    expect(poller.activeEndpoint).toBe(second);
    expect(result).toEqual({ headBlock: 100n, targetBlock: 98n, logs: 1, subscribers: 1 });
    expect(activities).toHaveLength(1);
    await poller.stop();
  });

  it('falls through an HTTP 429 to the next RPC without retrying the blocked provider', async () => {
    const first = 'https://rate-limited.example';
    const second = 'https://healthy.example';
    const address = `0x${'b'.repeat(40)}`;
    const fetchMock = vi.fn(async (
      input: string | URL | Request,
      init?: RequestInit,
    ): Promise<Response> => {
      const endpoint = String(input);
      const body = JSON.parse(String(init?.body)) as { id: number; method: string };
      if (endpoint === first) {
        return new Response('rate limited', {
          status: 429,
          headers: { 'retry-after': '30' },
        });
      }

      let result: unknown;
      if (body.method === 'eth_blockNumber') result = '0x64';
      else if (body.method === 'eth_getBlockByNumber') result = { hash: '0xblock' };
      else if (body.method === 'eth_getLogs') result = [{
        address,
        topics: ['0xtopic'],
        logIndex: '0x0',
        blockNumber: '0x62',
        transactionHash: '0xtx',
      }];
      else throw new Error(`unexpected method ${body.method}`);

      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const poller = new SharedEvmPoller([first, second], { autoStart: false });
    poller.subscribe(address, () => undefined);

    const result = await poller.pollOnce();

    expect(fetchMock.mock.calls.filter(([input]) => String(input) === first)).toHaveLength(1);
    expect(poller.activeEndpoint).toBe(second);
    expect(result.logs).toBe(1);
    await poller.stop();
  });
});
