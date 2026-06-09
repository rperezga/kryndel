// Kryndel — tipos compartidos para observabilidad de contratos.
// Reemplaza los tipos del simulador de Hooks (ver legacy/hooks-sim/code/src/types.ts).

export type Surface = 'evm' | 'native'; // EVM Sidechain (mainnet) | nativo (AlphaNet)

export interface ContractRef {
  surface: Surface;
  address: string;     // EVM: 0x...; nativo: pseudo-cuenta r... [verificar]
  abi?: unknown;       // EVM: ABI estándar; nativo: ABI on-chain (XLS-0101) [verificar formato]
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
