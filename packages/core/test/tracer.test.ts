import { describe, it, expect, vi, afterEach } from 'vitest';
import { traceNativeTx } from '../src/tracer.js';
import nativeFixture from './fixtures/native-hook-tx.json' with { type: 'json' };

// ── traceNativeTx ─────────────────────────────────────────────────────────────
// Tests sin red: fetch mockeado con el fixture real grabado el 2026-06-09 de
// hooks-testnet-v3.xrpl-labs.com (tx 1254E600… ClaimReward + HookExecution).

describe('traceNativeTx — fixture real Hooks testnet', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  function mockFetch(body: unknown, ok = true, status = 200) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok, status,
      json: async () => body,
    }));
  }

  it('produce un Trace con surface=alphanet y contract=HookAccount', async () => {
    mockFetch(nativeFixture);
    const trace = await traceNativeTx(
      '1254E6008564A51CB20A227DC567E04FA47AFE948F43B11697D9FE4F09EA1E5D',
      { endpoint: 'https://hooks-testnet-v3.xrpl-labs.com' },
    );
    expect(trace.contract.surface).toBe('alphanet');
    // HookAccount en minúsculas
    expect(trace.contract.address).toBe('runcrjtphakxzmlekvqfjowyvmxwn21e1s');
    expect(trace.txHash).toBe('1254E6008564A51CB20A227DC567E04FA47AFE948F43B11697D9FE4F09EA1E5D');
  });

  it('call es ClaimReward con account y fee', async () => {
    mockFetch(nativeFixture);
    const trace = await traceNativeTx('x', { endpoint: 'https://x' });
    expect(trace.call?.name).toBe('ClaimReward');
    expect(trace.call?.args).toMatchObject({
      account: 'rUncrjtPhAkxzmLEKVQFJowYvmXWn21E1S',
      fee:     '21',
    });
  });

  it('events incluye HookExecution[0] con returnString decodificado', async () => {
    mockFetch(nativeFixture);
    const trace = await traceNativeTx('x', { endpoint: 'https://x' });
    const hookEv = trace.events.find(e => e.label.startsWith('HookExecution'));
    expect(hookEv).toBeDefined();
    // HookReturnString hex → "AutoReward: callback completed."
    expect(hookEv?.data?.returnString).toBe('AutoReward: callback completed.');
    expect(hookEv?.data?.result).toBe('hxsEnd');   // HookResult: 3
    expect(hookEv?.data?.returnCode).toBe('0');
  });

  it('events incluye EmittedTxn(ClaimReward)', async () => {
    mockFetch(nativeFixture);
    const trace = await traceNativeTx('x', { endpoint: 'https://x' });
    const emitted = trace.events.find(e => e.label.startsWith('EmittedTxn'));
    expect(emitted).toBeDefined();
    expect(emitted?.label).toBe('EmittedTxn(ClaimReward)');
    expect(emitted?.data?.txType).toBe('ClaimReward');
  });

  it('events termina en tx_success', async () => {
    mockFetch(nativeFixture);
    const trace = await traceNativeTx('x', { endpoint: 'https://x' });
    const last = trace.events[trace.events.length - 1];
    expect(last.label).toBe('tx_success');
    expect(last.data?.result).toBe('tesSUCCESS');
    expect(last.data?.ledger).toBe(9515125);
  });

  it('lanza error si RPC devuelve HTTP no-ok', async () => {
    mockFetch({}, false, 503);
    await expect(traceNativeTx('x', { endpoint: 'https://x' }))
      .rejects.toThrow('RPC error 503');
  });

  it('lanza error si la tx no existe (status=error)', async () => {
    mockFetch({ result: { status: 'error', error: 'txnNotFound' } });
    await expect(traceNativeTx('x', { endpoint: 'https://x' }))
      .rejects.toThrow('txnNotFound');
  });

  it('durationMs es un número >= 0', async () => {
    mockFetch(nativeFixture);
    const trace = await traceNativeTx('x', { endpoint: 'https://x' });
    expect(typeof trace.durationMs).toBe('number');
    expect(trace.durationMs).toBeGreaterThanOrEqual(0);
  });
});
