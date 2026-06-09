import { readBytes, writeBytes } from '../mem.js';
import { OUT_OF_BOUNDS, SUCCESS, NOT_IMPLEMENTED } from '../errors.js';
import type { Recorder } from '../recorder.js';

/**
 * Creates emit, etxn_reserve, etxn_fee_base and related emission functions.
 *
 * MVP behaviour: hooks can call emit() and the emitted TX bytes are recorded
 * in the trace's `emitted` list. No actual transaction is submitted to the ledger.
 */
export function createEmitFunctions(
  recorder: Recorder,
  getMemory: () => WebAssembly.Memory | null
) {
  /**
   * etxn_reserve(count: i32) → i64
   * Declares that this hook will emit `count` transactions.
   * Must be called before emit(). Returns SUCCESS.
   */
  function etxn_reserve(count: number): bigint {
    recorder.record({ kind: 'host_call', fn: 'etxn_reserve', value: String(count) });
    return BigInt(SUCCESS);
  }

  /**
   * etxn_fee_base(tx_byte_count: i32) → i64
   * Returns the minimum fee (in drops) required to emit a transaction of
   * `tx_byte_count` bytes. MVP returns a fixed default of 100 drops.
   */
  function etxn_fee_base(tx_byte_count: number): bigint {
    const fee = 100n; // 100 drops default
    recorder.record({ kind: 'host_call', fn: 'etxn_fee_base', value: fee.toString() });
    return fee;
  }

  /**
   * etxn_nonce(write_ptr: i32, write_len: i32) → i64
   * Writes a 32-byte nonce for the emitted transaction.
   * MVP: writes zeros (a real implementation would derive a ledger nonce).
   */
  function etxn_nonce(write_ptr: number, write_len: number): bigint {
    const mem = getMemory();
    if (!mem) return BigInt(OUT_OF_BOUNDS);
    if (write_len < 32) return BigInt(OUT_OF_BOUNDS);
    try {
      writeBytes(mem, write_ptr, new Uint8Array(32));
    } catch {
      return BigInt(OUT_OF_BOUNDS);
    }
    recorder.record({ kind: 'host_call', fn: 'etxn_nonce' });
    return 32n;
  }

  /**
   * emit(write_ptr: i32, write_len: i32, read_ptr: i32, read_len: i32) → i64
   * Emits a serialised transaction (bytes at read_ptr/read_len).
   * Writes a 32-byte TX hash placeholder to write_ptr.
   * Records the emitted TX hex in the trace's `emitted` list.
   * Returns read_len (bytes read) on success.
   */
  function emit(
    write_ptr: number,
    write_len: number,
    read_ptr: number,
    read_len: number
  ): bigint {
    const mem = getMemory();
    if (!mem) return BigInt(OUT_OF_BOUNDS);

    // Read the serialised TX from WASM memory
    let txBytes: Uint8Array;
    try {
      txBytes = readBytes(mem, read_ptr, read_len);
    } catch {
      return BigInt(OUT_OF_BOUNDS);
    }

    const txHex = Buffer.from(txBytes).toString('hex');

    // Write a 32-byte zero placeholder hash back to write_ptr
    if (write_len >= 32) {
      try {
        writeBytes(mem, write_ptr, new Uint8Array(32));
      } catch {
        // non-fatal — hash placeholder failure doesn't abort the hook
      }
    }

    // Record in trace
    recorder.record({ kind: 'emit', fn: 'emit', value: txHex });
    recorder.addEmitted({ hex: txHex, byteLength: read_len });

    return BigInt(read_len);
  }

  return { etxn_reserve, etxn_fee_base, etxn_nonce, emit };
}
