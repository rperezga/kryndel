/**
 * Web-safe subset of @kryndel/core for Next.js/webpack (transpilePackages).
 *
 * Only re-exports modules with zero or type-only external dependencies.
 * Does NOT include: watcher, tracer, recorder, indexer, pipeline,
 * subscriber, alerts — those require viem/xrpl/ws/mongodb as values.
 *
 * Used via the "webpack" export condition in core/package.json.
 */

// Pure TypeScript — no external deps
export type * from './types.js';

// Only has: import type { Abi } from 'viem' → erased by SWC at compile time
export {
  STANDARD_EVENT_REGISTRY,
  STANDARD_EVENT_NAMES,
  lookupByTopic0,
} from './event-registry.js';

