import { readFile } from 'fs/promises';

/**
 * Result of loading and instantiating a Hook .wasm module.
 */
export interface HookInstance {
  /** The raw WebAssembly instance */
  instance: WebAssembly.Instance;
  /** The exported hook(reserved: i64) → i64 function */
  hook: (reserved: bigint) => bigint;
  /** The exported cbak(reserved: i64) → i64 function, if present */
  cbak: ((reserved: bigint) => bigint) | null;
  /** The exported WebAssembly memory, if present */
  memory: WebAssembly.Memory | null;
}

/**
 * Loads a Hook .wasm file from disk, compiles and instantiates it with
 * the provided import object.
 *
 * @param wasmPath - Absolute or relative path to the .wasm file
 * @param imports  - Import object passed to WebAssembly.instantiate.
 *                   Hook host functions must live under the "env" namespace.
 * @throws if the file is not a valid WASM module or does not export "hook"
 */
export async function loadHook(
  wasmPath: string,
  imports: WebAssembly.Imports
): Promise<HookInstance> {
  // Read the file from disk
  let buffer: Buffer;
  try {
    buffer = await readFile(wasmPath);
  } catch (err) {
    throw new Error(`Failed to read WASM file "${wasmPath}": ${(err as Error).message}`);
  }

  // Compile + instantiate using Node's native WebAssembly API
  let instance: WebAssembly.Instance;
  try {
    const result = await WebAssembly.instantiate(new Uint8Array(buffer), imports);
    instance = result.instance;
  } catch (err) {
    throw new Error(
      `Failed to instantiate WASM module "${wasmPath}": ${(err as Error).message}`
    );
  }

  const exports = instance.exports;

  // Validate required export: hook()
  if (typeof exports['hook'] !== 'function') {
    throw new Error(
      `WASM module "${wasmPath}" does not export a "hook" function. ` +
        `Found exports: [${Object.keys(exports).join(', ')}]`
    );
  }

  const hook = exports['hook'] as (reserved: bigint) => bigint;

  // Optional export: cbak() — called after emitted transactions are processed
  const cbak =
    typeof exports['cbak'] === 'function'
      ? (exports['cbak'] as (reserved: bigint) => bigint)
      : null;

  // Optional export: memory — needed for reading/writing hook data buffers
  const memory =
    exports['memory'] instanceof WebAssembly.Memory
      ? (exports['memory'] as WebAssembly.Memory)
      : null;

  return { instance, hook, cbak, memory };
}
