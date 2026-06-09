import { OUT_OF_BOUNDS } from './errors.js';

/**
 * Base class for all runtime memory access errors.
 */
export class MemoryError extends Error {
  constructor(public readonly code: number, message: string) {
    super(message);
    this.name = 'MemoryError';
  }
}

/**
 * Thrown when a memory read or write operation falls outside of the allocated WebAssembly memory space.
 */
export class OutOfBoundsError extends MemoryError {
  constructor(message = 'Memory access out of bounds') {
    super(OUT_OF_BOUNDS, message);
    this.name = 'OutOfBoundsError';
  }
}

/**
 * Validates that the range [ptr, ptr + len) is within the WebAssembly memory limits.
 * Throws OutOfBoundsError if validation fails.
 */
function validateRange(memory: WebAssembly.Memory, ptr: number, len: number): void {
  if (
    ptr < 0 ||
    len < 0 ||
    !Number.isSafeInteger(ptr) ||
    !Number.isSafeInteger(len) ||
    ptr + len > memory.buffer.byteLength
  ) {
    throw new OutOfBoundsError(
      `Access at [ptr: ${ptr}, len: ${len}] is out of WebAssembly memory bounds [size: ${memory.buffer.byteLength}]`
    );
  }
}

/**
 * Reads a slice of bytes from WebAssembly memory.
 * Note: Never cache memory.buffer because it can be detached when the WebAssembly memory grows.
 */
export function readBytes(memory: WebAssembly.Memory, ptr: number, len: number): Uint8Array {
  validateRange(memory, ptr, len);
  return new Uint8Array(memory.buffer, ptr, len);
}

/**
 * Writes a slice of bytes into WebAssembly memory.
 * Note: Never cache memory.buffer because it can be detached when the WebAssembly memory grows.
 */
export function writeBytes(memory: WebAssembly.Memory, ptr: number, data: Uint8Array): void {
  validateRange(memory, ptr, data.length);
  const view = new Uint8Array(memory.buffer, ptr, data.length);
  view.set(data);
}

/**
 * Reads a UTF-8 encoded string from WebAssembly memory.
 * If len is specified, reads exactly len bytes.
 * If len is not specified, reads up to a null-terminator (C-string).
 * Note: Never cache memory.buffer because it can be detached when the WebAssembly memory grows.
 */
export function readString(memory: WebAssembly.Memory, ptr: number, len?: number): string {
  if (len !== undefined) {
    const bytes = readBytes(memory, ptr, len);
    return new TextDecoder().decode(bytes);
  }

  // Null-terminated string reading
  if (ptr < 0 || ptr > memory.buffer.byteLength) {
    throw new OutOfBoundsError(
      `String read pointer ${ptr} is out of WebAssembly memory bounds [size: ${memory.buffer.byteLength}]`
    );
  }

  const tempView = new Uint8Array(memory.buffer);
  let length = 0;
  while (ptr + length < tempView.length && tempView[ptr + length] !== 0) {
    length++;
  }

  // Check if we hit the end of memory without finding a null terminator
  if (ptr + length >= tempView.length) {
    throw new OutOfBoundsError('Null-terminated string search reached out of bounds');
  }

  const bytes = new Uint8Array(memory.buffer, ptr, length);
  return new TextDecoder().decode(bytes);
}

/**
 * Writes a UTF-8 string to WebAssembly memory.
 * If nullTerminated is true, appends a null byte.
 * Returns the total number of bytes written.
 * Note: Never cache memory.buffer because it can be detached when the WebAssembly memory grows.
 */
export function writeString(
  memory: WebAssembly.Memory,
  ptr: number,
  str: string,
  nullTerminated = false
): number {
  const bytes = new TextEncoder().encode(str);
  const totalLength = bytes.length + (nullTerminated ? 1 : 0);

  validateRange(memory, ptr, totalLength);

  const view = new Uint8Array(memory.buffer, ptr, totalLength);
  view.set(bytes);
  if (nullTerminated) {
    view[bytes.length] = 0;
  }
  return totalLength;
}
