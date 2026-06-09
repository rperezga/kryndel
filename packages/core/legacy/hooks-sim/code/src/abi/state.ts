import { readBytes, writeBytes } from '../mem.js';
import { DOESNT_EXIST, OUT_OF_BOUNDS, TOO_BIG, SUCCESS } from '../errors.js';
import type { Recorder } from '../recorder.js';
import { Ledger } from '../ledger.js';

const MAX_STATE_VALUE = 256; // bytes

/**
 * Creates state, state_set and state_foreign host functions.
 */
export function createStateFunctions(
  hookAccount: string,
  ledger: Ledger,
  recorder: Recorder,
  getMemory: () => WebAssembly.Memory | null
) {
  /**
   * state(write_ptr, write_len, kread_ptr, kread_len)
   * Reads hook state value for the given key into WASM memory.
   * Returns number of bytes written, or DOESNT_EXIST.
   */
  function state(
    write_ptr: number,
    write_len: number,
    kread_ptr: number,
    kread_len: number
  ): bigint {
    const mem = getMemory();
    if (!mem) return BigInt(OUT_OF_BOUNDS);

    // Read key from memory
    let keyBytes: Uint8Array;
    try {
      keyBytes = readBytes(mem, kread_ptr, kread_len);
    } catch {
      return BigInt(OUT_OF_BOUNDS);
    }
    const keyHex = Buffer.from(keyBytes).toString('hex');

    const valueHex = ledger.getHookState(hookAccount, keyHex);
    recorder.record({ kind: 'state_read', key: Ledger.normalizeKey(keyHex), value: valueHex ?? null });

    if (valueHex === undefined) return BigInt(DOESNT_EXIST);

    const valueBytes = Buffer.from(valueHex, 'hex');
    if (valueBytes.length > write_len) return BigInt(TOO_BIG);

    try {
      writeBytes(mem, write_ptr, valueBytes);
    } catch {
      return BigInt(OUT_OF_BOUNDS);
    }

    return BigInt(valueBytes.length);
  }

  /**
   * state_set(read_ptr, read_len, kread_ptr, kread_len)
   * Writes hook state. If read_len === 0, deletes the entry.
   * Returns SUCCESS or an error code.
   */
  function state_set(
    read_ptr: number,
    read_len: number,
    kread_ptr: number,
    kread_len: number
  ): bigint {
    const mem = getMemory();
    if (!mem) return BigInt(OUT_OF_BOUNDS);

    // Read key
    let keyBytes: Uint8Array;
    try {
      keyBytes = readBytes(mem, kread_ptr, kread_len);
    } catch {
      return BigInt(OUT_OF_BOUNDS);
    }
    const keyHex = Buffer.from(keyBytes).toString('hex');
    const normalizedKey = Ledger.normalizeKey(keyHex);

    // Delete if read_len === 0
    if (read_len === 0) {
      ledger.deleteHookState(hookAccount, keyHex);
      recorder.record({ kind: 'state_write', key: normalizedKey, value: null });
      return BigInt(SUCCESS);
    }

    if (read_len > MAX_STATE_VALUE) return BigInt(TOO_BIG);

    // Read value
    let valueBytes: Uint8Array;
    try {
      valueBytes = readBytes(mem, read_ptr, read_len);
    } catch {
      return BigInt(OUT_OF_BOUNDS);
    }
    const valueHex = Buffer.from(valueBytes).toString('hex');

    ledger.setHookState(hookAccount, keyHex, valueHex);
    recorder.record({ kind: 'state_write', key: normalizedKey, value: valueHex });

    return BigInt(SUCCESS);
  }

  /**
   * state_foreign — reads state of a different account.
   * MVP: same as state() but using the foreign account address from memory.
   */
  function state_foreign(
    write_ptr: number,
    write_len: number,
    kread_ptr: number,
    kread_len: number,
    aread_ptr: number,
    aread_len: number
  ): bigint {
    const mem = getMemory();
    if (!mem) return BigInt(OUT_OF_BOUNDS);

    // For MVP we just log it and return DOESNT_EXIST
    recorder.record({ kind: 'host_call', fn: 'state_foreign' });
    return BigInt(DOESNT_EXIST);
  }

  return { state, state_set, state_foreign };
}

export { Ledger };
