import { describe, it, expect } from 'vitest';
import { Recorder, matchesRule } from '../src/index.js';
import type { ContractRef, ContractEvent, AlertRule } from '../src/index.js';

describe('kryndel core (observability scaffold)', () => {
  it('recorder assembles a trace', () => {
    const r = new Recorder();
    r.record({ kind: 'event', label: 'Transfer' });
    const contract: ContractRef = { surface: 'evm', address: '0xabc' };
    const trace = r.toTrace(contract, '0xhash');
    expect(trace.events).toHaveLength(1);
    expect(trace.contract.address).toBe('0xabc');
    expect(trace.txHash).toBe('0xhash');
  });

  it('matchesRule filters by event name and args', () => {
    const rule: AlertRule = {
      id: '1', contract: '0xabc', event: 'Transfer',
      channel: 'telegram', target: '123', filter: { to: '0x1' },
    };
    const hit: ContractEvent = { name: 'Transfer', args: { to: '0x1' } };
    const miss: ContractEvent = { name: 'Approval', args: {} };
    expect(matchesRule(hit, rule)).toBe(true);
    expect(matchesRule(miss, rule)).toBe(false);
  });

  // A2.4 CA: regla de contrato A no dispara con evento de contrato B
  it('matchesRule — A2.4: filtra por contractAddress (case-insensitive)', () => {
    const rule: AlertRule = {
      id: '2', contract: '0xAAA', event: 'Transfer',
      channel: 'telegram', target: '123',
    };
    const sameContract: ContractEvent = {
      name: 'Transfer', args: {}, contractAddress: '0xaaa',
    };
    const otherContract: ContractEvent = {
      name: 'Transfer', args: {}, contractAddress: '0xBBB',
    };
    const noAddress: ContractEvent = { name: 'Transfer', args: {} };
    expect(matchesRule(sameContract, rule)).toBe(true);   // case-insensitive match
    expect(matchesRule(otherContract, rule)).toBe(false); // contrato diferente
    expect(matchesRule(noAddress, rule)).toBe(true);      // sin address: no filtra
  });
});
