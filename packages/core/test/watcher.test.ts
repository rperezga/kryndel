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
