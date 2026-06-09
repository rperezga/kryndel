import { writeBytes, readBytes } from '../mem.js';
import { DOESNT_EXIST, OUT_OF_BOUNDS, TOO_BIG } from '../errors.js';
import type { Recorder } from '../recorder.js';
import { decodeAccountID } from 'ripple-address-codec';

/**
 * Creates hook_account, hook_param and related context functions.
 */
export function createHookFunctions(
  hookAccount: string,
  hookParams: Record<string, string>,
  recorder: Recorder,
  getMemory: () => WebAssembly.Memory | null
) {
  /**
   * hook_account(write_ptr, write_len)
   * Writes the 20-byte Account ID (decoded from base58 address) into WASM memory.
   */
  function hook_account(write_ptr: number, write_len: number): bigint {
    recorder.record({ kind: 'host_call', fn: 'hook_account', value: hookAccount });

    let accountId: Uint8Array;
    try {
      accountId = decodeAccountID(hookAccount);
    } catch {
      return BigInt(DOESNT_EXIST);
    }

    if (accountId.length > write_len) return BigInt(TOO_BIG);

    const mem = getMemory();
    if (!mem) return BigInt(OUT_OF_BOUNDS);

    try {
      writeBytes(mem, write_ptr, accountId);
    } catch {
      return BigInt(OUT_OF_BOUNDS);
    }

    return BigInt(accountId.length);
  }

  /**
   * hook_param(write_ptr, write_len, read_ptr, read_len)
   * Reads a hook parameter name from memory and writes its value back.
   */
  function hook_param(
    write_ptr: number,
    write_len: number,
    read_ptr: number,
    read_len: number
  ): bigint {
    const mem = getMemory();
    if (!mem) return BigInt(OUT_OF_BOUNDS);

    let paramNameBytes: Uint8Array;
    try {
      paramNameBytes = readBytes(mem, read_ptr, read_len);
    } catch {
      return BigInt(OUT_OF_BOUNDS);
    }

    const paramName = Buffer.from(paramNameBytes).toString('utf8');
    const paramValue = hookParams[paramName];

    recorder.record({ kind: 'host_call', fn: 'hook_param', key: paramName, value: paramValue });

    if (paramValue === undefined) return BigInt(DOESNT_EXIST);

    const valueBytes = Buffer.from(paramValue, 'hex');
    if (valueBytes.length > write_len) return BigInt(TOO_BIG);

    try {
      writeBytes(mem, write_ptr, valueBytes);
    } catch {
      return BigInt(OUT_OF_BOUNDS);
    }

    return BigInt(valueBytes.length);
  }

  /**
   * hook_param_set — MVP stub
   */
  function hook_param_set(): bigint {
    recorder.record({ kind: 'host_call', fn: 'hook_param_set' });
    return BigInt(DOESNT_EXIST);
  }

  return { hook_account, hook_param, hook_param_set };
}
