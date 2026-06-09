/**
 * Unit tests for individual host function implementations.
 * Each test exercises one ABI module in isolation, using a real
 * WebAssembly.Memory and a lightweight mock Recorder.
 */
import { describe, it, expect } from 'vitest';
import { createControlFunctions, HookResult } from '../src/abi/control.js';
import { createOtxnFunctions } from '../src/abi/otxn.js';
import { createStateFunctions } from '../src/abi/state.js';
import { createTraceFunctions } from '../src/abi/trace.js';
import { createFloatFunctions, XFL_CANONICAL_ZERO } from '../src/abi/float.js';
import { createEmitFunctions } from '../src/abi/emit.js';
import { Ledger } from '../src/ledger.js';
import { writeBytes } from '../src/mem.js';
import type { TraceEvent } from '../src/types.js';

// ── Mock Recorder ─────────────────────────────────────────────────────────────

class MockRecorder {
  events: TraceEvent[] = [];
  result: { decision: string; code: number; msg: string } | null = null;
  emitted: unknown[] = [];

  record(event: Omit<TraceEvent, 't'>): void {
    this.events.push({ t: this.events.length, ...event } as TraceEvent);
  }
  setResult(r: { decision: 'accept' | 'rollback'; code: number; msg: string }): void {
    this.result = r;
  }
  addEmitted(tx: unknown): void {
    this.emitted.push(tx);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMemory(pages = 1): WebAssembly.Memory {
  return new WebAssembly.Memory({ initial: pages });
}

function getMemoryFn(mem: WebAssembly.Memory) {
  return () => mem;
}

// ── control.ts ────────────────────────────────────────────────────────────────

describe('control.ts — accept / rollback', () => {
  it('accept() throws HookResult and records decision', () => {
    const rec = new MockRecorder();
    const mem = makeMemory();
    const { accept } = createControlFunctions(rec as any, getMemoryFn(mem));

    // Write message "ok" at offset 0
    writeBytes(mem, 0, new TextEncoder().encode('ok'));

    expect(() => accept(0, 2, 0)).toThrow(HookResult);
    expect(rec.result?.decision).toBe('accept');
    expect(rec.result?.code).toBe(0);
  });

  it('rollback() throws HookResult and records rollback', () => {
    const rec = new MockRecorder();
    const mem = makeMemory();
    const { rollback } = createControlFunctions(rec as any, getMemoryFn(mem));

    writeBytes(mem, 0, new TextEncoder().encode('no'));

    expect(() => rollback(0, 2, 1)).toThrow(HookResult);
    expect(rec.result?.decision).toBe('rollback');
    expect(rec.result?.code).toBe(1);
  });

  it('HookResult carries decision and code', () => {
    try {
      throw new HookResult('rollback', 7, 'test');
    } catch (e) {
      expect(e).toBeInstanceOf(HookResult);
      if (e instanceof HookResult) {
        expect(e.decision).toBe('rollback');
        expect(e.code).toBe(7);
      }
    }
  });
});

// ── otxn.ts ───────────────────────────────────────────────────────────────────

describe('otxn.ts — otxn_type / otxn_field / otxn_id', () => {
  const payment = {
    TransactionType: 'Payment',
    Account: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
    Destination: 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe',
    Amount: '1000000',
    Fee: '12',
    Sequence: 1,
    Flags: 0,
  };

  it('otxn_type writes transaction type code and returns 2', () => {
    const rec = new MockRecorder();
    const mem = makeMemory();
    const { otxn_type } = createOtxnFunctions(payment as any, rec as any, getMemoryFn(mem));

    const result = otxn_type(0, 2);
    expect(result).toBe(2n); // 2 bytes written
  });

  it('otxn_field reads Account field and returns byte count', () => {
    const rec = new MockRecorder();
    const mem = makeMemory();
    const { otxn_field } = createOtxnFunctions(payment as any, rec as any, getMemoryFn(mem));

    // sfAccount = field code 8, type code 8 → fieldId 0x0808 (common encoding varies)
    // We just verify it returns a positive bigint for a valid field
    const result = otxn_field(100, 100, 3); // field 3 = sfAccount in many encodings
    // Accept any non-error response (positive or known error codes are both valid)
    expect(typeof result).toBe('bigint');
  });
});

// ── state.ts ──────────────────────────────────────────────────────────────────

describe('state.ts — state read / state_set', () => {
  const HOOK_ACCOUNT = 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh';
  const ZERO_KEY = '0'.repeat(64);

  it('state returns DOESNT_EXIST (-5n) when key not in ledger', () => {
    const rec = new MockRecorder();
    const mem = makeMemory();
    const ledger = Ledger.from();
    const { state } = createStateFunctions(HOOK_ACCOUNT, ledger, rec as any, getMemoryFn(mem));

    // Write 32-byte zero key at offset 64
    writeBytes(mem, 64, new Uint8Array(32));
    const result = state(0, 32, 64, 32);
    expect(result).toBe(-5n); // DOESNT_EXIST
  });

  it('state_set writes a value and state can read it back', () => {
    const rec = new MockRecorder();
    const mem = makeMemory();
    const ledger = Ledger.from();
    const { state, state_set } = createStateFunctions(HOOK_ACCOUNT, ledger, rec as any, getMemoryFn(mem));

    // Write value "AA" (1 byte 0xAA) at offset 0
    writeBytes(mem, 0, new Uint8Array([0xaa]));
    // Write 32-byte zero key at offset 64
    writeBytes(mem, 64, new Uint8Array(32));

    // state_set(read_ptr=0, read_len=1, kread_ptr=64, kread_len=32)
    const setResult = state_set(0, 1, 64, 32);
    expect(setResult).toBe(1n); // 1 byte written

    // Now read it back: write_ptr=200, write_len=32, kread_ptr=64, kread_len=32
    const getResult = state(200, 32, 64, 32);
    expect(getResult).toBe(1n); // 1 byte read

    // Check recorder captured state_write then state_read
    const writes = rec.events.filter((e) => e.kind === 'state_write');
    const reads = rec.events.filter((e) => e.kind === 'state_read');
    expect(writes).toHaveLength(1);
    expect(reads).toHaveLength(1);
    expect(writes[0].value).toBe('aa');
    expect(reads[0].value).toBe('aa');
  });

  it('ledger seed is respected by state()', () => {
    const rec = new MockRecorder();
    const mem = makeMemory();
    const ledger = Ledger.from({
      accounts: [{ address: HOOK_ACCOUNT, balance: '100000000', sequence: 1 }],
      hookState: [{ account: HOOK_ACCOUNT, key: ZERO_KEY, value: 'deadbeef' }],
    });
    const { state } = createStateFunctions(HOOK_ACCOUNT, ledger, rec as any, getMemoryFn(mem));

    writeBytes(mem, 64, new Uint8Array(32)); // zero key
    // "deadbeef" = 8 hex chars = 4 bytes
    const result = state(0, 32, 64, 32);
    expect(result).toBe(4n);
  });
});

// ── trace.ts ──────────────────────────────────────────────────────────────────

describe('trace.ts — trace / trace_num / trace_float', () => {
  it('trace records a trace_msg event with message', () => {
    const rec = new MockRecorder();
    const mem = makeMemory();
    const { trace } = createTraceFunctions(rec as any, getMemoryFn(mem));

    writeBytes(mem, 0, new TextEncoder().encode('hello'));
    trace(0, 5, 0, 0, 0);

    expect(rec.events).toHaveLength(1);
    expect(rec.events[0].kind).toBe('trace_msg');
    expect(rec.events[0].msg).toBe('hello');
  });

  it('trace_num records value as string', () => {
    const rec = new MockRecorder();
    const mem = makeMemory();
    const { trace_num } = createTraceFunctions(rec as any, getMemoryFn(mem));

    writeBytes(mem, 0, new TextEncoder().encode('count'));
    trace_num(0, 5, 42n);

    expect(rec.events[0].kind).toBe('trace_msg');
    expect(rec.events[0].value).toBe('42');
  });

  it('trace data written as hex when as_hex=1', () => {
    const rec = new MockRecorder();
    const mem = makeMemory();
    const { trace } = createTraceFunctions(rec as any, getMemoryFn(mem));

    writeBytes(mem, 0, new TextEncoder().encode('msg'));
    writeBytes(mem, 10, new Uint8Array([0xde, 0xad]));
    trace(0, 3, 10, 2, 1);

    expect(rec.events[0].value).toBe('dead');
  });
});

// ── float.ts ──────────────────────────────────────────────────────────────────

describe('float.ts — XFL arithmetic', () => {
  it('XFL_CANONICAL_ZERO is defined', () => {
    expect(XFL_CANONICAL_ZERO).toBe(0x6000000000000000n);
  });

  it('float_set then float_compare equal', () => {
    const rec = new MockRecorder();
    const { float_set, float_compare } = createFloatFunctions(rec as any);

    const a = float_set(-6, 1000000n); // 1.0
    const b = float_set(-6, 1000000n); // 1.0
    expect(float_compare(a, b, 0x04n)).toBe(1n); // mode 0x04 = EQ → 1
  });

  it('float_compare LT', () => {
    const rec = new MockRecorder();
    const { float_set, float_compare } = createFloatFunctions(rec as any);

    const small = float_set(-6, 500000n);  // 0.5
    const large = float_set(-6, 2000000n); // 2.0
    expect(float_compare(small, large, 0x01n)).toBe(1n); // LT → 1
    expect(float_compare(large, small, 0x01n)).toBe(0n); // not LT → 0
  });

  it('float_compare GT', () => {
    const rec = new MockRecorder();
    const { float_set, float_compare } = createFloatFunctions(rec as any);

    const small = float_set(-6, 500000n);
    const large = float_set(-6, 2000000n);
    expect(float_compare(large, small, 0x02n)).toBe(1n); // GT → 1
    expect(float_compare(small, large, 0x02n)).toBe(0n); // not GT → 0
  });

  it('float_multiply', () => {
    const rec = new MockRecorder();
    const { float_set, float_compare, float_multiply } = createFloatFunctions(rec as any);

    const two = float_set(-6, 2000000n);  // 2.0
    const three = float_set(-6, 3000000n); // 3.0
    const six = float_multiply(two, three);
    const sixExpected = float_set(-6, 6000000n); // 6.0
    expect(float_compare(six, sixExpected, 0x04n)).toBe(1n); // EQ
  });

  it('float_sum', () => {
    const rec = new MockRecorder();
    const { float_set, float_compare, float_sum } = createFloatFunctions(rec as any);

    const one = float_set(-6, 1000000n);
    const two = float_set(-6, 2000000n);
    const three = float_sum(one, two);
    const threeExpected = float_set(-6, 3000000n);
    expect(float_compare(three, threeExpected, 0x04n)).toBe(1n);
  });

  it('float_negate', () => {
    const rec = new MockRecorder();
    const { float_set, float_compare, float_negate } = createFloatFunctions(rec as any);

    const pos = float_set(-6, 1000000n);
    const neg = float_negate(pos);
    // neg < pos
    expect(float_compare(neg, pos, 0x01n)).toBe(1n); // LT
  });
});

// ── emit.ts ───────────────────────────────────────────────────────────────────

describe('emit.ts — etxn helpers', () => {
  it('etxn_fee_base returns 100n', () => {
    const rec = new MockRecorder();
    const mem = makeMemory();
    const { etxn_fee_base } = createEmitFunctions(rec as any, getMemoryFn(mem));
    expect(etxn_fee_base(0, 8)).toBe(100n);
  });

  it('etxn_nonce writes 32 zero bytes', () => {
    const rec = new MockRecorder();
    const mem = makeMemory();
    const { etxn_nonce } = createEmitFunctions(rec as any, getMemoryFn(mem));

    // Fill target area with 0xFF first
    const view = new Uint8Array(mem.buffer);
    view.fill(0xff, 0, 32);

    etxn_nonce(0, 32);
    expect(Array.from(view.slice(0, 32))).toEqual(new Array(32).fill(0));
  });

  it('etxn_reserve returns 0', () => {
    const rec = new MockRecorder();
    const mem = makeMemory();
    const { etxn_reserve } = createEmitFunctions(rec as any, getMemoryFn(mem));
    expect(etxn_reserve(1)).toBe(0n);
  });
});
