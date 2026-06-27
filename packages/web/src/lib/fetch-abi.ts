/**
 * fetch-abi — pull a verified contract ABI from the XRPL EVM block explorer
 * (Blockscout) so events decode by name without the user uploading anything.
 *
 * Uses the Blockscout-compatible legacy endpoint, which returns the ABI as a
 * JSON string in `result` when the contract is verified:
 *   GET /api?module=contract&action=getabi&address=0x…
 *   → { status: "1", result: "[…abi…]" }   (verified)
 *   → { status: "0", result: "" }           (not verified)
 *
 * Server-side only (called from Server Actions). Returns the parsed ABI array
 * or null — never throws.
 */
const EXPLORER_API =
  process.env.EXPLORER_API_URL ?? 'https://explorer.xrplevm.org/api';

const isEvmAddress = (a: string): boolean => /^0x[0-9a-fA-F]{40}$/.test(a);

export async function fetchVerifiedAbi(address: string): Promise<unknown[] | null> {
  const addr = (address ?? '').trim();
  if (!isEvmAddress(addr)) return null;

  try {
    const url = `${EXPLORER_API}?module=contract&action=getabi&address=${addr}`;
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { status?: string; result?: string };
    if (data.status !== '1' || !data.result) return null;

    const abi = JSON.parse(data.result);
    if (!Array.isArray(abi) || abi.length === 0) return null;
    return abi;
  } catch {
    return null;
  }
}

/** Count how many ABI entries are events (for user-facing feedback). */
export function countEvents(abi: unknown[]): number {
  return abi.filter(
    (e) => e && typeof e === 'object' && (e as { type?: unknown }).type === 'event',
  ).length;
}
