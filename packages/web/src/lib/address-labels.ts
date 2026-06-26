/**
 * Address labels — resolve a raw address to a human-readable name.
 *
 * Precedence: user-defined label  >  the contract's own label  >  built-in
 * well-known address  >  null (caller shows the truncated address).
 *
 * The per-user + per-contract labels are passed in as a flat map
 * `{ "0x…(lowercase)": "Label" }` (built in `(app)/layout.tsx` and provided via
 * AddressLabelProvider). This module itself is PURE so it can be unit-tested and
 * shared by both the resolver helper and the layout loader.
 */

// Well-known addresses that should always read nicely, for everyone.
export const BUILTIN_ADDRESS_LABELS: Record<string, string> = {
  '0x0000000000000000000000000000000000000000': 'Mint / Burn',
  '0x000000000000000000000000000000000000dead': 'Burn (0x…dead)',
};

const normAddr = (a: unknown): string =>
  typeof a === 'string' ? a.trim().toLowerCase() : '';

/**
 * Resolve a display label for `address`, or null if none is known.
 * `userLabels` is a lowercased-address → label map (user + contract labels merged).
 */
export function resolveAddressLabel(
  address: unknown,
  userLabels?: Record<string, string>,
): string | null {
  const a = normAddr(address);
  if (!a) return null;
  if (userLabels) {
    const v = userLabels[a];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  const builtin = BUILTIN_ADDRESS_LABELS[a];
  return builtin ?? null;
}

/** Merge contract names + user labels into one lowercased-address → label map. */
export function buildLabelMap(
  contracts: Array<{ address?: unknown; name?: unknown }>,
  userLabels: Array<{ address?: unknown; label?: unknown }>,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const c of contracts) {
    const a = normAddr(c.address);
    if (a && typeof c.name === 'string' && c.name.trim()) map[a] = c.name.trim();
  }
  // user labels win over contract names
  for (const l of userLabels) {
    const a = normAddr(l.address);
    if (a && typeof l.label === 'string' && l.label.trim()) map[a] = l.label.trim();
  }
  return map;
}
