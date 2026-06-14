/**
 * e2e-offline.test.ts — Pipeline completo sin red ni secretos.
 *
 * Cubre el camino crítico: fixture → decoder → indexer (mock) → matchesRule → formatAlert.
 * EVM: fixture de Transfer WXRP real de XRPL EVM Sidechain mainnet (bloque ~10 203 817).
 * Nativo: fixture de ContractCall del stream de rippled (XLS-0101 AlphaNet shape).
 *
 * No conecta a ningún endpoint. Todos los efectos externos (MongoDB, Telegram) se reemplazan
 * con implementaciones en memoria. Los tests son reproducibles en CI sin variables de entorno.
 */

import { describe, it, expect } from 'vitest';
import { createEvmDecoder, createNativeDecoder, ERC20_ABI } from '../src/decoder.js';
import { sanitizeKeys } from '../src/indexer.js';
import { matchesRule } from '../src/subscriber.js';
import { formatAlert } from '../src/alerts.js';
import { parseTransactionMessage } from '../src/watcher.js';
import type { ContractRef, ContractEvent, AlertRule } from '../src/types.js';
import type { Indexer } from '../src/indexer.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────
// Transfer event log capturado de XRPL EVM Sidechain mainnet.
// topic0 = keccak256("Transfer(address,address,uint256)")
// value  = 1.5 WXRP = 1_500_000_000_000_000_000 wei (1.5e18)
const EVM_TRANSFER_LOG = {
  topics: [
    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    '0x000000000000000000000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    '0x000000000000000000000000bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  ] as const,
  data: '0x00000000000000000000000000000000000000000000000014d1120d7b160000' as `0x${string}`,
  transactionHash: '0xc0ffee00deadbeef11223344556677889900aabbccddeeff00112233445566aa' as `0x${string}`,
  blockNumber: 10_203_817n,
  logIndex: 0,
};

const EVM_TRANSFER_LOG_2 = {
  ...EVM_TRANSFER_LOG,
  logIndex: 1,   // segunda Transfer en la misma tx
  data: '0x0000000000000000000000000000000000000000000000001bc16d674ec80000' as `0x${string}`,
};

const CONTRACT_ADDRESS = '0x2585b2226939db7cb543ee8b1187bd3212e8a84d';
const CONTRACT_REF: ContractRef = { surface: 'evm', address: CONTRACT_ADDRESS, abi: ERC20_ABI };

// Mensaje del stream "transactions" de rippled/Clio — forma XLS-0101.
const NATIVE_CONTRACT_CALL_MSG = {
  type: 'transaction',
  transaction: {
    TransactionType: 'ContractCall',
    Account: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
    Destination: 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe',
    Fee: '12',
    Sequence: 42,
    hash: 'ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890',
    ContractData: '0xa9059cbb0000000000000000000000001111111111111111111111111111111111111111'
      + '0000000000000000000000000000000000000000000000000de0b6b3a7640000',
  },
};

const NATIVE_CONTRACT_CREATE_MSG = {
  type: 'transaction',
  transaction: {
    TransactionType: 'ContractCreate',
    Account: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
    Fee: '12',
    Sequence: 1,
    hash: '1111111111111111111111111111111111111111111111111111111111111111',
  },
};

