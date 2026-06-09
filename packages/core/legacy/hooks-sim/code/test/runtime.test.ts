import { describe, it, expect } from 'vitest';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { loadHook } from '../src/runtime.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const EXAMPLES = resolve(__dirname, '../../../examples');

// Minimal stub imports — hook() will call accept which isn't wired up,
// but instantiation itself should succeed.
const stubImports: WebAssembly.Imports = {
  env: {
    accept: () => 0n,
    rollback: () => 0n,
    state: () => -5n,
  },
};

describe('loadHook', () => {
  it('loads accept-all.wasm without error', async () => {
    const result = await loadHook(`${EXAMPLES}/accept-all.wasm`, stubImports);
    expect(typeof result.hook).toBe('function');
  });

  it('loads firewall.wasm without error', async () => {
    const result = await loadHook(`${EXAMPLES}/firewall.wasm`, stubImports);
    expect(typeof result.hook).toBe('function');
  });

  it('exposes memory export from firewall.wasm', async () => {
    const result = await loadHook(`${EXAMPLES}/firewall.wasm`, stubImports);
    expect(result.memory).toBeInstanceOf(WebAssembly.Memory);
  });

  it('throws a clear error for a non-existent file', async () => {
    await expect(loadHook('/tmp/ghost.wasm', {})).rejects.toThrow('Failed to read WASM file');
  });

  it('throws a clear error if hook export is missing', async () => {
    const { writeFile } = await import('fs/promises');
    const { tmpdir } = await import('os');
    const { join } = await import('path');
    const tmpPath = join(tmpdir(), 'no-hook-export.wasm');
    // Minimal valid WASM module with no exports
    await writeFile(tmpPath, Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]));
    await expect(loadHook(tmpPath, {})).rejects.toThrow('does not export a "hook" function');
  });
});
