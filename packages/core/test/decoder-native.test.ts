import { describe, it, expect } from 'vitest';
import { createNativeDecoder } from '../src/decoder.js';
import type { ContractRef } from '../src/types.js';
import fixture from './fixtures/native-hook-tx.json' with { type: 'json' };

// Fixture real capturado el 2026-06-09 de hooks-testnet-v3.xrpl-labs.com
// Tx: 1254E6008564A51CB20A227DC567E04FA47AFE948F43B11697D9FE4F09EA1E5D
// Hook: AutoReward (9F2B2E…) en cuenta rUncrjtPhAkxzmLEKVQFJowYvmXWn21E1S

const contract: ContractRef = {
  surface: 'alphanet',
  address: 'rUncrjtPhAkxzmLEKVQFJowYvmXWn21E1S',
};
const decoder = createNativeDecoder(contract);

const hookExec = fixture.result.meta.HookExecutions[0].HookExecution;

describe('createNativeDecoder — Hooks testnet', () => {
  it('decodeCall — parsea TransactionType del tx JSON', () => {
    const txJson = JSON.stringify(fixture.result);
    const result = decoder.decodeCall(txJson);
    expect(result.name).toBe('ClaimReward');
    expect(result.args).toHaveProperty('Account');
    expect(result.args).toHaveProperty('Fee');
    // No debe exponer SigningPubKey ni TxnSignature
    expect(result.args).not.toHaveProperty('SigningPubKey');
  });

  it('decodeCall — fallback graceful para input inválido', () => {
    const result = decoder.decodeCall('no-es-json');
    expect(result.name).toBe('ContractCall');
    expect(result.args).toHaveProperty('raw');
  });

  it('decodeEvent — decodifica HookExecution con returnString hex → UTF-8', () => {
    const event = decoder.decodeEvent(hookExec);
    expect(event.name).toBe('HookExecution');
    // HookReturnString hex "4175746F5265776172643A..." → "AutoReward: callback completed."
    expect(event.args.returnString).toBe('AutoReward: callback completed.');
    expect(event.args.result).toBe('hxsEnd');       // HookResult: 3
    expect(event.args.returnCode).toBe('0');
    expect(event.args.hookAccount).toBe('rUncrjtPhAkxzmLEKVQFJowYvmXWn21E1S');
  });

  it('decodeEvent — contractAddress es HookAccount en minúsculas', () => {
    const event = decoder.decodeEvent(hookExec);
    expect(event.contractAddress).toBe('runcrjtphakxzmlekVQFJowyvmxwn21e1s'.toLowerCase());
  });

  it('decodeEvent — HookResult 1 → hxsSuccess', () => {
    const event = decoder.decodeEvent({ ...hookExec, HookResult: 1 });
    expect(event.args.result).toBe('hxsSuccess');
  });

  it('decodeEvent — HookResult 0 → hxsAgain (error)', () => {
    const event = decoder.decodeEvent({ ...hookExec, HookResult: 0 });
    expect(event.args.result).toBe('hxsAgain');
  });

  it('decodeEvent — returnString no-hex se conserva tal cual', () => {
    const event = decoder.decodeEvent({ ...hookExec, HookReturnString: 'textoPlano' });
    // "textoPlano" no es hex puro, no se intenta decodificar
    expect(event.args.returnString).toBe('textoPlano');
  });
});
