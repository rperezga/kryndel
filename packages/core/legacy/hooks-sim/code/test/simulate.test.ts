import { describe, it, expect } from 'vitest';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { simulate } from '../src/simulate.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const EXAMPLES = resolve(__dirname, '../../../examples');

const firewallSeed = {
  accounts: [{ address: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh', balance: '100000000', sequence: 1 }],
  hookState: [
    {
      account: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
      key: '0000000000000000000000000000000000000000000000000000000000000000',
      value: '01',
    },
  ],
};

const payment = {
  TransactionType: 'Payment',
  Account: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
  Destination: 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe',
  Amount: '1000000',
  Fee: '12',
  Sequence: 1,
  Flags: 0,
};

describe('simulate()', () => {
  it('accept-all → decision: accept', async () => {
    const trace = await simulate({
      hookPath: `${EXAMPLES}/accept-all.wasm`,
      tx: payment,
    });
    expect(trace.result.decision).toBe('accept');
  });

  it('trace has at least one decision event', async () => {
    const trace = await simulate({
      hookPath: `${EXAMPLES}/accept-all.wasm`,
      tx: payment,
    });
    const decision = trace.events.find((e) => e.kind === 'decision');
    expect(decision).toBeDefined();
    expect(decision?.fn).toBe('accept');
  });

  it('trace includes hook path and tx', async () => {
    const trace = await simulate({
      hookPath: `${EXAMPLES}/accept-all.wasm`,
      tx: payment,
    });
    expect(trace.hook).toContain('accept-all.wasm');
    expect(trace.tx.TransactionType).toBe('Payment');
  });

  it('durationMs is a non-negative number', async () => {
    const trace = await simulate({
      hookPath: `${EXAMPLES}/accept-all.wasm`,
      tx: payment,
    });
    expect(trace.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('firewall with state key present → rollback', async () => {
    const trace = await simulate({
      hookPath: `${EXAMPLES}/firewall.wasm`,
      tx: payment,
      ledger: firewallSeed,
      hookAccount: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
    });
    expect(trace.result.decision).toBe('rollback');
  });

  it('firewall without state key → accept', async () => {
    const trace = await simulate({
      hookPath: `${EXAMPLES}/firewall.wasm`,
      tx: payment,
      // no ledger seed → empty state
    });
    expect(trace.result.decision).toBe('accept');
  });

  it('firewall with state → stateDiff is empty (read-only)', async () => {
    const trace = await simulate({
      hookPath: `${EXAMPLES}/firewall.wasm`,
      tx: payment,
      ledger: firewallSeed,
      hookAccount: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
    });
    // firewall only reads state, never writes — diff should be empty
    expect(trace.stateDiff).toHaveLength(0);
  });

  it('accepts tx as a JSON string', async () => {
    const trace = await simulate({
      hookPath: `${EXAMPLES}/accept-all.wasm`,
      tx: JSON.stringify(payment),
    });
    expect(trace.result.decision).toBe('accept');
  });
});
