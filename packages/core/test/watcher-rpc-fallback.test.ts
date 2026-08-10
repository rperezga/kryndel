import { beforeEach, describe, expect, it, vi } from 'vitest';

const viemMocks = vi.hoisted(() => ({
  createPublicClient: vi.fn(),
  fallback: vi.fn((transports: unknown[], options: unknown) => ({ transports, options })),
  http: vi.fn((url: string) => ({ url })),
}));

vi.mock('viem', () => viemMocks);

import { createEvmTransport } from '../src/watcher.js';

describe('createEvmTransport', () => {
  beforeEach(() => {
    viemMocks.fallback.mockClear();
    viemMocks.http.mockClear();
  });

  it('builds a non-ranking fallback transport from one URL', () => {
    const transport = createEvmTransport('https://rpc-one.example');

    expect(viemMocks.http).toHaveBeenCalledTimes(1);
    expect(viemMocks.http).toHaveBeenCalledWith('https://rpc-one.example', expect.objectContaining({
      timeout: 20_000,
      retryCount: 3,
      retryDelay: 1_500,
    }));
    expect(viemMocks.fallback).toHaveBeenCalledWith(
      [{ url: 'https://rpc-one.example' }],
      { rank: false },
    );
    expect(transport).toEqual({
      transports: [{ url: 'https://rpc-one.example' }],
      options: { rank: false },
    });
  });

  it('preserves the configured order for three URLs', () => {
    createEvmTransport([
      'https://rpc-one.example',
      'https://rpc-two.example',
      'https://rpc-three.example',
    ]);

    expect(viemMocks.http.mock.calls.map(([url]) => url)).toEqual([
      'https://rpc-one.example',
      'https://rpc-two.example',
      'https://rpc-three.example',
    ]);
    expect(viemMocks.fallback).toHaveBeenCalledWith(
      [
        { url: 'https://rpc-one.example' },
        { url: 'https://rpc-two.example' },
        { url: 'https://rpc-three.example' },
      ],
      { rank: false },
    );
  });
});
