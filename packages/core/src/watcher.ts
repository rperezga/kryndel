import { createPublicClient, http } from 'viem';
import type { ContractRef, Surface } from './types.js';

// Watcher — observa transacciones/eventos de contrato.
// EVM: RPC del XRPL EVM Sidechain (mainnet) vía `viem`. Etapa 3 ✅
// Nativo: WebSocket a rippled/Clio (AlphaNet). Contratos XLS-0101: viven en una pseudo-cuenta
// y se disparan con ContractCall. En vivo en AlphaNet desde 2025-11-07. Etapa 2 ✅

export type WatcherStatus = 'connecting' | 'open' | 'subscribed' | 'close' | 'error';

export interface WatchOptions {
  surface: Surface;
  endpoint: string;   // WS (nativo) | RPC URL (EVM) — desde variables de entorno
  contract?: string;  // address concreto a vigilar (opcional)
  onStatus?: (status: WatcherStatus, detail?: string) => void; // observabilidad de la conexión
}

export type ContractActivity =
  | { kind: 'call'; contract: string; txType: string; raw: unknown; txHash?: string }
  | { kind: 'event'; contract: string; name?: string; raw: unknown; txHash?: string };

export interface Watcher {
  start(onActivity: (a: ContractActivity) => void): Promise<void>;
  stop(): Promise<void>;
}

// Tipos de transacción de contratos nativos (XLS-0101). Implementados en AlphaNet:
// ContractCreate, ContractCall, ContractModify, ContractDelete.
// En la spec pero NOT IMPLEMENTED aún: ContractUserDelete, ContractClawback. [verificado xls.xrpl.org]
export const CONTRACT_TX_TYPES = [
  'ContractCreate',
  'ContractCall',
  'ContractModify',
  'ContractDelete',
  'ContractUserDelete',
  'ContractClawback',
] as const;
export type ContractTxType = (typeof CONTRACT_TX_TYPES)[number];

export function isContractTxType(t: unknown): t is ContractTxType {
  return typeof t === 'string' && (CONTRACT_TX_TYPES as readonly string[]).includes(t);
}

// Parser PURO (testeable sin red) de un mensaje del stream "transactions" de rippled/Clio.
// Soporta { transaction: {...} } (API v1) y { tx_json: {...} } (API v2). [verificar forma exacta en AlphaNet]
export function parseTransactionMessage(msg: unknown): ContractActivity | null {
  if (!msg || typeof msg !== 'object') return null;
  const m = msg as Record<string, unknown>;
  if (m.type !== 'transaction') return null;

  const tx = (m.transaction ?? m.tx_json) as Record<string, unknown> | undefined;
  if (!tx || typeof tx !== 'object') return null;

  const txType = tx.TransactionType;
  if (!isContractTxType(txType)) return null;

  const contract =
    (tx.Destination as string | undefined) ??
    (tx.ContractAccount as string | undefined) ??
    (tx.Account as string | undefined) ??
    'unknown';

  const txHash = (m.hash as string | undefined) ?? (tx.hash as string | undefined);

  return { kind: 'call', contract, txType: txType as string, raw: tx, txHash };
}

// WebSocket nativo global (Node ≥ 22). Evita dependencias extra y @types/ws.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const WS: any = (globalThis as { WebSocket?: unknown }).WebSocket;

export function createNativeWatcher(opts: WatchOptions): Watcher {
  if (!WS) {
    throw new Error('WebSocket global no disponible — requiere Node ≥ 22 (o usa el paquete `ws`).');
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let socket: any;
  let stopped = false;
  let backoff = 1000;
  const status = (s: WatcherStatus, d?: string): void => opts.onStatus?.(s, d);

  function connect(onActivity: (a: ContractActivity) => void): void {
    status('connecting', opts.endpoint);
    socket = new WS(opts.endpoint);

    socket.addEventListener('open', () => {
      backoff = 1000;
      status('open');
      socket.send(JSON.stringify({ id: 'kryndel-sub', command: 'subscribe', streams: ['transactions'] }));
      status('subscribed');
    });

    socket.addEventListener('message', (ev: { data: unknown }) => {
      let msg: unknown;
      try {
        msg = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data));
      } catch {
        return;
      }
      const activity = parseTransactionMessage(msg);
      if (!activity) return;
      if (opts.contract && activity.contract !== opts.contract) return;
      onActivity(activity);
    });

    socket.addEventListener('close', () => {
      status('close');
      if (!stopped) scheduleReconnect(onActivity);
    });
    socket.addEventListener('error', (e: unknown) => {
      status('error', String((e as { message?: string })?.message ?? e ?? 'ws error'));
      try { socket.close(); } catch { /* noop */ }
    });
  }

  function scheduleReconnect(onActivity: (a: ContractActivity) => void): void {
    const wait = backoff;
    backoff = Math.min(backoff * 2, 30_000);
    setTimeout(() => { if (!stopped) connect(onActivity); }, wait);
  }

  return {
    async start(onActivity) { stopped = false; connect(onActivity); },
    async stop() { stopped = true; try { socket?.close(); } catch { /* noop */ } },
  };
}

