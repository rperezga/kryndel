import type { Trace, TraceEvent, TraceResult, XrplTransaction } from './types.js';

/**
 * Recorder accumulates ordered events during a Hook simulation run
 * and produces the final Trace JSON.
 */
export class Recorder {
  private readonly events: TraceEvent[] = [];
  private readonly startMs: number = Date.now();
  private result: TraceResult | null = null;
  private stateDiff: Trace['stateDiff'] = [];
  private emitted: unknown[] = [];
  private seq = 0;

  record(event: Omit<TraceEvent, 't'>): void {
    this.events.push({ t: this.seq++, ...event } as TraceEvent);
  }

  setResult(result: TraceResult): void {
    this.result = result;
  }

  setStateDiff(diff: Trace['stateDiff']): void {
    this.stateDiff = diff;
  }

  addEmitted(tx: unknown): void {
    this.emitted.push(tx);
  }

  toTrace(hookPath: string, tx: XrplTransaction): Trace {
    if (!this.result) {
      throw new Error('toTrace() called before setResult()');
    }
    return {
      hook: hookPath,
      tx,
      events: [...this.events],
      result: this.result,
      stateDiff: this.stateDiff,
      emitted: this.emitted,
      durationMs: Date.now() - this.startMs,
    };
  }
}
