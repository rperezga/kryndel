// A4.5 — security validations for URL parameters and forms.

/** Accepts EVM (0x + 40 hex) or XLS-0101 native rAddress (r + base58, 25-35 chars). */
export function validateAddress(address: string): boolean {
  if (typeof address !== 'string') return false;
  if (/^0x[0-9a-fA-F]{40}$/.test(address)) return true;            // EVM
  if (/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address)) return true; // XLS-0101 native rAddress
  return false;
}

/** Accepts EVM tx hash (0x + 64 hex) or XRPL native tx hash (64 uppercase hex). */
export function validateTxHash(hash: string): boolean {
  if (typeof hash !== 'string') return false;
  if (/^0x[0-9a-fA-F]{64}$/.test(hash)) return true;  // EVM
  if (/^[0-9A-F]{64}$/.test(hash))      return true;  // XRPL native
  return false;
}

/** Basic SSRF protection: blocks private IPs/hostnames. */
export function isPrivateHost(hostname: string): boolean {
  return /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname);
}
