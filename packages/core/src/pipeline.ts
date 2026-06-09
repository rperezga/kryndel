import type { ContractRef, ContractEvent } from './types.js';
import type { WatchOptions, ContractActivity } from './watcher.js';
import type { Decoder } from './decoder.js';
import type { Indexer } from './indexer.js';
import type { Subscriber } from './subscriber.js';
import type { AlertDispatcher } from './alerts.js';

// Pipeline — watcher → decoder → indexer → subscriber → alerts.
// Cada pieza es opcional y reemplazable. Diseño desacoplado.

export interface PipelineOptions {
  /** Referencia al contrato vigilado (address, surface, ABI opcional). */
  contract: ContractRef;
  /** Opciones de conexión para el watcher (endpoint, onStatus). */
  watch: Omit<WatchOptions, 'surface' | 'contract'>;
  /** Decoder EVM o nativo. */
  decoder: Decoder;
  /** Indexer MongoDB. */
  indexer: Indexer;
  /**
   * Subscriber con reglas de alerta activas (opcional).
   * Si se provee, cada evento decodificado se evalúa contra las reglas.
   */
  subscriber?: Subscriber;
  /**
   * Dispatcher de alertas (Telegram/Discord/webhook).
   * Obligatorio si se provee subscriber.
   */
  dispatcher?: AlertDispatcher;
  /** Callback para observar actividad procesada (CLI, logs, etc.). */
  onActivity?: (activity: ContractActivity, decoded: { name: string; args: Record<string, unknown> }) => void;
  /** Callback de errores — el pipeline no lanza, solo reporta. */
  onError?: (err: unknown) => void;
}

export interface Pipeline {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export async function createPipeline(opts: PipelineOptions): Promise<Pipeline> {
  const { createNativeWatcher, createEvmWatcher } = await import('./watcher.js');

  const watcherOpts: WatchOptions = {
    surface:  opts.contract.surface,
    endpoint: opts.watch.endpoint,
    contract: opts.contract.address,
    onStatus: opts.watch.onStatus,
  };

  const watcher = opts.contract.surface === 'evm'
    ? createEvmWatcher(watcherOpts)
    : createNativeWatcher(watcherOpts);

  const ensureContract = async (): Promise<void> => {
    try { await opts.indexer.upsertContract(opts.contract); }
    catch (e) { opts.onError?.(e); }
  };

  const fireAlerts = async (decoded: ContractEvent): Promise<void> => {
    if (!opts.subscriber || !opts.dispatcher) return;
    // A2.8: eliminado array `matched` (era código muerto).
    const { matchesRule } = await import('./subscriber.js');
    for (const rule of opts.subscriber.rules()) {
      if (matchesRule(decoded, rule)) {
        try {
          await opts.dispatcher.dispatch(decoded, rule);
        } catch (e) {
          opts.onError?.(new Error(`Alert dispatch failed for rule ${rule.id}: ${String(e)}`));
        }
      }
    }
  };

  const handleActivity = async (activity: ContractActivity): Promise<void> => {
    try {
      let decoded: ContractEvent | undefined;

      if (activity.kind === 'call') {
        const raw = typeof activity.raw === 'string' ? activity.raw : JSON.stringify(activity.raw);
        const call = opts.decoder.decodeCall(raw);
        await opts.indexer.saveCall(activity.contract, call, activity.txHash);
        opts.onActivity?.(activity, { name: call.name, args: call.args });
        // Calls nativos también se evalúan como eventos para alertas.
        decoded = { name: call.name, args: call.args, txHash: activity.txHash };
      } else {
        decoded = opts.decoder.decodeEvent(activity.raw);
        // A2.4: propagar contractAddress para matchesRule.
        decoded = { ...decoded, contractAddress: activity.contract };
        await opts.indexer.saveEvent(activity.contract, decoded);
        opts.onActivity?.(activity, { name: decoded.name, args: decoded.args });
      }

      if (decoded) await fireAlerts(decoded);
    } catch (e) {
      opts.onError?.(e);
    }
  };

  return {
    async start(): Promise<void> {
      await ensureContract();
      await watcher.start(handleActivity);
    },
    async stop(): Promise<void> {
      await watcher.stop();
      await opts.indexer.close();
    },
  };
}