// EVM watcher — XRPL EVM Sidechain (mainnet) via viem.
// Usa polling HTTP (no requiere WS); watchEvent llama getLogs periódicamente.
// EVM_RPC_URL = endpoint del sidechain (p.ej. https://rpc.xrplevm.org).
// Si opts.contract está definido, filtra por address; si no, escucha todos los logs.
// [verificar] chain ID exacto del sidechain mainnet (no necesario para getLogs/watchEvent sin ENS).
export function createEvmWatcher(opts: WatchOptions): Watcher {
  const isEvmAddress = (s: string): s is `0x${string}` => /^0x[0-9a-fA-F]{40}$/.test(s);

  const client = createPublicClient({
    transport: http(opts.endpoint, {
      timeout: 20_000,
      retryCount: 3,
      retryDelay: 1_500,
    }),
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const status = (s: WatcherStatus, d?: string): void => opts.onStatus?.(s, d);

  return {
    async start(onActivity) {
      stopped = false;
      status('connecting', opts.endpoint);

      // Smoke-check: confirmar que el RPC responde antes de empezar a escuchar.
      try {
        await client.getBlockNumber();
        status('open');
      } catch (e) {
        status('error', `RPC no disponible: ${String((e as Error)?.message ?? e)}`);
        return;
      }

      const address =
        opts.contract && isEvmAddress(opts.contract) ? opts.contract : undefined;

      status('subscribed');

      // A2.6/blockHash: XRPL EVM RPC rechaza eth_getLogs con block range (fromBlock/toBlock).
      // Workaround: obtener el latest block por tag y consultar sus logs por blockHash.
      // Dedup por "blockHash:logIndex" para evitar emitir el mismo log dos veces.
      // A2.7: poda parcial — elimina la mitad más vieja al superar el límite.
      let lastBlockHash: `0x${string}` | null = null;
      const seen = new Map<string, number>(); // key → orden de inserción
      let seenCounter = 0;
      const SEEN_MAX = 2_000;

      const poll = async (): Promise<void> => {
        if (stopped) return;
        try {
          // Consultar 2 bloques atrás del latest para que CometBFT ya lo tenga indexado.
          const latestNum = await client.getBlockNumber();
          const targetNum = latestNum > 2n ? latestNum - 2n : latestNum;
          const block = await client.getBlock({ blockNumber: targetNum });
          if (!block.hash || block.hash === lastBlockHash) {
            // Mismo bloque que el poll anterior — nada nuevo.
          } else {
            lastBlockHash = block.hash;
            // XRPL EVM Sidechain acepta eth_getLogs por blockHash (sin range).
            const logs = await client.getLogs({ blockHash: block.hash });
            for (const log of logs) {
              if (stopped) break;
              if (address && log.address.toLowerCase() !== address.toLowerCase()) continue;
              const key = `${block.hash}:${String(log.logIndex)}`;
            if (seen.has(key)) continue;
            seen.set(key, seenCounter++);
            // Poda parcial: al superar SEEN_MAX, borra la mitad más vieja.
            if (seen.size > SEEN_MAX) {
              const cutoff = seenCounter - SEEN_MAX / 2;
              for (const [k, idx] of seen) {
                if (idx < cutoff) seen.delete(k);
              }
            }
            const topic0 = log.topics[0] ?? undefined;
            onActivity({
              kind: 'event',
              contract: log.address.toLowerCase(),
              name: topic0,
              raw: log,
              txHash: log.transactionHash ?? undefined,
            });
            }
          } // end else (new block)
        } catch (e) {
          status('error', (e as Error)?.message ?? String(e));
        }
        if (!stopped) timer = setTimeout(() => { void poll(); }, 4_000);
      };

      void poll();
    },

    async stop() {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
    },
  };
}

export type { ContractRef };
