/**
 * SSRF guard — web mirror of @kryndel/core/src/ssrf.ts.
 *
 * Duplicated (not imported) because packages/web does not bundle
 * @kryndel/core in its Next.js dependency tree. Keep this file in lockstep
 * with packages/core/src/ssrf.ts — any divergence is a bug.
 *
 * Used by:
 *   • src/app/api/rules/route.ts        (create-time check)
 *   • src/app/contract/[address]/actions.ts (Server Action create-time)
 *
 * See AUDIT-PA-2026-06-16 §A2 for rationale.
 */
import { lookup } from 'node:dns/promises';

const PRIVATE_V4_REGEXES: RegExp[] = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./,
];

const PRIVATE_V6_REGEXES: RegExp[] = [
  /^::1$/,
  /^::$/,
  /^[fF][cCdD][0-9a-fA-F]{2}:/,
  /^[fF][eE][89aAbB][0-9a-fA-F]:/,
];

export function isPrivateIp(addr: string): boolean {
  const ip = addr.replace(/^\[|\]$/g, '');
  if (ip.includes(':')) return PRIVATE_V6_REGEXES.some((r) => r.test(ip));
  return PRIVATE_V4_REGEXES.some((r) => r.test(ip));
}

export function isPrivateHostname(host: string): boolean {
  const h = host.toLowerCase().trim();
  if (h === '' || h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h === '0.0.0.0' || h === '0') return true;
  if (h.startsWith('[') && h.endsWith(']')) return isPrivateIp(h);
  if (/^[0-9.]+$/.test(h) || h.includes(':'))  return isPrivateIp(h);
  return false;
}

export interface SafeUrlResult {
  ok:      boolean;
  reason?: string;
}

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

export async function assertSafePublicUrl(input: string): Promise<void> {
  const result = await isSafePublicUrl(input);
  if (!result.ok) throw new Error(result.reason ?? 'URL failed safety check.');
}

/** Recursively replaces `$` and `.` in object keys to neutralize MongoDB
 *  operator/path injection on attacker-supplied data (e.g. `filter` field). */
export function sanitizeKeys(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeKeys);
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
      k.replace(/\$/g, '＄').replace(/\./g, '_'),
      sanitizeKeys(v),
    ])
  );
}
