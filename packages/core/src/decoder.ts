import { decodeFunctionData, decodeEventLog, type Abi } from 'viem';
import type { ContractRef, DecodedCall, ContractEvent } from './types.js';

// Decoder — traduce datos crudos a llamadas/eventos legibles.
// EVM: viem decodeFunctionData / decodeEventLog con la ABI del contrato.
// Nativo: ABI on-chain del ledger XLS-0101 [verificar disponibilidad en AlphaNet].

export interface Decoder {
  decodeCall(raw: string): DecodedCall;
  decodeEvent(raw: unknown): ContractEvent;
}

// ABI mínima ERC-20 estándar. Cubre Transfer/Approval y las funciones más comunes.
// Usa esta como fallback si el contrato no provee su propia ABI.
export const ERC20_ABI = [
  // Events
  {
    type: 'event', name: 'Transfer',
    inputs: [
      { name: 'from',  type: 'address', indexed: true },
      { name: 'to',    type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event', name: 'Approval',
    inputs: [
      { name: 'owner',   type: 'address', indexed: true },
      { name: 'spender', type: 'address', indexed: true },
      { name: 'value',   type: 'uint256', indexed: false },
    ],
  },
  // Write functions
  {
    type: 'function', name: 'transfer',      stateMutability: 'nonpayable',
    inputs:  [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function', name: 'transferFrom',  stateMutability: 'nonpayable',
    inputs:  [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function', name: 'approve',       stateMutability: 'nonpayable',
    inputs:  [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  // Read functions
  {
    type: 'function', name: 'balanceOf',     stateMutability: 'view',
    inputs:  [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function', name: 'allowance',     stateMutability: 'view',
    inputs:  [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function', name: 'totalSupply',   stateMutability: 'view',
    inputs:  [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function', name: 'name',          stateMutability: 'view',
    inputs:  [], outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'function', name: 'symbol',        stateMutability: 'view',
    inputs:  [], outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'function', name: 'decimals',      stateMutability: 'view',
    inputs:  [], outputs: [{ name: '', type: 'uint8' }],
  },
] as const satisfies Abi;

// Convierte los args de viem (array | object) a un Record plano con valores serializables.
function argsToRecord(args: readonly unknown[] | Record<string, unknown> | undefined): Record<string, unknown> {
  if (!args) return {};
  if (Array.isArray(args)) {
    return Object.fromEntries((args as unknown[]).map((v, i) => [String(i), serializeArg(v)]));
  }
  return Object.fromEntries(
    Object.entries(args as Record<string, unknown>).map(([k, v]) => [k, serializeArg(v)])
  );
}

// bigint → string para que sea serializable en JSON/MongoDB.
function serializeArg(v: unknown): unknown {
  if (typeof v === 'bigint') return v.toString();
  if (Array.isArray(v)) return v.map(serializeArg);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, serializeArg(val)]));
  }
  return v;
}

// EVM decoder usando la ABI del contrato (o ERC-20 estándar como fallback).
// Falla silenciosamente: si un log no coincide con la ABI devuelve un objeto con el topic0 raw.
export function createEvmDecoder(contract: ContractRef): Decoder {
  const abi: Abi = (contract.abi as Abi | undefined) ?? ERC20_ABI;

  return {
    decodeCall(raw: string): DecodedCall {
      try {
        const { functionName, args } = decodeFunctionData({ abi, data: raw as `0x${string}` });
        return { name: functionName, args: argsToRecord(args as readonly unknown[]), raw };
      } catch {
        return { name: 'unknown', args: { calldata: raw.slice(0, 10) + '…' }, raw };
      }
    },

    decodeEvent(raw: unknown): ContractEvent {
      const log = raw as {
        data?: `0x${string}`; topics?: `0x${string}`[];
        transactionHash?: string; blockNumber?: bigint;
        logIndex?: number; address?: string;
      };
      // A2.1: propagar logIndex · A2.4: propagar contractAddress
      const logIndex = typeof log.logIndex === 'number' ? log.logIndex : undefined;
      const contractAddress = log.address?.toLowerCase();
      try {
        const { eventName, args } = decodeEventLog({
          abi,
          data:   log.data,
          topics: (log.topics ?? []) as [`0x${string}`, ...`0x${string}`[]],
        });
        return {
          name:            String(eventName ?? 'unknown'),
          args:            argsToRecord(args as unknown as Record<string, unknown>),
          raw,
          txHash:          log.transactionHash ?? undefined,
          logIndex,
          contractAddress,
          ledgerOrBlock:   log.blockNumber ? Number(log.blockNumber) : undefined,
        };
      } catch {
        return {
          name:            log.topics?.[0] ?? 'unknown',
          args:            {},
          raw,
          txHash:          log.transactionHash ?? undefined,
          logIndex,
          contractAddress,
        };
      }
    },
  };
}

// Decoder nativo (Xahau / XRPL Hooks testnet).
// Modelo real confirmado 2026-06-09: meta.HookExecutions[] — cada ejecución lleva
// HookReturnString (hex UTF-8), HookResult (0-3), HookAccount, HookHash.
// Ref: hooks-testnet-v3.xrpl-labs.com, tx 1254E6008564A51CB20A227DC567E04FA47AFE948F43B11697D9FE4F09EA1E5D
export function createNativeDecoder(_contract: ContractRef): Decoder {
  return {
    decodeCall(raw: string): DecodedCall {
      // raw = JSON-serializado del tx_json (TransactionType, Account, Fee, …).
      try {
        const tx = JSON.parse(raw) as Record<string, unknown>;
        const name = (tx.TransactionType as string | undefined) ?? 'ContractCall';
        // Omitir campos de firma/tecnicismos; conservar los semánticos.
        const { TransactionType: _t, hash: _h, SigningPubKey: _s, TxnSignature: _ts, ...rest } = tx;
        return { name, args: rest as Record<string, unknown>, raw };
      } catch {
        return { name: 'ContractCall', args: { raw }, raw };
      }
    },

    decodeEvent(raw: unknown): ContractEvent {
      // raw = un objeto HookExecution del array meta.HookExecutions[].HookExecution.
      // Campos opcionales _txHash y _ledgerIdx inyectados por traceNativeTx/watcher.
      const he = raw as {
        HookAccount?:        string;
        HookHash?:           string;
        HookResult?:         number;
        HookReturnCode?:     string;
        HookReturnString?:   string;
        HookEmitCount?:      number;
        HookExecutionIndex?: number;
        HookStateChangeCount?: number;
        _txHash?:            string;
        _ledgerIdx?:         number;
      };

      // HookReturnString es hex ASCII; decodificar a UTF-8 y quitar null bytes.
      const returnHex = he.HookReturnString ?? '';
      let returnStr = returnHex;
      if (/^[0-9a-fA-F]+$/.test(returnHex) && returnHex.length > 0) {
        try {
          returnStr = Buffer.from(returnHex, 'hex').toString('utf8').replace(/\0/g, '').trim();
        } catch { /* fallback: dejar hex */ }
      }

      // HookResult: 0=hxsAgain(error), 1=hxsSuccess, 2=hxsFallback, 3=hxsEnd.
      const RESULT_NAMES: Record<number, string> = {
        0: 'hxsAgain', 1: 'hxsSuccess', 2: 'hxsFallback', 3: 'hxsEnd',
      };
      const hookResult = he.HookResult ?? 0;

      return {
        name:            'HookExecution',
        args: {
          hookAccount:   he.HookAccount ?? '',
          hookHash:      String(he.HookHash ?? '').slice(0, 16) + '…',
          result:        RESULT_NAMES[hookResult] ?? String(hookResult),
          returnCode:    he.HookReturnCode ?? '0',
          returnString:  returnStr,
          emitCount:     he.HookEmitCount ?? 0,
          stateChanges:  he.HookStateChangeCount ?? 0,
        },
        raw,
        txHash:          he._txHash,
        contractAddress: he.HookAccount?.toLowerCase(),
        ledgerOrBlock:   he._ledgerIdx,
      };
    },
  };
}
