// A4.5 — validaciones de seguridad para parámetros de URL y formularios.

/** Acepta EVM (0x + 40 hex) o rAddress de Xahau (r + base58, 25-35 chars). */
export function validateAddress(address: string): boolean {
  if (typeof address !== 'string') return false;
  if (/^0x[0-9a-fA-F]{40}$/.test(address)) return true;            // EVM
  if (/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address)) return true; // Xahau rAddress
  return false;
}

/** Acepta hash EVM (0x + 64 hex) o hash XRPL nativo (64 hex mayúsculas). */
export function validateTxHash(hash: string): boolean {
  if (typeof hash !== 'string') return false;
  if (/^0x[0-9a-fA-F]{64}$/.test(hash)) return true;  // EVM
  if (/^[0-9A-F]{64}$/.test(hash))      return true;  // XRPL nativo
  return false;
}

/** Protección SSRF básica: bloquea IPs/hostnames privados. */
export function isPrivateHost(hostname: string): boolean {
  return /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname);
}
