// Event kinds recorded during a Hook simulation run
export type EventKind = 'host_call' | 'decision' | 'trace_msg' | 'state_read' | 'state_write' | 'emit';

// A single trace event
export interface TraceEvent {
  t: number;            // Timestamp or sequence index
  kind: EventKind;      // Event type
  fn?: string;          // Host function name
  field?: string;       // Field identifier (if relevant)
  value?: string;       // Value read/written (if relevant)
  key?: string;         // State key or parameter key
  msg?: string;         // Log or trace message from hook
  [key: string]: any;   // Allow custom properties
}

// Verdict of the hook execution
export interface TraceResult {
  decision: 'accept' | 'rollback';
  code: number;         // Return code (0 = success, other = rollback/error code)
  msg: string;          // Reason or message returned by accept/rollback
}

// Difference in a hook state key/value pair
export interface StateDiffItem {
  key: string;          // State key in hex (32 bytes)
  before: string | null;// Previous value in hex (or null if it didn't exist)
  after: string | null; // New value in hex (or null if it was deleted)
}

// In-memory model of an XRPL Account for the simulation ledger
export interface Account {
  address: string;      // Classic XRPL address (e.g. r...)
  balance: string;      // Balance in drops (XRP)
  sequence: number;     // Account Sequence number
  hooks?: any[];        // Set of hooks installed on the account
  [key: string]: any;   // Other fields for extensibility
}

// In-memory model of a Hook State entry
export interface HookState {
  account: string;      // Address of the account owning the hook state
  key: string;          // Hook state key (hex string, 32 bytes / 64 characters)
  value: string;        // Hook state value (hex string, up to 256 bytes)
}

// Configuration to seed initial ledger state for simulation
export interface LedgerSeed {
  accounts?: Account[];
  hookState?: HookState[];
  currentLedger?: {
    ledger_index?: number;
    close_time?: number;
    [key: string]: any;
  };
}

// A standard representation of an XRPL transaction
export interface XrplTransaction {
  TransactionType: string;
  Account: string;
  Fee?: string;
  Sequence?: number;
  SigningPubKey?: string;
  TxnSignature?: string;
  Amount?: string | any;
  Destination?: string;
  [key: string]: any;
}

// Complete Hook Execution Trace
export interface Trace {
  hook: string;                 // Path or name of the simulated WASM hook
  tx: XrplTransaction;          // Transaction that triggered the hook
  events: TraceEvent[];         // Ordered list of events recorded during execution
  result: TraceResult;          // Final decision and return code/message
  stateDiff: StateDiffItem[];   // Ledger state changes during the execution
  emitted: any[];               // Transactions emitted by the hook (if any)
  durationMs: number;           // Execution time in milliseconds
}
