export const DEFAULT_EVM_RPC_URL = 'https://rpc.xrplevm.org';

export interface EvmRpcEnvironment {
  EVM_RPC_URLS?: string;
  EVM_RPC_URL?: string;
}

/** Resolve the ordered EVM RPC list once for every worker subsystem. */
export function resolveEvmRpcUrls(
  env: EvmRpcEnvironment = process.env,
): string[] {
  return (env.EVM_RPC_URLS ?? env.EVM_RPC_URL ?? DEFAULT_EVM_RPC_URL)
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
}

/** Safe label for logs and /healthz: never expose URL credentials or query tokens. */
export function safeRpcEndpoint(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    const path = url.pathname === '/' ? '' : url.pathname;
    return `${url.protocol}//${url.host}${path}`;
  } catch {
    return '[invalid RPC endpoint]';
  }
}
