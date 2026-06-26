/**
 * Display fallback for event names.
 *
 * The worker now persists DECODED names ("Transfer", "Approval", …). This is a
 * safety net for any legacy / undecoded row whose `name` is still a raw 32-byte
 * topic0 hash: it resolves the standard EIP topics to their human name, or
 * renders a short `Unknown (0x…)` instead of a 66-character hash in the UI.
 *
 * Source of truth for topic0 → name is core's `event-registry.ts`. This is kept
 * as a small local copy on purpose, so the client bundle does not have to pull
 * in `@kryndel/core` (and transitively viem).
 */

// Standard EIP event topic0 → human name. Mirrors core/src/event-registry.ts.
const TOPIC0_NAMES: Record<string, string> = {
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef': 'Transfer',
  '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925': 'Approval',
  '0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31': 'ApprovalForAll',
  '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62': 'TransferSingle',
  '0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb': 'TransferBatch',
  '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822': 'Swap',
  '0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1': 'Sync',
  '0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f': 'Mint',
  '0xdccd412f0b1252819cb1fd330b93224ca42612892bb3f4f789976e6d81936496': 'Burn',
  '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c': 'Deposit',
  '0x7fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b65': 'Withdrawal',
};

const TOPIC0_RE = /^0x[0-9a-fA-F]{64}$/;

/**
 * Resolve an event `name` for display. If `name` is a raw topic0 hash, map it to
 * the standard event name when known, otherwise to a short `Unknown (0x…)`.
 * Already-decoded names (e.g. "Transfer") pass through unchanged.
 */
export function resolveEventName(name: unknown): string {
  const raw = typeof name === 'string' ? name.trim() : '';
  if (!raw) return 'Event';
  if (TOPIC0_RE.test(raw)) {
    return TOPIC0_NAMES[raw.toLowerCase()] ?? `Unknown (${raw.slice(0, 10)}…)`;
  }
  return raw;
}
