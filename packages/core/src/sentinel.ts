/**
 * Kryndel Sentinel — read-only XRPL (L1 mainnet) issuer security & health.
 *
 * Uses the standard rippled / Clio JSON-RPC over HTTP POST (account_info,
 * gateway_balances, account_lines, amm_info). No signing, no custody — purely
 * observational. Shared by the web app (snapshot pages) and the worker
 * (24/7 issuer watcher), mirroring how the EVM tracer/decoder are shared.
 */

const DEFAULT_XRPL_RPC = 'https://xrplcluster.com';

// ── AccountRoot lsf flags (https://xrpl.org/accountroot.html) ─────────────────
export const LSF = {
  DefaultRipple:          0x00800000,
  DepositAuth:            0x01000000,
  DisableMaster:          0x00100000,
  GlobalFreeze:           0x00400000,
  NoFreeze:               0x00200000,
  RequireAuth:            0x00040000,
  RequireDestTag:         0x00020000,
  AllowTrustLineClawback: 0x80000000,
} as const;

// ── AccountSet asf flag ids (the SetFlag/ClearFlag values) ────────────────────
export const ASF: Record<number, string> = {
  2:  'RequireAuth',
  4:  'DisableMaster',
  6:  'NoFreeze',
  7:  'GlobalFreeze',
  8:  'DefaultRipple',
  9:  'DepositAuth',
  16: 'AllowTrustLineClawback',
};

/** Transaction types that can change an issuer's security posture. */
export const SECURITY_TX_TYPES = ['SetRegularKey', 'SignerListSet', 'AccountSet'] as const;

export interface IssuerFlags {
  defaultRipple: boolean;
  depositAuth: boolean;
  disableMaster: boolean;
  globalFreeze: boolean;
  noFreeze: boolean;
  requireAuth: boolean;
  requireDestTag: boolean;
  allowClawback: boolean;
  hasRegularKey: boolean;
  /** Best-effort: master key disabled and no regular key set (signer-list caveat). */
  blackholed: boolean;
}

export interface IssuerObligation {
  currency: string;
  value: string;
}

export type SignalLevel = 'ok' | 'warn' | 'risk' | 'info';

export interface SecuritySignal {
  level: SignalLevel;
  code: string;
  title: string;
  detail: string;
}

export interface IssuerSnapshot {
  address: string;
  exists: boolean;
  flags: IssuerFlags;
  regularKey?: string;
  domain?: string;
  ownerCount?: number;
  obligations: IssuerObligation[];
  trustlines?: number;
  trustlinesTruncated?: boolean;
  signals: SecuritySignal[];
  fetchedAt: string;
  error?: string;
}

export interface SentinelOptions {
  endpoint?: string; // XRPL JSON-RPC URL (default: xrplcluster.com)
  timeoutMs?: number;
}

// ── JSON-RPC helper ───────────────────────────────────────────────────────────

async function xrplRpc<T = Record<string, unknown>>(
  method: string,
  params: Record<string, unknown>,
  opts: SentinelOptions = {},
): Promise<T> {
  const endpoint = opts.endpoint ?? DEFAULT_XRPL_RPC;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 12_000);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, params: [params] }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`XRPL RPC ${method} HTTP ${res.status}`);
    const json = (await res.json()) as { result?: T & { error?: string; status?: string } };
    if (!json.result) throw new Error(`XRPL RPC ${method}: empty result`);
    return json.result as T;
  } finally {
    clearTimeout(timer);
  }
}

const isHex = (s: unknown): s is string => typeof s === 'string' && /^[0-9A-Fa-f]+$/.test(s);

