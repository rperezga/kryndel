import { describe, it, expect } from 'vitest';
import { createEvmDecoder, ERC20_ABI } from '../src/decoder.js';
import type { ContractRef } from '../src/types.js';

const contract: ContractRef = { surface: 'evm', address: '0xabc', abi: ERC20_ABI };
const decoder = createEvmDecoder(contract);

describe('createEvmDecoder', () => {
  // transfer(address to, uint256 amount) → selector 0xa9059cbb
  const TRANSFER_SELECTOR = '0xa9059cbb';
  const to   = '0x000000000000000000000000abcdefabcdefabcdefabcdefabcdefabcdefabcd';
  const amt  = '0000000000000000000000000000000000000000000000000de0b6b3a7640000'; // 1e18
  const calldata = `${TRANSFER_SELECTOR}${to.slice(2)}${amt}` as `0x${string}`;

  it('decodeCall — decodifica transfer correctamente', () => {
    const result = decoder.decodeCall(calldata);
    expect(result.name).toBe('transfer');
    expect(result.args).toHaveProperty('to');
    expect(result.args).toHaveProperty('amount');
  });

  it('decodeCall — calldata desconocida → fallback graceful', () => {
    const result = decoder.decodeCall('0xdeadbeef');
    expect(result.name).toBe('unknown');
    expect(result.args).toHaveProperty('calldata');
  });

  it('decodeEvent — decodifica Transfer log correctamente', () => {
    // Log de Transfer(from, to, value) con topics y data reales.
    const from = '0x00000000000000000000000011111111111111111111111111111111111111111';
    const toAddr = '0x0000000000000000000000002222222222222222222222222222222222222222';
    const log = {
      // topic0: keccak256("Transfer(address,address,uint256)")
      topics: [
        '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
        from.padEnd(66, '0').slice(0, 66) as `0x${string}`,
        toAddr as `0x${string}`,
      ] as [`0x${string}`, ...`0x${string}`[]],
      data: '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000' as `0x${string}`,
      transactionHash: '0xabc123' as `0x${string}`,
      blockNumber: 1000n,
    };
    const result = decoder.decodeEvent(log);
    expect(result.name).toBe('Transfer');
    expect(result.args).toHaveProperty('value');
    expect(result.txHash).toBe('0xabc123');
    expect(result.ledgerOrBlock).toBe(1000);
  });

  it('decodeEvent — log con topic desconocido → fallback con topic0 como nombre', () => {
    const log = {
      topics: ['0xdeadbeef00000000000000000000000000000000000000000000000000000000' as `0x${string}`],
      data: '0x' as `0x${string}`,
      transactionHash: '0xfoo' as `0x${string}`,
    };
    const result = decoder.decodeEvent(log);
    // No coincide con ERC-20 ABI → fallback → nombre = topic0
    expect(result.name).toBe('0xdeadbeef00000000000000000000000000000000000000000000000000000000');
    expect(result.args).toEqual({});
  });
});
