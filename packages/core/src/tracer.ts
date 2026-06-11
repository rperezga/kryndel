import { createPublicClient, http, type Abi } from 'viem';
import { createEvmDecoder, ERC20_ABI } from './decoder.js';
import type { ContractRef, Trace, TraceEvent, ContractEvent } from './types.js';

// Tracer — fetches a tx receipt (EVM or native XLS-0101) and produces a structured Trace.

export interface TraceOptions {
  endpoint: string;  // EVM_RPC_URL
  abi?: Abi;         // Contract ABI (fallback: minimal ERC-20)
}

/**
 * Downloads the receipt of an EVM tx, decodes the input as a call and each log as an event,
 * and returns a Trace object compatible with the explorer and CLI.
 */
export async function traceEvmTx(txHash: string, opts: TraceOptions): Promise<Trace> {
  const t0 = Date.now();

  const client = createPublicClient({
    transport: http(opts.endpoint, { timeout: 20_000, retryCount: 3, retryDelay: 1_500 }),
  });

  const [tx, receipt] = await Promise.all([
    client.getTransaction({ hash: txHash as `0x${string}` }),
    client.getTransactionReceipt({ hash: txHash as `0x${string}` }),
  ]);

  const contractAddress = (tx.to ?? receipt.contractAddress ?? 'unknown').toLowerCase();
  const contractRef: ContractRef = {
    surface: 'evm',
    address: contractAddress,
    abi: opts.abi ?? ERC20_ABI,
  };

  const decoder = createEvmDecoder(contractRef);

  // Decode calldata from input.
  // A2.10: fallback renamed to "native value transfer" to avoid confusion with ERC-20 transfer().
  const decodedCall = tx.input && tx.input !== '0x'
    ? decoder.decodeCall(tx.input)
    : { name: 'native value transfer', args: { value: tx.value?.toString() ?? '0' }, raw: tx.input };

  // A2.6: decode each log, marking events external to the target contract.
  const decodedEvents: ContractEvent[] = receipt.logs.map(log => decoder.decodeEvent(log));

  // Build the TraceEvent timeline.
  const events: TraceEvent[] = [
    {
      t: 0,
      kind: 'call',
      label: decodedCall.name,
      data: {
        from: tx.from,
        to: tx.to,
        value: tx.value?.toString() ?? '0',
        args: decodedCall.args,
      },
    },
    ...decodedEvents.map((ev, i): TraceEvent => {
      // A2.6: label events from other contracts as external.
      const isExternal = ev.contractAddress !== undefined &&
        ev.contractAddress !== contractAddress;
      return {
        t: i + 1,
        kind: 'event',
        label: isExternal ? `[external] ${ev.name}` : ev.name,
        data: {
          ...ev.args,
          ...(isExternal ? { _from: ev.contractAddress } : {}),
        },
      };
    }),
    {
      t: decodedEvents.length + 1,
      kind: 'emit',
      label: receipt.status === 'success' ? 'tx_success' : 'tx_reverted',
      data: {
        block: Number(receipt.blockNumber),
        gasUsed: receipt.gasUsed?.toString() ?? '0',
        status: receipt.status,
      },
    },
  ];

  return {
    contract: contractRef,
    call: decodedCall,
    events,
    emitted: [],   // EVM does not produce Hook sub-txs; reserved for native.
    stateDiff: [], // State diff requires debug_traceTransaction [verificar support on XRPL EVM].
    txHash,
    durationMs: Date.now() - t0,
  };
}

// ── Native XLS-0101 trace stub ────────────────────────────────────────────────
//
// XLS-0101 tx types to watch: ContractCreate, ContractCall, ContractModify, ContractDelete.
// The watcher (watcher.ts) already filters these correctly.
//
// Full tracing requires a live AlphaNet endpoint to call the `tx` JSON-RPC method
// and fetch the Contract ledger entry for ABI decoding.
//
// The Xahau/HookExecutions implementation previously here has been archived to
// extras/archivo/xahau-experiment/ — it was built on the wrong network.
//
// [verificar: exact tx response shape and Contract ledger entry format once AlphaNet is stable]

export interface NativeTraceOptions {
  endpoint: string; // e.g. https://alphanet.rpc.nerdnest.xyz
}

/**
 * Stub for XLS-0101 native contract tracing.
 * Returns a minimal Trace with the raw tx data; full decoding pending AlphaNet availability.
 * The structure (TraceEvent timeline, ContractRef, Trace) is final — only the data source changes.
 */
export async function traceNativeTx(txHash: string, opts: NativeTraceOptions): Promise<Trace> {
  const t0 = Date.now();

  const resp = await fetch(opts.endpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ method: 'tx', params: [{ transaction: txHash, binary: false }] }),
  });
  if (!resp.ok) throw new Error(`RPC error ${resp.status}`);

  const data = await resp.json() as { result: Record<string, unknown> };
  const result = data.result;

  if ((result.status as string) === 'error' || result.error) {
    throw new Error(`tx not found: ${String(result.error ?? result.error_message ?? txHash)}`);
  }

  const contractAddress = (result.Account as string ?? txHash).toLowerCase();
  const contractRef: ContractRef = { surface: 'native', address: contractAddress };

  // Minimal timeline — call entry + result.
  // Full decoder (Contract ledger entry → ABI → decoded args) is pending AlphaNet.
  const txType = (result.TransactionType as string) ?? 'tx';
  const meta = result.meta as Record<string, unknown> | undefined;
  const txResult = (meta?.TransactionResult as string) ?? 'unknown';

  const events: TraceEvent[] = [
    {
      t: 0,
      kind:  'call',
      label: txType,
      data:  {
        account:     result.Account,
        fee:         result.Fee,
        txType,
        ...(result.Amount      ? { amount: result.Amount }           : {}),
        ...(result.Destination ? { destination: result.Destination } : {}),
      },
    },
    {
      t: 1,
      kind:  'emit',
      label: txResult === 'tesSUCCESS' ? 'tx_success' : 'tx_failed',
      data:  { result: txResult, ledger: result.ledger_index ?? result.inLedger },
    },
  ];

  const call = {
    name: txType,
    args: {
      account:     result.Account,
      fee:         result.Fee,
      ...(result.Amount      ? { amount: result.Amount }           : {}),
      ...(result.Destination ? { destination: result.Destination } : {}),
    },
    raw: JSON.stringify(result).slice(0, 200) + '…',
  };

  return {
    contract:   contractRef,
    call,
    events,
    emitted:    [],
    stateDiff:  [],
    txHash,
    durationMs: Date.now() - t0,
  };
}
