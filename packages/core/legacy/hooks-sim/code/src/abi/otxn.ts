import { encode, decode } from 'ripple-binary-codec';
import { writeBytes } from '../mem.js';
import { DOESNT_EXIST, TOO_BIG, OUT_OF_BOUNDS } from '../errors.js';
import { getFieldName, getTxTypeCode } from '../fieldcodes.js';
import type { Recorder } from '../recorder.js';
import type { XrplTransaction } from '../types.js';

/**
 * Creates otxn_field, otxn_type, and otxn_id host functions
 * bound to the current transaction and memory.
 */
export function createOtxnFunctions(
  tx: XrplTransaction,
  recorder: Recorder,
  getMemory: () => WebAssembly.Memory | null
) {
  /**
   * otxn_field(write_ptr, write_len, field_id)
   * Writes the serialized field value into WASM memory.
   * Returns the number of bytes written, or DOESNT_EXIST / TOO_BIG / OUT_OF_BOUNDS.
   */
  function otxn_field(write_ptr: number, write_len: number, field_id: number): bigint {
    const fieldName = getFieldName(field_id);

    recorder.record({ kind: 'host_call', fn: 'otxn_field', key: String(field_id), value: fieldName });

    if (!fieldName) return BigInt(DOESNT_EXIST);

    const rawValue = tx[fieldName];
    if (rawValue === undefined || rawValue === null) return BigInt(DOESNT_EXIST);

    // Serialize the field using ripple-binary-codec
    let bytes: Uint8Array;
    try {
      // Build a minimal tx with just this field and encode it,
      // then extract the field bytes (skip the field prefix for MVP simplicity)
      const serialized = encode({ [fieldName]: rawValue } as Record<string, unknown>);
      bytes = Buffer.from(serialized, 'hex');
    } catch {
      return BigInt(DOESNT_EXIST);
    }

    if (bytes.length > write_len) return BigInt(TOO_BIG);

    const mem = getMemory();
    if (!mem) return BigInt(OUT_OF_BOUNDS);

    try {
      writeBytes(mem, write_ptr, bytes);
    } catch {
      return BigInt(OUT_OF_BOUNDS);
    }

    return BigInt(bytes.length);
  }

  /**
   * otxn_type()
   * Returns the numeric transaction type code.
   */
  function otxn_type(): bigint {
    const code = getTxTypeCode(tx.TransactionType);
    recorder.record({ kind: 'host_call', fn: 'otxn_type', value: tx.TransactionType });
    return BigInt(code);
  }

  /**
   * otxn_id(write_ptr, write_len, flags)
   * Writes the transaction hash (32 bytes) into WASM memory.
   * MVP: writes 32 zero bytes as a placeholder if no hash is present.
   */
  function otxn_id(write_ptr: number, write_len: number, _flags: number): bigint {
    recorder.record({ kind: 'host_call', fn: 'otxn_id' });

    const hash = tx['hash'] as string | undefined;
    const bytes = hash
      ? Buffer.from(hash, 'hex')
      : Buffer.alloc(32, 0);

    if (bytes.length > write_len) return BigInt(TOO_BIG);

    const mem = getMemory();
    if (!mem) return BigInt(OUT_OF_BOUNDS);

    try {
      writeBytes(mem, write_ptr, bytes);
    } catch {
      return BigInt(OUT_OF_BOUNDS);
    }

    return BigInt(bytes.length);
  }

  return { otxn_field, otxn_type, otxn_id };
}
