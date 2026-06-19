import { decodeFunctionData, decodeEventLog, type Abi } from 'viem';
import type { ContractRef, DecodedCall, ContractEvent } from './types.js';
import { lookupByTopic0 } from './event-registry.js';

// Decoder — translates raw data into readable calls/events.
// EVM: viem decodeFunctionData / decodeEventLog with the contract ABI.
// Native XLS-0101: on-chain ABI from the ledger [verificar availability on AlphaNet].

export interface Decoder {
  decodeCall(raw: string): DecodedCall;
  decodeEvent(raw: unknown): ContractEvent;
}

// Minimal standard ERC-20 ABI. Covers Transfer/Approval and the most common functions.
// Used as fallback if the contract does not provide its own ABI.
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

// Converts viem args (array | object) to a flat Record with serializable values.
function argsToRecord(args: readonly unknown[] | Record<string, unknown> | undefined): Record<string, unknown> {
  if (!args) return {};
  if (Array.isArray(args)) {
    return Object.fromEntries((args as unknown[]).map((v, i) => [String(i), serializeArg(v)]));
  }
  return Object.fromEntries(
    Object.entries(args as Record<string, unknown>).map(([k, v]) => [k, serializeArg(v)])
  );
}

// bigint → string for JSON/MongoDB serializability.
function serializeArg(v: unknown): unknown {
  if (typeof v === 'bigint') return v.toString();
  if (Array.isArray(v)) return v.map(serializeArg);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, serializeArg(val)]));
  }
  return v;
}

/** EVM decoder using the contract ABI (or standard ERC-20 as fallback for calls). */
export function createEvmDecoder(contract: ContractRef): Decoder {
  // For decodeCall only; decodeEvent uses a 3-level cascade (see below).
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
      // A2.1: propagate logIndex · A2.4: propagate contractAddress
      const logIndex = typeof log.logIndex === 'number' ? log.logIndex : undefined;
      const contractAddress = log.address?.toLowerCase();
      const topics = (log.topics ?? []) as [`0x${string}`, ...`0x${string}`[]];
      const shared = {
        raw,
        txHash:        log.transactionHash ?? undefined,
        logIndex,
        contractAddress,
        ledgerOrBlock: log.blockNumber ? Number(log.blockNumber) : undefined,
      };

      // ── Cascade level 1: contract ABI (if uploaded) ─────────────────────────
      if (contract.abi) {
        try {
          const { eventName, args } = decodeEventLog({
            abi: contract.abi as Abi,
            data: log.data,
            topics,
          });
          return {
            name: String(eventName ?? 'unknown'),
            args: argsToRecord(args as unknown as Record<string, unknown>),
            ...shared,
          };
        } catch { /* fall through to registry */ }
      }

      // ── Cascade level 2: standard event registry ────────────────────────────
      const topic0 = log.topics?.[0];
      if (topic0) {
        const entry = lookupByTopic0(topic0);
        if (entry) {
          try {
            const { eventName, args } = decodeEventLog({
              abi: entry.abi,
              data: log.data,
              topics,
            });
            return {
              name: String(eventName ?? entry.name),
              args: argsToRecord(args as unknown as Record<string, unknown>),
              ...shared,
            };
          } catch { /* fall through to unknown */ }
        }
      }

      // ── Cascade level 3: unknown fallback ───────────────────────────────────
      const shortTopic = topic0 ? `${topic0.slice(0, 10)}…` : 'unknown';
      return {
        name: `unknown (${shortTopic})`,
        args: {},
        ...shared,
      };
    },
  };
}

/**
 * Native XLS-0101 decoder stub.
 *
 * XLS-0101 contracts store their ABI on-chain; full decoding requires a live AlphaNet
 * connection to fetch the Contract ledger entry. This stub is structurally complete —
 * the hex→UTF-8 utility and Trace shape are in place — pending AlphaNet availability.
 *
 * The Xahau/HookExecutions model previously used here has been archived to
 * extras/archivo/xahau-experiment/ (wrong network, wrong scope).
 *
 * [verificar: exact Contract ledger entry shape and ABI encoding once AlphaNet is stable]
 */
export function createNativeDecoder(_contract: ContractRef): Decoder {
  return {
    decodeCall(raw: string): DecodedCall {
      // raw = JSON-serialized tx_json (TransactionType, Account, Fee, …).
      try {
        const tx = JSON.parse(raw) as Record<string, unknown>;
        const name = (tx.TransactionType as string | undefined) ?? 'ContractCall';
        // Drop signing/technical fields; keep semantic ones.
        const { TransactionType: _t, hash: _h, SigningPubKey: _s, TxnSignature: _ts, ...rest } = tx;
        return { name, args: rest as Record<string, unknown>, raw };
      } catch {
        return { name: 'ContractCall', args: { raw }, raw };
      }
    },

    decodeEvent(raw: unknown): ContractEvent {
      // Placeholder: XLS-0101 eventEmitted shape [verificar once AlphaNet is available].
      // The hex→UTF-8 utility is preserved below for reuse when the real model is confirmed.
      const entry = raw as Record<string, unknown>;
      const maybeHex = String(entry.data ?? entry.returnString ?? '');
      let decoded = maybeHex;
      if (/^[0-9a-fA-F]+$/.test(maybeHex) && maybeHex.length > 0) {
        try {
          decoded = Buffer.from(maybeHex, 'hex').toString('utf8').replace(/\0/g, '').trim();
        } catch { /* keep hex fallback */ }
      }
      return {
        name:  (entry.eventName as string | undefined) ?? 'ContractEvent',
        args:  { raw: decoded || maybeHex },
        raw,
        txHash: entry._txHash as string | undefined,
        ledgerOrBlock: entry._ledgerIdx as number | undefined,
      };
    },
  };
}
