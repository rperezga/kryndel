import { describe, it, expect } from 'vitest';
import { readBytes, writeBytes, readString, writeString, OutOfBoundsError } from '../src/mem.js';

describe('mem.ts', () => {
  it('should read and write bytes correctly', () => {
    const memory = new WebAssembly.Memory({ initial: 1 });
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    writeBytes(memory, 10, data);

    const read = readBytes(memory, 10, 5);
    expect(read).toEqual(data);
  });

  it('should throw OutOfBoundsError if reading outside limits', () => {
    const memory = new WebAssembly.Memory({ initial: 1 }); // 64KB = 65536 bytes

    expect(() => readBytes(memory, 65530, 10)).toThrow(OutOfBoundsError);
    expect(() => readBytes(memory, -5, 10)).toThrow(OutOfBoundsError);
    expect(() => readBytes(memory, 10, -5)).toThrow(OutOfBoundsError);
    expect(() => readBytes(memory, 65537, 0)).toThrow(OutOfBoundsError);
  });

  it('should throw OutOfBoundsError if writing outside limits', () => {
    const memory = new WebAssembly.Memory({ initial: 1 });
    const data = new Uint8Array(10);

    expect(() => writeBytes(memory, 65530, data)).toThrow(OutOfBoundsError);
    expect(() => writeBytes(memory, -1, data)).toThrow(OutOfBoundsError);
  });

  it('should write and read strings correctly (explicit length)', () => {
    const memory = new WebAssembly.Memory({ initial: 1 });
    const str = 'Hello XRPL Hooks!';
    const bytesWritten = writeString(memory, 100, str);
    expect(bytesWritten).toBe(str.length);

    const read = readString(memory, 100, str.length);
    expect(read).toBe(str);
  });

  it('should write and read null-terminated strings correctly', () => {
    const memory = new WebAssembly.Memory({ initial: 1 });
    const str = 'Hello World';
    const bytesWritten = writeString(memory, 100, str, true);
    expect(bytesWritten).toBe(str.length + 1);

    // Explicit length string read
    expect(readString(memory, 100, str.length)).toBe(str);

    // Null-terminated string read (no length passed)
    expect(readString(memory, 100)).toBe(str);
  });

  it('should throw OutOfBoundsError if null-terminated string search reaches end of memory without null terminator', () => {
    const memory = new WebAssembly.Memory({ initial: 1 });
    const bufferSize = memory.buffer.byteLength;

    // Fill the end of memory with non-zero bytes
    const view = new Uint8Array(memory.buffer);
    for (let i = bufferSize - 10; i < bufferSize; i++) {
      view[i] = 65; // 'A'
    }

    // Scanning from bufferSize - 5 should throw because no null terminator exists up to the end
    expect(() => readString(memory, bufferSize - 5)).toThrow(OutOfBoundsError);
  });
});
