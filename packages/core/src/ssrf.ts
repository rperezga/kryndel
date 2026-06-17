/**
 * SSRF guard — shared helper for outbound URL validation.
 *
 * Used by:
 *   • packages/web/src/app/api/rules/route.ts        (create-time check)
 *   • packages/web/src/app/contract/[address]/actions.ts (Server Action create-time)
 *   • packages/worker/src/dispatcher.ts              (dispatch-time defence-in-depth)
 *
 * Why both create-time AND dispatch-time? Rules may have been created with a
 * looser guard in the past, or by a client bypassing the API. The worker is
 * the actor that actually issues the outbound `fetch`, so it gets the final say.
 *
 * Blocked targets:
 *   - non-https schemes
 *   - loopback (127.0.0.0/8, ::1, 0.0.0.0)
 *   - RFC1918 private (10/8, 172.16/12, 192.168/16)
 *   - link-local (169.254.0.0/16 incl. AWS/GCP/Azure metadata 169.254.169.254)
 *   - IPv6 unique-local (fc00::/7), link-local (fe80::/10), unspecified (::)
 *   - DNS names that resolve to any of the above (DNS rebinding defence)
 *   - 'localhost' hostname (string match before DNS)
 */
import { lookup } from 'node:dns/promises';

// ── IP literal classification ─────────────────────────────────────────────────

const PRIVATE_V4_REGEXES: RegExp[] = [
  /^0\./,                            // 0.0.0.0/8  (this-network)
  /^10\./,                           // 10.0.0.0/8
  /^127\./,                          // 127.0.0.0/8 loopback
  /^169\.254\./,                     // 169.254.0.0/16 link-local (incl. cloud metadata)
  /^172\.(1[6-9]|2[0-9]|3[01])\./,   // 172.16.0.0/12
  /^192\.168\./,                     // 192.168.0.0/16
  /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./, // 100.64.0.0/10 CGNAT
];

const PRIVATE_V6_REGEXES: RegExp[] = [
  /^::1$/,                          // loopback
  /^::$/,                           // unspecified
  /^[fF][cCdD][0-9a-fA-F]{2}:/,     // fc00::/7 unique local
  /^[fF][eE][89aAbB][0-9a-fA-F]:/,  // fe80::/10 link-local
];

export function isPrivateIp(addr: string): boolean {
  const ip = addr.replace(/^\[|\]$/g, '');
  if (ip.includes(':')) {
    return PRIVATE_V6_REGEXES.some((r) => r.test(ip));
  }
  return PRIVATE_V4_REGEXES.some((r) => r.test(ip));
}

/**
 * Sync string check for obvious cases — blocks 'localhost', '0.0.0.0', and
 * any IP literal that resolves to a private range. Does NOT do DNS resolution.
 */
export function isPrivateHostname(host: string): boolean {
  const h = host.toLowerCase().trim();
  if (h === '' || h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h === '0.0.0.0' || h === '0') return true;
  if (h.startsWith('[') && h.endsWith(']')) return isPrivateIp(h);
  if (/^[0-9.]+$/.test(h) || h.includes(':'))  return isPrivateIp(h);
  return false;
}

// ── Public URL safety check (async — does DNS lookup) ────────────────────────

export interface SafeUrlResult {
  ok:      boolean;
  reason?: string;
}

/**
 * Returns { ok: true } if `input` is a safe public https:// URL.
 * Returns { ok: false, reason } otherwise. Fail-closed on DNS errors.
 */
export async function isSafePublicUrl(input: string): Promise<SafeUrlResult> {
  let url: URL;
  try { url = new URL(input); }
  catch { return { ok: false, reason: 'Invalid URL.' }; }

  if (url.protocol !== 'https:') {
    return { ok: false, reason: 'URL must use https://.' };
  }

  const host = url.hostname.replace(/^\[|\]$/g, '');

  if (isPrivateHostname(host)) {
    return { ok: false, reason: `URL targets a private/loopback host: ${host}` };
  }

  try {
    const records = await lookup(host, { all: true });
    for (const r of records) {
      if (isPrivateIp(r.address)) {
        return {
          ok:     false,
          reason: `URL host ${host} resolves to private IP ${r.address}`,
        };
      }
    }
  } catch (e) {
    return {
      ok:     false,
      reason: `DNS lookup failed for ${host}: ${(e as Error).message}`,
    };
  }

  return { ok: true };
}

/** Throws if URL is not safe. */
export async function assertSafePublicUrl(input: string): Promise<void> {
  const result = await isSafePublicUrl(input);
  if (!result.ok) {
    throw new Error(result.reason ?? 'URL failed safety check.');
  }
}
