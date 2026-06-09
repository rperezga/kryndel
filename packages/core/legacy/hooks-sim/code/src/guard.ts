import { GUARD_VIOLATION } from './errors.js';

/**
 * Thrown when a loop exceeds the declared maximum iterations.
 */
export class GuardViolationError extends Error {
  readonly code = GUARD_VIOLATION;
  constructor(message: string) {
    super(message);
    this.name = 'GuardViolationError';
  }
}

/**
 * Creates an execution-specific loop guard function _g(id, maxiter).
 * Keeping loop counts mapped inside a closure ensures that different simulation runs do not leak counts.
 */
export function createGuard() {
  const loopCounts = new Map<number, number>();

  return function _g(id: number, maxiter: number): number {
    const current = loopCounts.get(id) || 0;
    const next = current + 1;

    if (next > maxiter) {
      throw new GuardViolationError(
        `Guard violation: Loop ${id} exceeded promised maximum iterations of ${maxiter}`
      );
    }

    loopCounts.set(id, next);
    return 1; // Returns 1 to signal that execution can proceed
  };
}
