import { describe, it, expect } from 'vitest';
import { createGuard, GuardViolationError } from '../src/guard.js';

describe('guard.ts', () => {
  it('should allow loop iterations within the maximum limit', () => {
    const _g = createGuard();
    // Loop ID 101, maxiter 3
    expect(_g(101, 3)).toBe(1);
    expect(_g(101, 3)).toBe(1);
    expect(_g(101, 3)).toBe(1);
  });

  it('should throw GuardViolationError if iterations exceed limit', () => {
    const _g = createGuard();
    _g(202, 2);
    _g(202, 2);
    expect(() => _g(202, 2)).toThrow(GuardViolationError);
  });

  it('should track loop counts independently for different loop IDs', () => {
    const _g = createGuard();
    _g(1, 2);
    _g(2, 2);
    _g(1, 2);

    // Loop 1 at limit
    expect(() => _g(1, 2)).toThrow(GuardViolationError);
    // Loop 2 is still at 1 iteration, so 1 more is allowed
    expect(_g(2, 2)).toBe(1);
    // Loop 2 is now at limit, next will throw
    expect(() => _g(2, 2)).toThrow(GuardViolationError);
  });

  it('should not leak counts across different guard instances', () => {
    const _g1 = createGuard();
    const _g2 = createGuard();

    _g1(400, 1);
    expect(() => _g1(400, 1)).toThrow(GuardViolationError);

    // _g2 has its own loopCounts Map, so it should allow iteration
    expect(_g2(400, 1)).toBe(1);
    expect(() => _g2(400, 1)).toThrow(GuardViolationError);
  });
});
