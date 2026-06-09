import { readBytes, readString } from '../mem.js';
import { OUT_OF_BOUNDS, SUCCESS } from '../errors.js';
import type { Recorder } from '../recorder.js';

/**
 * Creates trace, trace_num and trace_float host functions.
 * These are the hook's internal debug logging mechanism — they produce
 * trace_msg events that the viewer renders as a timeline.
 */
export function createTraceFunctions(
  recorder: Recorder,
  getMemory: () => WebAssembly.Memory | null
) {
  function readMsg(mread_ptr: number, mread_len: number): string {
    const mem = getMemory();
    if (!mem || mread_len <= 0) return '';
    try {
      return readString(mem, mread_ptr, mread_len);
    } catch {
      return '';
    }
  }

  /**
   * trace(mread_ptr, mread_len, dread_ptr, dread_len, as_hex) → i64
   * Logs a message + optional data buffer. as_hex=1 formats data as hex string.
   */
  function trace(
    mread_ptr: number,
    mread_len: number,
    dread_ptr: number,
    dread_len: number,
    as_hex: number
  ): bigint {
    const mem = getMemory();
    if (!mem) return BigInt(OUT_OF_BOUNDS);

    const msg = readMsg(mread_ptr, mread_len);

    let data: string | null = null;
    if (dread_len > 0) {
      try {
        const dataBytes = readBytes(mem, dread_ptr, dread_len);
        data = as_hex
          ? Buffer.from(dataBytes).toString('hex')
          : Buffer.from(dataBytes).toString('utf8');
      } catch {
        // ignore data read error, still record message
      }
    }

    recorder.record({ kind: 'trace_msg', fn: 'trace', msg, ...(data !== null && { value: data }) });
    return BigInt(SUCCESS);
  }

  /**
   * trace_num(mread_ptr, mread_len, number) → i64
   * Logs a message + a 64-bit integer value.
   */
  function trace_num(mread_ptr: number, mread_len: number, number: bigint): bigint {
    const msg = readMsg(mread_ptr, mread_len);
    recorder.record({ kind: 'trace_msg', fn: 'trace_num', msg, value: number.toString() });
    return BigInt(SUCCESS);
  }

  /**
   * trace_float(mread_ptr, mread_len, float) → i64
   * Logs a message + an XFL float (stored as i64 bit pattern).
   */
  function trace_float(mread_ptr: number, mread_len: number, float: bigint): bigint {
    const msg = readMsg(mread_ptr, mread_len);
    // Record the raw XFL bits as hex for now; the viewer can decode XFL later
    recorder.record({ kind: 'trace_msg', fn: 'trace_float', msg, value: `xfl:${float.toString()}` });
    return BigInt(SUCCESS);
  }

  return { trace, trace_num, trace_float };
}
