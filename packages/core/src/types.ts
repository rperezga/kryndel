// Kryndel — shared types for contract observability.
// Replaces the old Hooks simulator types (see legacy/hooks-sim/code/src/types.ts).

/** Two valid surfaces: EVM Sidechain (mainnet) and XLS-0101 native contracts (AlphaNet). */
export type Surface = 'evm' | 'native';

export interface ContractRef {
  surface: Surface;
  address: string;     // EVM: 0x…; native: pseudo-account r… (XLS-0101)
  abi?: unknown;       // EVM: standard ABI; native: on-chain ABI (XLS-0101) [verificar format]
  label?: string;
}

export interface DecodedCall {
  name: string;
  args: Record<string, unknown>;
  caller?: string;
  raw?: string;
}

export interface ContractEvent {
  name: string;
  args: Record<string, unknown>;
  raw?: unknown;
  txHash?: string;
  logIndex?: number;           // A2.1: for unique index (contract, txHash, name, logIndex)
  contractAddress?: string;    // A2.4: address of emitting contract — for matchesRule
  ledgerOrBlock?: number;
}

export interface EmittedTx {
  type: string;
  to?: string;
  amount?: string;
  raw?: unknown;
}

export interface StateChange {
  key: string;
  before: unknown;
  after: unknown;
}

export type TraceEventKind = 'call' | 'event' | 'emit' | 'state';

export interface TraceEvent {
  t: number;
  kind: TraceEventKind;
  label: string;
  data?: Record<string, unknown>;
}

export interface Trace {
  contract: ContractRef;
  call?: DecodedCall;
  events: TraceEvent[];
  emitted: EmittedTx[];
  stateDiff: StateChange[];
  txHash?: string;
  durationMs: number;
}

export type AlertChannel = 'telegram' | 'discord' | 'webhook';

export interface AlertRule {
  id: string;
  contract: string;
  event: string;
  channel: AlertChannel;
  target: string;                  // chatId / webhook URL
  filter?: Record<string, unknown>;
}
