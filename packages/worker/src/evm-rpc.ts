/**
 * Shared EVM RPC transport for the worker. Version 1.0.0.
 *
 * Keeps transient provider failures local to the worker and never logs response
 * bodies, which may contain untrusted provider content.
 */

export const RPC_RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000] as const;
export const RPC_REQUEST_TIMEOUT_MS = 20_000;
export const RETRY_JITTER_RATIO = 0.2;
export const EVM_POLL_INTERVAL_MS = 10_000;

export interface RpcRetryEvent {
  method: string;
  reason: 'http_403' | 'http_408' | 'http_429' | 'http_5xx' | 'network';
}

interface RpcRetryWarningAggregatorOptions {
  logger?: (message: string) => void;
  intervalMs?: number;
  autoStart?: boolean;
}

/** Aggregate retried provider failures so 16 watchers cannot flood the logs. */
export class RpcRetryWarningAggregator {
  private readonly logger: (message: string) => void;
  private readonly intervalMs: number;
  private readonly reasons = new Map<string, number>();
  private readonly methods = new Map<string, number>();
  private total = 0;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(options: RpcRetryWarningAggregatorOptions = {}) {
    this.logger = options.logger ?? ((message) => console.warn(message));
    this.intervalMs = options.intervalMs ?? 60_000;
    if (options.autoStart !== false) {
      this.timer = setInterval(() => this.flush(), this.intervalMs);
      this.timer.unref?.();
    }
  }

  record(event: RpcRetryEvent): void {
    this.total++;
    this.reasons.set(event.reason, (this.reasons.get(event.reason) ?? 0) + 1);
    this.methods.set(event.method, (this.methods.get(event.method) ?? 0) + 1);
  }

  flush(): void {
    if (this.total === 0) return;
    const format = (counts: Map<string, number>): string =>
      [...counts.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, count]) => `${name}:${count}`)
        .join(',');
    this.logger(
      `[evm-rpc] transient retries (${Math.round(this.intervalMs / 1_000)}s): ` +
      `total=${this.total} reasons=${format(this.reasons)} methods=${format(this.methods)}`,
    );
    this.total = 0;
    this.reasons.clear();
    this.methods.clear();
  }

  stop(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
    this.flush();
  }
}

interface RpcRequestDependencies {
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  onRetry?: (event: RpcRetryEvent) => void;
  timeoutMs?: number;
  signal?: AbortSignal;
}

class RpcAttemptError extends Error {
  constructor(
    message: string,
    readonly transient: boolean,
    readonly reason?: RpcRetryEvent['reason'],
  ) {
    super(message);
    this.name = 'RpcAttemptError';
  }
}

function transientHttpReason(status: number): RpcRetryEvent['reason'] | undefined {
  if (status === 403) return 'http_403';
  if (status === 408) return 'http_408';
  if (status === 429) return 'http_429';
  if (status >= 500) return 'http_5xx';
  return undefined;
}

function jitteredDelay(baseMs: number, random: () => number): number {
  const factor = 1 + (random() * 2 - 1) * RETRY_JITTER_RATIO;
  return Math.max(0, Math.round(baseMs * factor));
}