function hexToUtf8(hex: string): string {
  try {
    let out = '';
    for (let i = 0; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
    return out;
  } catch {
    return hex;
  }
}

// ── Flag decoding ─────────────────────────────────────────────────────────────

export function decodeAccountFlags(flags: number, hasRegularKey: boolean): IssuerFlags {
  const has = (bit: number) => (flags & bit) !== 0;
  const disableMaster = has(LSF.DisableMaster);
  return {
    defaultRipple: has(LSF.DefaultRipple),
    depositAuth: has(LSF.DepositAuth),
    disableMaster,
    globalFreeze: has(LSF.GlobalFreeze),
    noFreeze: has(LSF.NoFreeze),
    requireAuth: has(LSF.RequireAuth),
    requireDestTag: has(LSF.RequireDestTag),
    allowClawback: has(LSF.AllowTrustLineClawback),
    hasRegularKey,
    blackholed: disableMaster && !hasRegularKey,
  };
}

/** Turn the decoded state into a human-readable security assessment. */
export function buildSignals(flags: IssuerFlags): SecuritySignal[] {
  const s: SecuritySignal[] = [];

  if (flags.blackholed) {
    s.push({
      level: 'ok',
      code: 'blackholed',
      title: 'Issuer is blackholed',
      detail: 'Master key disabled and no regular key — no new tokens can be issued. Supply is fixed.',
    });
  } else if (flags.disableMaster && flags.hasRegularKey) {
    s.push({
      level: 'warn',
      code: 'regular_key_control',
      title: 'Controlled by a regular key',
      detail: 'Master key is disabled but a regular key can still sign — the holder of that key controls the issuer.',
    });
  } else {
    s.push({
      level: 'risk',
      code: 'master_enabled',
      title: 'Master key enabled',
      detail: 'The issuer can still sign transactions and mint more tokens. Supply is not provably fixed.',
    });
  }

  if (flags.noFreeze) {
    s.push({ level: 'ok', code: 'no_freeze', title: 'No-Freeze set', detail: 'The issuer has permanently given up the ability to freeze balances.' });
  } else if (flags.globalFreeze) {
    s.push({ level: 'risk', code: 'global_freeze', title: 'Global Freeze active', detail: 'All balances of this token are currently frozen by the issuer.' });
  } else {
    s.push({ level: 'info', code: 'freeze_possible', title: 'Freeze possible', detail: 'The issuer can freeze individual trustlines or globally (No-Freeze is not set).' });
  }

  if (flags.allowClawback) {
    s.push({ level: 'risk', code: 'clawback', title: 'Clawback enabled', detail: 'The issuer can claw back issued tokens directly from holders’ balances.' });
  }

  if (flags.requireAuth) {
    s.push({ level: 'info', code: 'require_auth', title: 'Authorized trustlines required', detail: 'Holders must be individually authorized by the issuer to hold the token.' });
  }
  if (!flags.defaultRipple) {
    s.push({ level: 'info', code: 'no_default_ripple', title: 'DefaultRipple off', detail: 'Rippling is not enabled by default — unusual for a circulating token issuer.' });
  }
  return s;
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

export async function fetchIssuerSnapshot(
  address: string,
  opts: SentinelOptions = {},
): Promise<IssuerSnapshot> {
  const fetchedAt = new Date().toISOString();
  const base: IssuerSnapshot = {
    address,
    exists: false,
    flags: decodeAccountFlags(0, false),
    obligations: [],
    signals: [],
    fetchedAt,
  };

  // 1. account_info → flags + regular key + domain.
  let info: {
    account_data?: {
      Flags?: number;
      RegularKey?: string;
      Domain?: string;
      OwnerCount?: number;
    };
    error?: string;
  };
  try {
    info = await xrplRpc<typeof info>('account_info', { account: address, ledger_index: 'validated' }, opts);
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : 'account_info failed' };
  }
  if (info.error || !info.account_data) {
    return { ...base, error: info.error === 'actNotFound' ? 'Account not found on XRPL mainnet.' : (info.error ?? 'Account not found.') };
  }

  const ad = info.account_data;
  const hasRegularKey = typeof ad.RegularKey === 'string' && ad.RegularKey.length > 0;
  const flags = decodeAccountFlags(ad.Flags ?? 0, hasRegularKey);

  const snap: IssuerSnapshot = {
    ...base,
    exists: true,
    flags,
    regularKey: hasRegularKey ? ad.RegularKey : undefined,
    domain: isHex(ad.Domain) ? hexToUtf8(ad.Domain) : undefined,
    ownerCount: typeof ad.OwnerCount === 'number' ? ad.OwnerCount : undefined,
    signals: buildSignals(flags),
  };

  // 2. gateway_balances → issued supply (obligations). Best-effort.
  try {
    const gb = await xrplRpc<{ obligations?: Record<string, string> }>(
      'gateway_balances',
      { account: address, ledger_index: 'validated' },
      opts,
    );
    if (gb.obligations) {
      snap.obligations = Object.entries(gb.obligations).map(([currency, value]) => ({
        currency: currency.length > 3 && isHex(currency) ? hexToUtf8(currency).replace(/\0+$/, '') : currency,
        value,
      }));
    }
  } catch {
    /* supply optional */
  }

  // 3. account_lines (first page) → trustline count. Best-effort.
  try {
    const al = await xrplRpc<{ lines?: unknown[]; marker?: unknown }>(
      'account_lines',
      { account: address, ledger_index: 'validated', limit: 400 },
      opts,
    );
    if (Array.isArray(al.lines)) {
      snap.trustlines = al.lines.length;
      snap.trustlinesTruncated = al.marker != null;
    }
  } catch {
    /* trustlines optional */
  }

  return snap;
}

// ── Account-tx security classifier (used by the worker watcher) ───────────────

export interface SecurityChange {
  security: boolean;
  level: SignalLevel;
  code: string;
  title: string;
  detail: string;
  txType: string;
  hash?: string;
}

/**
 * Classify an XRPL transaction (as returned inside account_tx) for issuer
 * security relevance. Returns null for non-security transactions.
 * Accepts both legacy ({ tx, meta }) and tx_json shapes.
 */
export function classifyAccountTx(entry: unknown): SecurityChange | null {
  const e = entry as { tx?: Record<string, unknown>; tx_json?: Record<string, unknown>; hash?: string };
  const tx = (e.tx ?? e.tx_json ?? (entry as Record<string, unknown>)) as Record<string, unknown>;
  const txType = String(tx.TransactionType ?? '');
  const hash = (tx.hash as string) ?? e.hash;

  if (txType === 'SetRegularKey') {
    const set = typeof tx.RegularKey === 'string' && (tx.RegularKey as string).length > 0;
    return {
      security: true,
      level: set ? 'warn' : 'info',
      code: set ? 'regular_key_set' : 'regular_key_removed',
      title: set ? 'Regular key set' : 'Regular key removed',
      detail: set
        ? `A regular key (${String(tx.RegularKey).slice(0, 10)}…) was assigned — it can now sign for the issuer.`
        : 'The regular key was removed.',
      txType,
      hash,
    };
  }

  if (txType === 'SignerListSet') {
    const quorum = Number(tx.SignerQuorum ?? 0);
    return {
      security: true,
      level: quorum === 0 ? 'info' : 'warn',
      code: quorum === 0 ? 'signer_list_removed' : 'signer_list_set',
      title: quorum === 0 ? 'Signer list removed' : 'Signer list set / changed',
      detail: quorum === 0
        ? 'Multi-sign signer list was removed.'
        : `A multi-sign signer list was set (quorum ${quorum}) — those signers can control the issuer.`,
      txType,
      hash,
    };
  }

  if (txType === 'AccountSet') {
    const setFlag = tx.SetFlag != null ? Number(tx.SetFlag) : null;
    const clearFlag = tx.ClearFlag != null ? Number(tx.ClearFlag) : null;
    const flagId = setFlag ?? clearFlag;
    if (flagId != null && ASF[flagId]) {
      const enabling = setFlag != null;
      const name = ASF[flagId];
      const risky =
        (name === 'DisableMaster' && !enabling) || // re-enabling master = control returns
        name === 'GlobalFreeze' ||
        name === 'AllowTrustLineClawback';
      const goodBlackhole = name === 'DisableMaster' && enabling;
      return {
        security: true,
        level: goodBlackhole ? 'ok' : risky ? 'risk' : 'warn',
        code: `account_set_${name.toLowerCase()}_${enabling ? 'on' : 'off'}`,
        title: `${enabling ? 'Enabled' : 'Disabled'} ${name}`,
        detail: securityFlagDetail(name, enabling),
        txType,
        hash,
      };
    }
    // Other AccountSet (domain, etc.) — low security relevance.
    return null;
  }

  return null;
}

function securityFlagDetail(name: string, enabling: boolean): string {
  switch (name) {
    case 'DisableMaster':
      return enabling
        ? 'Master key disabled — a major step toward blackholing the issuer (no new issuance if no other signer).'
        : 'Master key RE-ENABLED — the issuer can sign and mint again. Investigate.';
    case 'GlobalFreeze':
      return enabling ? 'Global Freeze enabled — all token balances are now frozen.' : 'Global Freeze lifted.';
    case 'NoFreeze':
      return enabling ? 'No-Freeze set — the issuer permanently gave up freezing ability.' : 'No-Freeze cleared.';
    case 'DefaultRipple':
      return enabling ? 'DefaultRipple enabled — balances can ripple between holders.' : 'DefaultRipple disabled.';
    case 'RequireAuth':
      return enabling ? 'RequireAuth enabled — new holders must be authorized.' : 'RequireAuth disabled.';
    case 'AllowTrustLineClawback':
      return enabling
        ? 'Clawback ENABLED — the issuer can now claw back issued tokens from holders.'
        : 'Clawback disabled.';
    default:
      return `${name} ${enabling ? 'enabled' : 'disabled'}.`;
  }
}
