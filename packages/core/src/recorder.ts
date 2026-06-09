import type {
  Trace, TraceEvent, ContractRef, DecodedCall, EmittedTx, StateChange,
} from './types.js';

// Recorder — arma el trace estructurado de una llamada a contrato.
// Patrón REUTILIZADO del simulador de Hooks (legacy/hooks-sim/code/src/recorder.ts).
export class Recorder {
  private events: TraceEvent[] = [];
  private emitted: EmittedTx[] = [];
  private stateDiff: StateChange[] = [];
  private call?: DecodedCall;
  private readonly start = Date.now();

  setCall(call: DecodedCall): void { this.call = call; }
  record(ev: Omit<TraceEvent, 't'>): void { this.events.push({ t: this.events.length, ...ev }); }
  addEmitted(tx: EmittedTx): void { this.emitted.push(tx); }
  setStateDiff(diff: StateChange[]): void { this.stateDiff = diff; }

  toTrace(contract: ContractRef, txHash?: string): Trace {
    return {
      contract,
      call: this.call,
      events: this.events,
      emitted: this.emitted,
      stateDiff: this.stateDiff,
      txHash,
      durationMs: Date.now() - this.start,
    };
  }
}
