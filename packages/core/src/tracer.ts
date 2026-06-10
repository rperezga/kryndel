import { createPublicClient, http, type Abi } from 'viem';
import { createEvmDecoder, ERC20_ABI } from './decoder.js';
import type { ContractRef, Trace, TraceEvent, ContractEvent } from './types.js';

// Tracer — obtiene el receipt de un tx (EVM o nativo Hooks) y produce un Trace estructurado.

export interface TraceOptions {
  endpoint: string;  // EVM_RPC_URL
  abi?: Abi;         // ABI del contrato (fallback: ERC-20 mínimo)
}

/**
 * Descarga el receipt de un tx EVM, decodifica el input como call y cada log como event,
 * y devuelve un objeto Trace compatible con el explorador y el CLI.
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

  // Decodificar calldata del input.
  // A2.10: fallback renombrado a "native value transfer" para no confundir con transfer() ERC-20.
  const decodedCall = tx.input && tx.input !== '0x'
    ? decoder.decodeCall(tx.input)
    : { name: 'native value transfer', args: { value: tx.value?.toString() ?? '0' }, raw: tx.input };

  // A2.6: decodificar cada log etiquetando si es externo al contrato objetivo.
  const decodedEvents: ContractEvent[] = receipt.logs.map(log => decoder.decodeEvent(log));

  // Construir el timeline de TraceEvent.
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
      // A2.6: etiquetar eventos de otros contratos como externos.
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
    emitted: [],   // EVM no produce sub-txs de Hooks; reservado para nativo.
    stateDiff: [], // State diff requiere debug_traceTransaction [verificar soporte en XRPL EVM].
    txHash,
    durationMs: Date.now() - t0,
  };
}

// ── Trace nativo (Xahau / XRPL Hooks testnet) ────────────────────────────────
//
// Modelo real confirmado 2026-06-09 contra hooks-testnet-v3.xrpl-labs.com:
//   meta.HookExecutions[]  → ejecuciones del Hook (resultado + returnString hex)
//   meta.AffectedNodes[]   → DeletedNode{EmittedTxn} → txs emitidas por el Hook
//
// Llama al método `tx` del JSON-RPC de XRPL (POST https://…).

export interface NativeTraceOptions {
  endpoint: string; // ej. https://hooks-testnet-v3.xrpl-labs.com
}

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

  const meta = result.meta as Record<string, unknown> | undefined;

  // El contrato "origen" es el HookAccount del primer HookExecution (si hay).
  const hookExecs = (meta?.HookExecutions as Array<{ HookExecution: Record<string, unknown> }> | undefined) ?? [];
  const firstHookAccount = hookExecs[0]?.HookExecution?.HookAccount as string | undefined;
  const contractAddress   = (firstHookAccount ?? result.Account as string ?? txHash).toLowerCase();

  const contractRef: ContractRef = { surface: 'alphanet', address: contractAddress };
  const events: TraceEvent[] = [];
  let t = 0;

  // 1. La llamada principal (el tx mismo).
  events.push({
    t: t++,
    kind: 'call',
    label: (result.TransactionType as string) ?? 'tx',
    data: {
      account:     result.Account,
      fee:         result.Fee,
      txType:      result.TransactionType,
      ...(result.EmitDetails ? { emitParent: (result.EmitDetails as Record<string, unknown>).EmitParentTxnID } : {}),
    },
  });

  // 2. HookExecutions → eventos decodificados.
  for (const { HookExecution: he } of hookExecs) {
    const returnHex = (he.HookReturnString as string) ?? '';
    let returnStr = returnHex;
    if (/^[0-9a-fA-F]+$/.test(returnHex) && returnHex.length > 0) {
      try { returnStr = Buffer.from(returnHex, 'hex').toString('utf8').replace(/\0/g, '').trim(); }
      catch { /* fallback hex */ }
    }
    const RESULT_NAMES: Record<number, string> = { 0: 'hxsAgain', 1: 'hxsSuccess', 2: 'hxsFallback', 3: 'hxsEnd' };
    const hookResult = (he.HookResult as number) ?? 0;

    events.push({
      t: t++,
      kind:  'event',
      label: `HookExecution[${he.HookExecutionIndex ?? 0}]`,
      data: {
        hookAccount:  he.HookAccount,
        hookHash:     String(he.HookHash ?? '').slice(0, 16) + '…',
        result:       RESULT_NAMES[hookResult] ?? String(hookResult),
        returnCode:   he.HookReturnCode,
        returnString: returnStr,
        emitCount:    he.HookEmitCount ?? 0,
      },
    });
  }

  // 3. EmittedTxn (DeletedNode en AffectedNodes) → emitidos por el Hook.
  const affectedNodes = (meta?.AffectedNodes as Array<Record<string, unknown>> | undefined) ?? [];
  for (const node of affectedNodes) {
    const del = node.DeletedNode as Record<string, unknown> | undefined;
    if (del?.LedgerEntryType === 'EmittedTxn') {
      const fields  = del.FinalFields as Record<string, unknown> | undefined;
      const emitted = fields?.EmittedTxn as Record<string, unknown> | undefined;
      events.push({
        t: t++,
        kind:  'emit',
        label: `EmittedTxn(${(emitted?.TransactionType as string) ?? '?'})`,
        data:  { account: emitted?.Account, txType: emitted?.TransactionType, fee: emitted?.Fee },
      });
    }
  }

  // 4. Resultado final.
  const txResult = (meta?.TransactionResult as string) ?? 'unknown';
  events.push({
    t: t++,
    kind:  'emit',
    label: txResult === 'tesSUCCESS' ? 'tx_success' : 'tx_failed',
    data:  { result: txResult, ledger: result.ledger_index ?? result.inLedger },
  });

  // La "call" del trace (datos resumidos del tx principal).
  const call = {
    name: (result.TransactionType as string) ?? 'tx',
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
