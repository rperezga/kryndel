import type { Trace, XrplTransaction, LedgerSeed } from './types.js';
import { loadHook } from './runtime.js';
import { Recorder } from './recorder.js';
import { Ledger } from './ledger.js';
import { createControlFunctions, HookResult } from './abi/control.js';
import { createOtxnFunctions } from './abi/otxn.js';
import { createStateFunctions } from './abi/state.js';
import { createHookFunctions } from './abi/hook.js';
import { createTraceFunctions } from './abi/trace.js';
import { createUtilFunctions } from './abi/util.js';
import { createFloatFunctions } from './abi/float.js';
import { createEmitFunctions } from './abi/emit.js';
import { createStubImports } from './abi/stubs.js';
import { createGuard } from './guard.js';

export interface SimulateOptions {
  /** Path to the .wasm hook file */
  hookPath: string;
  /** XRPL transaction object (or JSON string) to run the hook against */
  tx: XrplTransaction | string;
  /** Optional ledger seed (accounts + hook state) */
  ledger?: LedgerSeed;
  /** Account address of the hook (defaults to tx.Account) */
  hookAccount?: string;
}

/**
 * Runs a Hook (.wasm) against a transaction and returns a structured Trace.
 */
export async function simulate(options: SimulateOptions): Promise<Trace> {
  const { hookPath } = options;

  // Parse tx
  const tx: XrplTransaction =
    typeof options.tx === 'string' ? (JSON.parse(options.tx) as XrplTransaction) : options.tx;

  // Set up ledger
  const ledger = Ledger.from(options.ledger);
  const hookAccount = options.hookAccount ?? tx.Account;

  const recorder = new Recorder();

  // We need a reference to the instance's memory after instantiation.
  // Use a box so control functions can close over it.
  let memoryRef: WebAssembly.Memory | null = null;
  const getMemory = () => memoryRef;

  // Build real host function implementations
  const { accept, rollback } = createControlFunctions(recorder, getMemory);
  const { otxn_field, otxn_type, otxn_id } = createOtxnFunctions(tx, recorder, getMemory);
  const { state, state_set, state_foreign } = createStateFunctions(hookAccount, ledger, recorder, getMemory);
  const { hook_account, hook_param, hook_param_set } = createHookFunctions(hookAccount, {}, recorder, getMemory);
  const { trace, trace_num, trace_float } = createTraceFunctions(recorder, getMemory);
  const { util_sha512h, util_accid, util_raddr, util_keylet } = createUtilFunctions(recorder, getMemory);
  const { float_set, float_one, float_multiply, float_divide, float_sum, float_negate, float_compare, float_int, float_sign, float_mantissa, float_exponent } = createFloatFunctions(recorder);
  const { etxn_reserve, etxn_fee_base, etxn_nonce, emit } = createEmitFunctions(recorder, getMemory);

  // Merge stubs with real implementations (real wins over stubs)
  const stubs = createStubImports();
  const imports: WebAssembly.Imports = {
    env: {
      ...stubs.env,
      _g: createGuard(),
      accept,
      rollback,
      otxn_field,
      otxn_type,
      otxn_id,
      state,
      state_set,
      state_foreign,
      hook_account,
      hook_param,
      hook_param_set,
      trace,
      trace_num,
      trace_float,
      util_sha512h,
      util_accid,
      util_raddr,
      util_keylet,
      float_set,
      float_one,
      float_multiply,
      float_divide,
      float_sum,
      float_negate,
      float_compare,
      float_int,
      float_sign,
      float_mantissa,
      float_exponent,
      etxn_reserve,
      etxn_fee_base,
      etxn_nonce,
      emit,
    },
  };

  // Load and instantiate the hook
  const hookInstance = await loadHook(hookPath, imports);
  memoryRef = hookInstance.memory;

  // Execute hook(0) — reserved parameter is always 0n
  try {
    hookInstance.hook(0n);
    // If hook returns without calling accept/rollback, treat as accept with code 0
    recorder.setResult({ decision: 'accept', code: 0, msg: '' });
  } catch (err) {
    if (err instanceof HookResult) {
      // Normal termination — result already set in recorder by control functions
    } else {
      // Unexpected error — record as rollback
      const msg = (err as Error).message ?? 'Unknown error';
      recorder.setResult({ decision: 'rollback', code: -1, msg });
    }
  }

  // Capture state diff
  recorder.setStateDiff(ledger.getStateDiff());

  return recorder.toTrace(hookPath, tx);
}