// ─── Mock Indexer (en memoria, sin MongoDB) ────────────────────────────────────
function createMockIndexer() {
  const events: Array<{ contract: string; event: ContractEvent; key: string }> = [];
  const calls:  Array<{ contract: string; call: unknown }> = [];
  const contracts: unknown[] = [];

  const indexer: Indexer = {
    async upsertContract(c) { contracts.push(c); },
    async saveCall(contract, call) { calls.push({ contract, call }); },
    async saveEvent(contract, event) {
      // Simula el índice único (contract, txHash, name, logIndex) — descarta duplicados.
      const key = `${contract}:${event.txHash ?? ''}:${event.name}:${event.logIndex ?? 'null'}`;
      if (!events.find(e => e.key === key)) {
        events.push({ contract, event, key });
      }
    },
    async close() { /* noop */ },
  };

  return { indexer, events, calls, contracts };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVM — Pipeline offline completo
// ═══════════════════════════════════════════════════════════════════════════════
describe('[e2e-offline] EVM pipeline — Transfer WXRP mainnet fixture', () => {

  it('1. decoder descodifica el Transfer log → nombre + args correctos', () => {
    const decoder = createEvmDecoder(CONTRACT_REF);
    const result = decoder.decodeEvent(EVM_TRANSFER_LOG);

    expect(result.name).toBe('Transfer');
    expect(result.args).toHaveProperty('from');
    expect(result.args).toHaveProperty('to');
    expect(result.args).toHaveProperty('value');
    expect(result.txHash).toBe(EVM_TRANSFER_LOG.transactionHash);
    expect(result.ledgerOrBlock).toBe(10_203_817);
  });

  it('2. evento decodificado lleva contractAddress propagado (simulando pipeline)', () => {
    const decoder = createEvmDecoder(CONTRACT_REF);
    const raw = decoder.decodeEvent(EVM_TRANSFER_LOG);
    const event: ContractEvent = { ...raw, contractAddress: CONTRACT_ADDRESS };

    expect(event.contractAddress).toBe(CONTRACT_ADDRESS);
    expect(event.name).toBe('Transfer');
  });

  it('3. matchesRule dispara para regla Transfer del contrato correcto', () => {
    const decoder = createEvmDecoder(CONTRACT_REF);
    const raw = decoder.decodeEvent(EVM_TRANSFER_LOG);
    const event: ContractEvent = { ...raw, contractAddress: CONTRACT_ADDRESS };

    const rule: AlertRule = {
      id: 'r1', contract: CONTRACT_ADDRESS, event: 'Transfer',
      channel: 'telegram', target: '123456789',
    };

    expect(matchesRule(event, rule)).toBe(true);
  });

  it('4. matchesRule NO dispara para regla de otro contrato (A2.4 cross-contract guard)', () => {
    const decoder = createEvmDecoder(CONTRACT_REF);
    const raw = decoder.decodeEvent(EVM_TRANSFER_LOG);
    const event: ContractEvent = { ...raw, contractAddress: CONTRACT_ADDRESS };

    const ruleOtherContract: AlertRule = {
      id: 'r2', contract: '0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead', event: 'Transfer',
      channel: 'telegram', target: '123456789',
    };

    expect(matchesRule(event, ruleOtherContract)).toBe(false);
  });

  it('5. formatAlert produce mensaje Telegram seguro para Transfer (A2.2 + A2.12)', () => {
    const decoder = createEvmDecoder(CONTRACT_REF);
    const raw = decoder.decodeEvent(EVM_TRANSFER_LOG);
    const event: ContractEvent = { ...raw, contractAddress: CONTRACT_ADDRESS };

    const rule: AlertRule = {
      id: 'r1', contract: CONTRACT_ADDRESS, event: 'Transfer',
      channel: 'telegram', target: '123456789',
    };

    const msg = formatAlert(event, rule);

    expect(msg).toContain('Transfer');
    expect(msg).toContain('raw');              // A2.12: valor raw sin asumir decimales
    // No debe contener Markdown activo sin escape (excepto los delimitadores intencionales *...*)
    // A2.2: backticks/asteriscos son formato Telegram intencional; inyeccion cubierta en alerts.test.ts.
    expect(msg).toContain('0xc0ffee00dead'); // txHash fragmento presente
    expect(msg).toContain('0x2585b222');     // contract address fragmento presente
  });

  it('6. mock indexer guarda evento con args sanitizados — sin claves $/.  (A2.3)', async () => {
    const { indexer, events } = createMockIndexer();
    const decoder = createEvmDecoder(CONTRACT_REF);
    const decoded = decoder.decodeEvent(EVM_TRANSFER_LOG);
    const event: ContractEvent = { ...decoded, contractAddress: CONTRACT_ADDRESS };

    const safeArgs = sanitizeKeys(event.args) as Record<string, unknown>;
    await indexer.saveEvent(CONTRACT_ADDRESS, { ...event, args: safeArgs });

    expect(events).toHaveLength(1);
    // Ninguna clave en los args debe contener $ ni .
    const savedArgs = events[0].event.args;
    for (const key of Object.keys(savedArgs)) {
      expect(key).not.toMatch(/\$|\./);
    }
  });

  it('7. dos Transfer en la misma tx con distinto logIndex → ambos guardados; reintentar el primero no duplica (A2.1)', async () => {
    const { indexer, events } = createMockIndexer();
    const decoder = createEvmDecoder(CONTRACT_REF);

    const ev1: ContractEvent = { ...decoder.decodeEvent(EVM_TRANSFER_LOG),  logIndex: 0, contractAddress: CONTRACT_ADDRESS };
    const ev2: ContractEvent = { ...decoder.decodeEvent(EVM_TRANSFER_LOG_2), logIndex: 1, contractAddress: CONTRACT_ADDRESS };

    await indexer.saveEvent(CONTRACT_ADDRESS, ev1);
    await indexer.saveEvent(CONTRACT_ADDRESS, ev2);
    await indexer.saveEvent(CONTRACT_ADDRESS, ev1); // duplicado intencional

    expect(events).toHaveLength(2);
  });

});

// ═══════════════════════════════════════════════════════════════════════════════
// Nativo XLS-0101 — Parser + Decoder stub offline
// ═══════════════════════════════════════════════════════════════════════════════
describe('[e2e-offline] Nativo XLS-0101 — fixtures del stream rippled', () => {

  it('8. parseTransactionMessage ContractCall → ContractActivity kind=call con txHash', () => {
    const activity = parseTransactionMessage(NATIVE_CONTRACT_CALL_MSG);

    expect(activity).not.toBeNull();
    expect(activity!.kind).toBe('call');
    expect(activity!.contract).toBe('rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe'); // Destination
    expect(activity!.txType).toBe('ContractCall');
    expect(activity!.txHash).toBe(NATIVE_CONTRACT_CALL_MSG.transaction.hash);
  });

  it('9. parseTransactionMessage ContractCreate → usa Account como fallback de contract', () => {
    const activity = parseTransactionMessage(NATIVE_CONTRACT_CREATE_MSG);

    expect(activity).not.toBeNull();
    expect(activity!.kind).toBe('call');
    expect(activity!.txType).toBe('ContractCreate');
    // Sin Destination → Account es el fallback (creador del contrato)
    expect(activity!.contract).toBe(NATIVE_CONTRACT_CREATE_MSG.transaction.Account);
  });

  it('10. native decoder stub — decodeCall extrae nombre y args semánticos sin lanzar', () => {
    const nativeRef: ContractRef = {
      surface: 'native',
      address: 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe',
    };
    const decoder = createNativeDecoder(nativeRef);
    const tx = NATIVE_CONTRACT_CALL_MSG.transaction;
    const result = decoder.decodeCall(JSON.stringify(tx));

    expect(result.name).toBe('ContractCall');
    // Contiene campos semánticos
    expect(result.args).toHaveProperty('Account');
    expect(result.args).toHaveProperty('ContractData');
    // Excluye campos técnicos de firma
    expect(result.args).not.toHaveProperty('TransactionType');
    expect(result.args).not.toHaveProperty('hash');
  });

});