async function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('RPC request cancelled'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    timer.unref?.();
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(new Error('RPC request cancelled'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function requestOnce<T>(
  endpoint: string,
  method: string,
  params: unknown[],
  fetchFn: typeof fetch,
  timeoutMs: number,
  externalSignal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const abortFromCaller = (): void => controller.abort();
  if (externalSignal?.aborted) controller.abort();
  else externalSignal?.addEventListener('abort', abortFromCaller, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();

  let response: Response;
  try {
    response = await fetchFn(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    });
  } catch (error) {
    if (externalSignal?.aborted) {
      throw new RpcAttemptError('request cancelled', false);
    }
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : 'fetch failed';
    throw new RpcAttemptError(`network error (${detail})`, true, 'network');
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', abortFromCaller);
  }

  if (!response.ok) {
    const reason = transientHttpReason(response.status);
    throw new RpcAttemptError(`HTTP ${response.status}`, reason !== undefined, reason);
  }

  let payload: { result?: T; error?: { code?: number; message?: string } };
  try {
    payload = await response.json() as typeof payload;
  } catch {
    throw new RpcAttemptError('invalid JSON response', false);
  }
  if (payload.error) {
    // Provider messages are untrusted; expose only the numeric category.
    throw new RpcAttemptError(`RPC ${payload.error.code ?? 'error'}`, false);
  }
  if (!Object.prototype.hasOwnProperty.call(payload, 'result')) {
    throw new RpcAttemptError('RPC response has no result', false);
  }
  return payload.result as T;
}

/**
 * Execute one JSON-RPC method with one initial attempt plus five transient retries.
 * Retry delays are 1/2/4/8/16 seconds with ±20% jitter.
 */
export async function rpcRequest<T>(
  endpoint: string,
  method: string,
  params: unknown[],
  dependencies: RpcRequestDependencies = {},
): Promise<T> {
  const fetchFn = dependencies.fetchFn ?? fetch;
  const sleep = dependencies.sleep ?? ((ms: number) => defaultSleep(ms, dependencies.signal));
  const random = dependencies.random ?? Math.random;
  const timeoutMs = dependencies.timeoutMs ?? RPC_REQUEST_TIMEOUT_MS;

  for (let attempt = 0; ; attempt++) {
    if (dependencies.signal?.aborted) {
      throw new Error(`RPC ${method} request cancelled`);
    }
    try {
      return await requestOnce<T>(
        endpoint,
        method,
        params,
        fetchFn,
        timeoutMs,
        dependencies.signal,
      );
    } catch (error) {
      const rpcError = error instanceof RpcAttemptError
        ? error
        : new RpcAttemptError(error instanceof Error ? error.message : String(error), false);
      const retryDelay = RPC_RETRY_DELAYS_MS[attempt];
      if (!rpcError.transient || retryDelay === undefined || !rpcError.reason) {
        throw new Error(
          `RPC ${method} failed after ${attempt + 1} attempt(s): ${rpcError.message}`,
          { cause: error },
        );
      }
      dependencies.onRetry?.({ method, reason: rpcError.reason });
      await sleep(jitteredDelay(retryDelay, random));
    }
  }
}

export interface EvmRpcActivity {
  kind: 'event';
  contract: string;
  name?: string;
  raw: unknown;
  txHash?: string;
}

type EvmActivityHandler = (activity: EvmRpcActivity) => void | Promise<void>;
type RpcMethodRequest = (method: string, params: unknown[]) => Promise<unknown>;
type PollerStatus = 'connecting' | 'open' | 'subscribed' | 'ok' | 'error' | 'close';

interface SharedEvmPollerOptions {
  request?: RpcMethodRequest;
  random?: () => number;
  autoStart?: boolean;
  onStatus?: (status: PollerStatus, detail?: string) => void;
  warnings?: RpcRetryWarningAggregator;
}

interface RpcBlock {
  hash?: string | null;
}

interface RpcLog {
  address?: string;
  topics?: unknown[];
  logIndex?: unknown;
  blockNumber?: unknown;
  transactionHash?: string | null;
}

function parseHexQuantity(value: unknown): bigint | undefined {
  if (typeof value !== 'string' || !/^0x[0-9a-f]+$/i.test(value)) return undefined;
  return BigInt(value);
}

export interface EvmPollResult {
  headBlock: bigint;
  targetBlock: bigint;
  logs: number;
  subscribers: number;
}

export function jitteredIntervalMs(random: () => number = Math.random): number {
  return jitteredDelay(EVM_POLL_INTERVAL_MS, random);
}

/** One EVM polling pipeline shared by every worker watcher. */
export class SharedEvmPoller {
  private readonly subscribers = new Map<string, Set<EvmActivityHandler>>();
  private readonly request: RpcMethodRequest;
  private readonly random: () => number;
  private readonly autoStart: boolean;
  private readonly onStatus?: SharedEvmPollerOptions['onStatus'];
  private readonly warnings: RpcRetryWarningAggregator;
  private readonly abortController = new AbortController();
  private readonly inFlightHandlers = new Set<Promise<void>>();
  private readonly inFlightPolls = new Set<Promise<EvmPollResult>>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running = false;
  private closed = false;
  private lastProcessedBlock: bigint | null = null;

  constructor(
    private readonly endpoint: string,
    options: SharedEvmPollerOptions = {},
  ) {
    this.random = options.random ?? Math.random;
    this.autoStart = options.autoStart !== false;
    this.onStatus = options.onStatus;
    this.warnings = options.warnings ?? new RpcRetryWarningAggregator();
    this.request = options.request ?? ((method, params) => rpcRequest(
      this.endpoint,
      method,
      params,
      {
        onRetry: (event) => this.warnings.record(event),
        signal: this.abortController.signal,
      },
    ));
  }

  get subscriberCount(): number {
    let count = 0;
    for (const handlers of this.subscribers.values()) count += handlers.size;
    return count;
  }

  subscribe(address: string, handler: EvmActivityHandler): () => void {
    if (this.closed) throw new Error('EVM poller is closed');
    const normalized = address.toLowerCase();
    const handlers = this.subscribers.get(normalized) ?? new Set<EvmActivityHandler>();
    handlers.add(handler);
    this.subscribers.set(normalized, handlers);

    if (this.autoStart && !this.running) {
      this.running = true;
      this.onStatus?.('connecting');
      this.onStatus?.('open');
      this.onStatus?.('subscribed', `watchers=${this.subscriberCount}`);
      void this.runLoop();
    }

    return () => {
      const current = this.subscribers.get(normalized);
      current?.delete(handler);
      if (current?.size === 0) this.subscribers.delete(normalized);
      if (this.subscriberCount === 0 && this.timer !== undefined) {
        clearTimeout(this.timer);
        this.timer = undefined;
        this.running = false;
      }
    };
  }

  createWatcher(address: string): {
    start(handler: EvmActivityHandler): Promise<void>;
    stop(): Promise<void>;
  } {
    let unsubscribe: (() => void) | undefined;
    return {
      start: async (handler) => {
        unsubscribe?.();
        unsubscribe = this.subscribe(address, handler);
      },
      stop: async () => {
        unsubscribe?.();
        unsubscribe = undefined;
      },
    };
  }

  async pollOnce(): Promise<EvmPollResult> {
    const poll = this.performPoll();
    this.inFlightPolls.add(poll);
    void poll.then(
      () => this.inFlightPolls.delete(poll),
      () => this.inFlightPolls.delete(poll),
    );
    return poll;
  }

  private async performPoll(): Promise<EvmPollResult> {
    const headHex = await this.request('eth_blockNumber', []);
    if (typeof headHex !== 'string' || !/^0x[0-9a-f]+$/i.test(headHex)) {
      throw new Error('RPC eth_blockNumber returned an invalid result');
    }
    const headBlock = BigInt(headHex);
    const targetBlock = headBlock > 2n ? headBlock - 2n : headBlock;
    if (this.lastProcessedBlock === targetBlock) {
      return { headBlock, targetBlock, logs: 0, subscribers: this.subscriberCount };
    }

    const firstBlock = this.lastProcessedBlock !== null && targetBlock > this.lastProcessedBlock
      ? this.lastProcessedBlock + 1n
      : targetBlock;
    let totalLogs = 0;

    for (let blockNumberToRead = firstBlock; blockNumberToRead <= targetBlock; blockNumberToRead++) {
      const block = await this.request('eth_getBlockByNumber', [
        `0x${blockNumberToRead.toString(16)}`,
        false,
      ]) as RpcBlock | null;
      if (!block?.hash) throw new Error('RPC eth_getBlockByNumber returned no block hash');

      const result = await this.request('eth_getLogs', [{ blockHash: block.hash }]);
      if (!Array.isArray(result)) throw new Error('RPC eth_getLogs returned a non-array result');

      for (const raw of result as RpcLog[]) {
        if (typeof raw.address !== 'string') continue;
        const contract = raw.address.toLowerCase();
        const handlers = this.subscribers.get(contract);
        if (!handlers?.size) continue;
        const topic0 = Array.isArray(raw.topics) && typeof raw.topics[0] === 'string'
          ? raw.topics[0]
          : undefined;
        const logIndex = parseHexQuantity(raw.logIndex);
        const blockNumber = parseHexQuantity(raw.blockNumber);
        const normalizedRaw = {
          ...raw,
          logIndex: logIndex !== undefined && logIndex <= BigInt(Number.MAX_SAFE_INTEGER)
            ? Number(logIndex)
            : undefined,
          blockNumber,
        };
        const activity: EvmRpcActivity = {
          kind: 'event',
          contract,
          name: topic0,
          raw: normalizedRaw,
          txHash: typeof raw.transactionHash === 'string' ? raw.transactionHash : undefined,
        };
        const deliveries: Promise<void>[] = [];
        for (const handler of handlers) {
          let delivery: Promise<void>;
          try {
            delivery = Promise.resolve(handler(activity));
          } catch (error) {
            delivery = Promise.reject(error);
          }
          this.inFlightHandlers.add(delivery);
          void delivery.then(
            () => this.inFlightHandlers.delete(delivery),
            () => this.inFlightHandlers.delete(delivery),
          );
          deliveries.push(delivery);
        }
        await Promise.all(deliveries);
      }

      totalLogs += result.length;
      // Bugfix: advance only after this block's logs were fetched and dispatched.
      this.lastProcessedBlock = blockNumberToRead;
    }

    return {
      headBlock,
      targetBlock,
      logs: totalLogs,
      subscribers: this.subscriberCount,
    };
  }

  async stop(): Promise<void> {
    this.closed = true;
    this.running = false;
    this.abortController.abort();
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.subscribers.clear();
    await Promise.allSettled([
      ...this.inFlightPolls,
      ...this.inFlightHandlers,
    ]);
    this.warnings.stop();
    this.onStatus?.('close');
  }

  private async runLoop(): Promise<void> {
    if (this.closed || this.subscriberCount === 0) {
      this.running = false;
      return;
    }
    try {
      const result = await this.pollOnce();
      this.onStatus?.(
        'ok',
        `head=${result.headBlock} target=${result.targetBlock} logs=${result.logs} watchers=${result.subscribers}`,
      );
    } catch (error) {
      this.onStatus?.('error', error instanceof Error ? error.message : String(error));
    }
    if (!this.closed && this.subscriberCount > 0) {
      const delay = jitteredIntervalMs(this.random);
      this.timer = setTimeout(() => {
        this.timer = undefined;
        void this.runLoop();
      }, delay);
      this.timer.unref?.();
    } else {
      this.running = false;
    }
  }
}
