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

// Decoder nativo (AlphaNet XLS-0101).
// [verificar] formato real del ABI on-chain; por ahora parsea los campos conocidos del tx_json.
export function createNativeDecoder(_contract: ContractRef): Decoder {
  return {
    decodeCall(raw: string): DecodedCall {
      // raw es el campo HookParameters / Parameters del tx_json serializado como JSON string.
      try {
        const tx = JSON.parse(raw) as Record<string, unknown>;
        const name = (tx.TransactionType as string | undefined) ?? 'ContractCall';
        const { TransactionType: _t, hash: _h, ...rest } = tx;
        return { name, args: rest as Record<string, unknown>, raw };
      } catch {
        return { name: 'ContractCall', args: { raw }, raw };
      }
    },

    decodeEvent(raw: unknown): ContractEvent {
      // Eventos nativos: [verificar] estructura real en AlphaNet.
      // Por ahora mapea campos conocidos del objeto de actividad.
      const a = raw as Record<string, unknown>;
      return {
        name:    (a.txType as string | undefined) ?? 'ContractEvent',
        args:    { contract: a.contract, txType: a.txType },
        raw,
        txHash:  a.txHash as string | undefined,
      };
    },
  };
}
