/**
 * Web-safe subset of @kryndel/core for Next.js/webpack (transpilePackages).
 *
 * Used via the "webpack" export condition in core/package.json.
 * API routes and RSC pages run server-side — viem is safe to include here
 * because webpack bundles it as a Node.js target for API/RSC routes.
 */

// Pure TypeScript — no external deps
export type * from './types.js';

// Only has: import type { Abi } from 'viem' → erased by SWC at compile time
export {
  STANDARD_EVENT_REGISTRY,
  STANDARD_EVENT_NAMES,
  lookupByTopic0,
} from './event-registry.js';

export { matchesRule, createSubscriber } from './subscriber.js';

// Tracer — used by API routes and RSC pages (server-side only)
// viem is bundled server-side by webpack without issues
export { traceEvmTx, traceNativeTx } from './tracer.js';

// Decoder — used by tracer internally, also exported for ABI decoding in pages
export { createEvmDecoder, ERC20_ABI } from './decoder.js';
