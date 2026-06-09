import { INVALID_FLOAT } from '../errors.js';
import type { Recorder } from '../recorder.js';

// ── XFL (XRPL Canonical Float) ────────────────────────────────────────────────
// Format (64-bit / i64):
//   bit 63       : sign (0 = positive, 1 = negative)
//   bits 62–54   : 9-bit exponent, biased by 97  (actual exp = stored − 97)
//   bits 53–0    : 54-bit decimal mantissa
//
// Canonical zero: any value whose mantissa bits are 0.
// Normalized range: 10^15 ≤ mantissa < 10^16, exponent in [−96, 80].

const SIGN_BIT       = 1n << 63n;
const MANTISSA_MASK  = (1n << 54n) - 1n;
const EXP_SHIFT      = 54n;
const EXP_BIAS       = 97;
const MANTISSA_MIN   = 1_000_000_000_000_000n;   // 10^15
const MANTISSA_MAX   = 9_999_999_999_999_999n;   // 10^16 − 1
export const XFL_CANONICAL_ZERO = 0x6000000000000000n;

// ── Internal helpers ──────────────────────────────────────────────────────────

export function xflIsZero(xfl: bigint): boolean {
  return (xfl & MANTISSA_MASK) === 0n;
}

/** Decode XFL to a JS number (lossy but sufficient for MVP comparisons). */
export function xflToNumber(xfl: bigint): number {
  if (xflIsZero(xfl)) return 0;
  const negative   = (xfl & SIGN_BIT) !== 0n;
  const expStored  = Number((xfl >> EXP_SHIFT) & 0x1FFn);
  const mantissa   = Number(xfl & MANTISSA_MASK);
  const value      = mantissa * Math.pow(10, expStored - EXP_BIAS);
  return negative ? -value : value;
}

/** Encode a JS number to XFL (returns XFL_CANONICAL_ZERO on overflow/NaN). */
export function numberToXfl(value: number): bigint {
  if (!isFinite(value) || value === 0) return XFL_CANONICAL_ZERO;

  const negative = value < 0;
  let m = Math.abs(value);
  let e = 0;

  // Normalise mantissa to [10^15, 10^16)
  while (m < 1e15 && m > 0) { m *= 10; e--; }
  while (m >= 1e16)          { m /= 10; e++; }

  m = Math.round(m);
  // After rounding m could hit 10^16
  if (m >= 1e16) { m /= 10; e++; }

  if (e < -96 || e > 80) return XFL_CANONICAL_ZERO;

  const sign        = negative ? SIGN_BIT : 0n;
  const expBits     = BigInt(e + EXP_BIAS) << EXP_SHIFT;
  const mantissaBits = BigInt(m);
  return sign | expBits | mantissaBits;
}

// ── Public host functions ─────────────────────────────────────────────────────

export function createFloatFunctions(recorder: Recorder) {
  /**
   * float_set(exponent: i32, mantissa: i64) → i64
   * Constructs an XFL from mantissa × 10^exponent.
   */
  function float_set(exponent: number, mantissa: bigint): bigint {
    if (mantissa === 0n) return XFL_CANONICAL_ZERO;
    return numberToXfl(Number(mantissa) * Math.pow(10, exponent));
  }

  /** float_one() → i64  Returns XFL(1). */
  function float_one(): bigint {
    return numberToXfl(1);
  }

  /** float_multiply(f1: i64, f2: i64) → i64 */
  function float_multiply(f1: bigint, f2: bigint): bigint {
    if (xflIsZero(f1) || xflIsZero(f2)) return XFL_CANONICAL_ZERO;
    return numberToXfl(xflToNumber(f1) * xflToNumber(f2));
  }

  /** float_divide(f1: i64, f2: i64) → i64 */
  function float_divide(f1: bigint, f2: bigint): bigint {
    if (xflIsZero(f2)) return BigInt(INVALID_FLOAT);
    if (xflIsZero(f1)) return XFL_CANONICAL_ZERO;
    return numberToXfl(xflToNumber(f1) / xflToNumber(f2));
  }

  /** float_sum(f1: i64, f2: i64) → i64 */
  function float_sum(f1: bigint, f2: bigint): bigint {
    return numberToXfl(xflToNumber(f1) + xflToNumber(f2));
  }

  /** float_negate(f: i64) → i64  Flip the sign bit. */
  function float_negate(f: bigint): bigint {
    if (xflIsZero(f)) return XFL_CANONICAL_ZERO;
    return f ^ SIGN_BIT;
  }

  /**
   * float_compare(f1: i64, f2: i64, mode: i32) → i64
   * mode flags: 0x01=LT, 0x02=GT, 0x04=EQ  (combinable)
   * Returns 1n if comparison is true, 0n if false, negative on error.
   */
  function float_compare(f1: bigint, f2: bigint, mode: number): bigint {
    const a = xflToNumber(f1);
    const b = xflToNumber(f2);
    let result = false;
    if (mode & 0x01) result = result || a < b;
    if (mode & 0x02) result = result || a > b;
    if (mode & 0x04) result = result || a === b;
    return result ? 1n : 0n;
  }

  /**
   * float_int(f: i64, decimals: i32, absolute: i32) → i64
   * Returns the integer part of f × 10^decimals (optionally absolute value).
   */
  function float_int(f: bigint, decimals: number, absolute: number): bigint {
    if (xflIsZero(f)) return 0n;
    let value = xflToNumber(f);
    if (absolute) value = Math.abs(value);
    const scaled = Math.trunc(value * Math.pow(10, decimals));
    return BigInt(scaled);
  }

  /**
   * float_sign(f: i64) → i64
   * Returns 0n if positive/zero, 1n if negative.
   */
  function float_sign(f: bigint): bigint {
    if (xflIsZero(f)) return 0n;
    return (f & SIGN_BIT) !== 0n ? 1n : 0n;
  }

  /**
   * float_mantissa(f: i64) → i64  Returns the mantissa as a signed i64.
   */
  function float_mantissa(f: bigint): bigint {
    if (xflIsZero(f)) return 0n;
    const m = f & MANTISSA_MASK;
    return (f & SIGN_BIT) !== 0n ? -m : m;
  }

  /**
   * float_exponent(f: i64) → i64  Returns the actual exponent (debiased).
   */
  function float_exponent(f: bigint): bigint {
    if (xflIsZero(f)) return 0n;
    const stored = Number((f >> EXP_SHIFT) & 0x1FFn);
    return BigInt(stored - EXP_BIAS);
  }

  return {
    float_set,
    float_one,
    float_multiply,
    float_divide,
    float_sum,
    float_negate,
    float_compare,
    float_int,
    float_sign,
    float_mantissa,
    float_exponent,
  };
}
