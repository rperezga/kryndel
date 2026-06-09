import { createHash } from 'crypto';
import { readBytes, writeBytes } from '../mem.js';
import { OUT_OF_BOUNDS, TOO_BIG, TOO_SMALL, DOESNT_EXIST, NOT_IMPLEMENTED } from '../errors.js';
import { decodeAccountID, encodeAccountID } from 'ripple-address-codec';
import type { Recorder } from '../recorder.js';

/**
 * Creates util_sha512h, util_accid, util_keylet and related utility functions.
 */
export function createUtilFunctions(
  recorder: Recorder,
  getMemory: () => WebAssembly.Memory | null
) {
  /**
   * util_sha512h(write_ptr, write_len, read_ptr, read_len) → i64
   * Computes SHA-512 and writes the first 32 bytes ("half") to write_ptr.
   * Returns 32 on success.
   */
  function util_sha512h(
    write_ptr: number,
    write_len: number,
    read_ptr: number,
    read_len: number
  ): bigint {
    const mem = getMemory();
    if (!mem) return BigInt(OUT_OF_BOUNDS);

    if (write_len < 32) return BigInt(TOO_SMALL);

    let inputBytes: Uint8Array;
    try {
      inputBytes = readBytes(mem, read_ptr, read_len);
    } catch {
      return BigInt(OUT_OF_BOUNDS);
    }

    const hash = createHash('sha512').update(inputBytes).digest();
    const half = hash.subarray(0, 32);

    try {
      writeBytes(mem, write_ptr, half);
    } catch {
      return BigInt(OUT_OF_BOUNDS);
    }

    recorder.record({ kind: 'host_call', fn: 'util_sha512h', value: Buffer.from(half).toString('hex') });
    return BigInt(32);
  }

  /**
   * util_accid(write_ptr, write_len, read_ptr, read_len) → i64
   * Converts a classic r-address (ASCII in memory) to its 20-byte Account ID.
   * Returns 20 on success.
   */
  function util_accid(
    write_ptr: number,
    write_len: number,
    read_ptr: number,
    read_len: number
  ): bigint {
    const mem = getMemory();
    if (!mem) return BigInt(OUT_OF_BOUNDS);

    if (write_len < 20) return BigInt(TOO_SMALL);

    let addrBytes: Uint8Array;
    try {
      addrBytes = readBytes(mem, read_ptr, read_len);
    } catch {
      return BigInt(OUT_OF_BOUNDS);
    }

    const raddr = Buffer.from(addrBytes).toString('utf8').replace(/\0/g, '');

    let accountId: Uint8Array;
    try {
      accountId = decodeAccountID(raddr);
    } catch {
      return BigInt(DOESNT_EXIST);
    }

    try {
      writeBytes(mem, write_ptr, accountId);
    } catch {
      return BigInt(OUT_OF_BOUNDS);
    }

    recorder.record({ kind: 'host_call', fn: 'util_accid', value: Buffer.from(accountId).toString('hex') });
    return BigInt(20);
  }

  /**
   * util_raddr(write_ptr, write_len, read_ptr, read_len) → i64
   * Converts a 20-byte Account ID to a classic r-address (reverse of util_accid).
   */
  function util_raddr(
    write_ptr: number,
    write_len: number,
    read_ptr: number,
    read_len: number
  ): bigint {
    const mem = getMemory();
    if (!mem) return BigInt(OUT_OF_BOUNDS);

    if (read_len !== 20) return BigInt(DOESNT_EXIST);

    let accountIdBytes: Uint8Array;
    try {
      accountIdBytes = readBytes(mem, read_ptr, read_len);
    } catch {
      return BigInt(OUT_OF_BOUNDS);
    }

    let raddr: string;
    try {
      raddr = encodeAccountID(Buffer.from(accountIdBytes));
    } catch {
      return BigInt(DOESNT_EXIST);
    }

    const raddrBytes = Buffer.from(raddr, 'utf8');
    if (raddrBytes.length > write_len) return BigInt(TOO_BIG);

    try {
      writeBytes(mem, write_ptr, raddrBytes);
    } catch {
      return BigInt(OUT_OF_BOUNDS);
    }

    recorder.record({ kind: 'host_call', fn: 'util_raddr', value: raddr });
    return BigInt(raddrBytes.length);
  }

  /**
   * util_keylet(write_ptr, write_len, keylet_type, ...) → i64
   * Generates a 34-byte keylet for the given type and parameters.
   * MVP: implements ACCOUNT (type 1) only; others return NOT_IMPLEMENTED.
   *
   * Keylet types relevant for MVP: 1=ACCOUNT
   */
  function util_keylet(
    write_ptr: number,
    write_len: number,
    b: number,  // keylet type
    c: number, d: number, e: number,
    f: number, g: number, h: number,
    i: number, j: number, k: number
  ): bigint {
    const mem = getMemory();
    if (!mem) return BigInt(OUT_OF_BOUNDS);

    if (write_len < 34) return BigInt(TOO_SMALL);

    recorder.record({ kind: 'host_call', fn: 'util_keylet', value: `type:${b}` });

    // For MVP, all keylet types are stubbed — return NOT_IMPLEMENTED
    // A full implementation would build the 34-byte keylet per XRPL spec
    return BigInt(NOT_IMPLEMENTED);
  }

  return { util_sha512h, util_accid, util_raddr, util_keylet };
}
