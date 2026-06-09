import type { Account, HookState, LedgerSeed, StateDiffItem } from './types.js';

/**
 * In-memory XRPL ledger model.
 * Holds accounts, balances and hook state for a single simulation run.
 */
export class Ledger {
  private accounts: Map<string, Account> = new Map();
  private hookState: Map<string, string> = new Map(); // key: `${account}:${keyHex}`
  private snapshot: Map<string, string> = new Map(); // state before execution

  private constructor() {}

  static from(seed?: LedgerSeed): Ledger {
    const ledger = new Ledger();

    if (seed?.accounts) {
      for (const acc of seed.accounts) {
        ledger.accounts.set(acc.address, { ...acc });
      }
    }

    if (seed?.hookState) {
      for (const entry of seed.hookState) {
        const k = Ledger.stateKey(entry.account, entry.key);
        ledger.hookState.set(k, entry.value);
      }
    }

    // Take snapshot of initial state
    ledger.snapshot = new Map(ledger.hookState);

    return ledger;
  }

  // ── Accounts ──────────────────────────────────────────────────────────────

  getAccount(address: string): Account | undefined {
    return this.accounts.get(address);
  }

  getBalance(address: string): bigint {
    return BigInt(this.accounts.get(address)?.balance ?? '0');
  }

  // ── Hook State ────────────────────────────────────────────────────────────

  /**
   * Normalize a key to 32 bytes (64 hex chars): pad with zeros or truncate.
   */
  static normalizeKey(keyHex: string): string {
    const clean = keyHex.replace(/^0x/, '').toLowerCase();
    if (clean.length >= 64) return clean.slice(0, 64);
    return clean.padEnd(64, '0');
  }

  private static stateKey(account: string, keyHex: string): string {
    return `${account}:${Ledger.normalizeKey(keyHex)}`;
  }

  getHookState(account: string, keyHex: string): string | undefined {
    return this.hookState.get(Ledger.stateKey(account, keyHex));
  }

  setHookState(account: string, keyHex: string, valueHex: string): void {
    this.hookState.set(Ledger.stateKey(account, keyHex), valueHex);
  }

  deleteHookState(account: string, keyHex: string): void {
    this.hookState.delete(Ledger.stateKey(account, keyHex));
  }

  // ── Diff ──────────────────────────────────────────────────────────────────

  getStateDiff(): StateDiffItem[] {
    const diff: StateDiffItem[] = [];
    const allKeys = new Set([...this.snapshot.keys(), ...this.hookState.keys()]);

    for (const compoundKey of allKeys) {
      const before = this.snapshot.get(compoundKey) ?? null;
      const after = this.hookState.get(compoundKey) ?? null;
      if (before !== after) {
        const [, key] = compoundKey.split(':');
        diff.push({ key, before, after });
      }
    }

    return diff;
  }
}
