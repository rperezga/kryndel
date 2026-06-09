import type { Recorder } from '../recorder.js';
import { readString } from '../mem.js';

/**
 * Thrown by accept() and rollback() to terminate hook execution.
 * simulate.ts catches this and uses it as the final result.
 */
export class HookResult extends Error {
  constructor(
    public readonly decision: 'accept' | 'rollback',
    public readonly code: number,
    public readonly msg: string
  ) {
    super(`Hook ${decision}: ${msg} (code ${code})`);
    this.name = 'HookResult';
  }
}

/**
 * Creates the accept and rollback host functions bound to a Recorder and memory.
 */
export function createControlFunctions(
  recorder: Recorder,
  getMemory: () => WebAssembly.Memory | null
) {
  function readMsg(ptr: number, len: number): string {
    const mem = getMemory();
    if (!mem || len <= 0) return '';
    try {
      return readString(mem, ptr, len);
    } catch {
      return '';
    }
  }

  function accept(read_ptr: number, read_len: number, return_code: number): bigint {
    const msg = readMsg(read_ptr, read_len);
    recorder.record({ kind: 'decision', fn: 'accept', msg, value: String(return_code) });
    recorder.setResult({ decision: 'accept', code: return_code, msg });
    throw new HookResult('accept', return_code, msg);
  }

  function rollback(read_ptr: number, read_len: number, return_code: number): bigint {
    const msg = readMsg(read_ptr, read_len);
    recorder.record({ kind: 'decision', fn: 'rollback', msg, value: String(return_code) });
    recorder.setResult({ decision: 'rollback', code: return_code, msg });
    throw new HookResult('rollback', return_code, msg);
  }

  return { accept, rollback };
}
