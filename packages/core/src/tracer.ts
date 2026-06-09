import { createPublicClient, http, type Abi } from 'viem';
import { createEvmDecoder, ERC20_ABI } from './decoder.js';
import type { ContractRef, Trace, TraceEvent, ContractEvent } from './types.js';

// Tracer — obtiene el receipt de un tx EVM y produce un Trace estructurado.
// Etapa 5 ✅

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

  // Obtener tx + receipt en paralelo.
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
  const decodedCall = tx.input && tx.input !== '0x'
    ? decoder.decodeCall(tx.input)
    : { name: 'transfer (value only)', args: { value: tx.value?.toString() ?? '0' }, raw: tx.input };

  // Decodificar cada log del receipt.
  const decodedEvents: ContractEvent[] = receipt.logs.map(log =>
    decoder.decodeEvent(log)
  );

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
    ...decodedEvents.map((ev, i): TraceEvent => ({
      t: i + 1,
      kind: 'event',
      label: ev.name,
      data: ev.args,
    })),
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
