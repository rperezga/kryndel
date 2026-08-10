import { describe, expect, it } from 'vitest';
import { DEFAULT_EVM_RPC_URL, resolveEvmRpcUrls, safeRpcEndpoint } from '../evm-rpc-config.js';

describe('resolveEvmRpcUrls', () => {
  it('prefers EVM_RPC_URLS and trims three endpoints', () => {
    expect(resolveEvmRpcUrls({
      EVM_RPC_URLS: ' https://one.example,https://two.example, , https://three.example ',
      EVM_RPC_URL: 'https://legacy.example',
    })).toEqual([
      'https://one.example',
      'https://two.example',
      'https://three.example',
    ]);
  });

  it('keeps EVM_RPC_URL backward compatibility', () => {
    expect(resolveEvmRpcUrls({ EVM_RPC_URL: ' https://legacy.example ' }))
      .toEqual(['https://legacy.example']);
  });

  it('uses the public default when neither variable is set', () => {
    expect(resolveEvmRpcUrls({})).toEqual([DEFAULT_EVM_RPC_URL]);
  });

  it('redacts credentials and query parameters from health labels', () => {
    expect(safeRpcEndpoint('https://user:pass@rpc.example/path?apiKey=secret#fragment'))
      .toBe('https://rpc.example/path');
  });
});
