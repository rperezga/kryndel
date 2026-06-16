import { describe, it, expect } from 'vitest';
import { parseTransactionMessage, isContractTxType, CONTRACT_TX_TYPES } from '../src/watcher.js';

describe('native watcher — parseTransactionMessage', () => {
  it('reconoce los 6 tipos de tx de contrato (XLS-0101)', () => {
    expect(CONTRACT_TX_TYPES).toHaveLength(6);
    expect(isContractTxType('ContractCall')).toBe(true);
    expect(isContractTxType('Payment')).toBe(false);
  });

  it('extrae actividad de un ContractCall (API v1: transaction)', () => {
    const msg = {
      type: 'transaction',
      hash: 'ABCD',
      transaction: { TransactionType: 'ContractCall', Account: 'rCaller', Destination: 'rContract' },
    };
    const a = parseTransactionMessage(msg);
    expect(a).not.toBeNull();
    expect(a!.kind).toBe('call');
    expect(a!.contract).toBe('rContract');
    expect((a as { txType: string }).txType).toBe('ContractCall');
    expect(a!.txHash).toBe('ABCD');
  });

  it('soporta API v2 (tx_json)', () => {
    const msg = {
      type: 'transaction',
      tx_json: { TransactionType: 'ContractCreate', Account: 'rDeployer', hash: 'EF01' },
    };
    const a = parseTransactionMessage(msg);
    expect(a!.contract).toBe('rDeployer');
    expect(a!.txHash).toBe('EF01');
  });

  it('ignora transacciones que no son de contrato', () => {
    expect(parseTransactionMessage({ type: 'transaction', transaction: { TransactionType: 'Payment' } })).toBeNull();
    expect(parseTransactionMessage({ type: 'ledgerClosed' })).toBeNull();
    expect(parseTransactionMessage(null)).toBeNull();
    expect(parseTransactionMessage('garbage')).toBeNull();
  });
});

// ── B9: EVM watcher backoff constants ────────────────────────────────────────
// Tests sin red — solo validan las constantes exportadas y la lógica pura de backoff.
import { POLL_BASE, POLL_MAX, nextEvmBackoff } from '../src/watcher.js';

describe('[B9] EVM watcher — backoff exponencial en errores RPC', () => {
  it('POLL_BASE es 4 s y POLL_MAX es 60 s', () => {
    expect(POLL_BASE).toBe(4_000);
    expect(POLL_MAX).toBe(60_000);
  });

  it('nextEvmBackoff duplica hasta POLL_MAX', () => {
    expect(nextEvmBackoff(4_000)).toBe(8_000);
    expect(nextEvmBackoff(8_000)).toBe(16_000);
    expect(nextEvmBackoff(32_000)).toBe(60_000);  // 64000 → capped to 60000
    expect(nextEvmBackoff(60_000)).toBe(60_000);  // ya en el máximo
  });
});
