import { describe, it, expect, vi, afterEach } from 'vitest';
import { traceNativeTx } from '../src/tracer.js';

// ── traceNativeTx (XLS-0101 stub) ─────────────────────────────────────────────
// Tests run fully offline: fetch is mocked with a minimal XLS-0101-style tx response.
// The stub returns a structured Trace from basic tx fields; full ABI decoding is
// pending AlphaNet availability (see LIMITATIONS.md).

const MINIMAL_TX_RESPONSE = {
  result: {
    TransactionType: 'ContractCall',
    Account:         'rSomeContractPseudoAddress123456789',
    Fee:             '12',
    ledger_index:    1234567,
    meta: {
      TransactionResult: 'tesSUCCESS',
      AffectedNodes: [],
    },
  },
};

const TX_HASH = 'ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';

describe('traceNativeTx — XLS-0101 stub (offline)', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  function mockFetch(body: unknown, ok = true, status = 200) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok, status,
      json: async () => body,
    }));
  }

  it('returns a Trace with surface=native and contract=Account', async () => {
    mockFetch(MINIMAL_TX_RESPONSE);
    const trace = await traceNativeTx(TX_HASH, { endpoint: 'https://alphanet.rpc.nerdnest.xyz' });
    expect(trace.contract.surface).toBe('native');
    expect(trace.contract.address).toBe('rsomecontractpseudoaddress123456789');
    expect(trace.txHash).toBe(TX_HASH);
  });

  it('call.name equals TransactionType', async () => {
    mockFetch(MINIMAL_TX_RESPONSE);
    const trace = await traceNativeTx(TX_HASH, { endpoint: 'https://x' });
    expect(trace.call?.name).toBe('ContractCall');
    expect(trace.call?.args).toMatchObject({
      account: 'rSomeContractPseudoAddress123456789',
      fee:     '12',
    });
  });

  it('events has a call entry followed by a tx_success entry', async () => {
    mockFetch(MINIMAL_TX_RESPONSE);
    const trace = await traceNativeTx(TX_HASH, { endpoint: 'https://x' });
    expect(trace.events.length).toBeGreaterThanOrEqual(2);
    expect(trace.events[0].kind).toBe('call');
    expect(trace.events[0].label).toBe('ContractCall');
    const last = trace.events[trace.events.length - 1];
    expect(last.label).toBe('tx_success');
    expect(last.data?.result).toBe('tesSUCCESS');
  });

  it('emitted and stateDiff are empty arrays in the stub', async () => {
    mockFetch(MINIMAL_TX_RESPONSE);
    const trace = await traceNativeTx(TX_HASH, { endpoint: 'https://x' });
    expect(trace.emitted).toEqual([]);
    expect(trace.stateDiff).toEqual([]);
  });

  it('throws on HTTP error', async () => {
    mockFetch({}, false, 503);
    await expect(traceNativeTx(TX_HASH, { endpoint: 'https://x' }))
      .rejects.toThrow('RPC error 503');
  });

  it('throws if tx not found (status=error)', async () => {
    mockFetch({ result: { status: 'error', error: 'txnNotFound' } });
    await expect(traceNativeTx(TX_HASH, { endpoint: 'https://x' }))
      .rejects.toThrow('txnNotFound');
  });

  it('durationMs is a non-negative number', async () => {
    mockFetch(MINIMAL_TX_RESPONSE);
    const trace = await traceNativeTx(TX_HASH, { endpoint: 'https://x' });
    expect(typeof trace.durationMs).toBe('number');
    expect(trace.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('tx_failed label when TransactionResult is not tesSUCCESS', async () => {
    const failedTx = {
      result: { ...MINIMAL_TX_RESPONSE.result, meta: { TransactionResult: 'tecINSUF_FEE' } },
    };
    mockFetch(failedTx);
    const trace = await traceNativeTx(TX_HASH, { endpoint: 'https://x' });
    const last = trace.events[trace.events.length - 1];
    expect(last.label).toBe('tx_failed');
  });
});
