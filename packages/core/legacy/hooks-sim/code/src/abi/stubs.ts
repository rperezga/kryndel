/**
 * stubs.ts — Full ABI stub implementations for XRPL Hooks.
 *
 * Every host function that a Hook can import is stubbed here.
 * Stubs log their name + args and return NOT_IMPLEMENTED (or 0 where
 * the return type is void-like). Real implementations replace individual
 * stubs as the simulator grows.
 *
 * IMPORTANT: All host functions must live under the "env" namespace.
 * createStubImports() returns { env: { _g, ...stubs } }.
 */

import { NOT_IMPLEMENTED } from '../errors.js';
import { createGuard } from '../guard.js';

// ── helpers ────────────────────────────────────────────────────────────────

function stub(name: string) {
  return (...args: unknown[]): bigint => {
    console.debug(`[stub] ${name}(${args.join(', ')}) → NOT_IMPLEMENTED`);
    return BigInt(NOT_IMPLEMENTED);
  };
}

function stub32(name: string) {
  return (...args: unknown[]): number => {
    console.debug(`[stub] ${name}(${args.join(', ')}) → NOT_IMPLEMENTED`);
    return NOT_IMPLEMENTED;
  };
}

// ── ABI stubs ──────────────────────────────────────────────────────────────

export function createStubImports(): { env: Record<string, unknown> } {
  const _g = createGuard();

  return {
    env: {
      // ── Guard (required by ALL hooks) ─────────────────────────────────
      _g,

      // ── Control ───────────────────────────────────────────────────────
      accept: stub('accept'),
      rollback: stub('rollback'),

      // ── Transaction (otxn) ────────────────────────────────────────────
      otxn_burden: stub('otxn_burden'),
      otxn_field: stub('otxn_field'),
      otxn_field_txt: stub('otxn_field_txt'),
      otxn_generation: stub('otxn_generation'),
      otxn_id: stub('otxn_id'),
      otxn_type: stub('otxn_type'),
      otxn_slot: stub('otxn_slot'),
      otxn_param: stub('otxn_param'),

      // ── Hook context ──────────────────────────────────────────────────
      hook_account: stub('hook_account'),
      hook_hash: stub('hook_hash'),
      hook_param: stub('hook_param'),
      hook_param_set: stub('hook_param_set'),
      hook_pos: stub('hook_pos'),
      hook_again: stub('hook_again'),
      hook_skip: stub('hook_skip'),

      // ── State ─────────────────────────────────────────────────────────
      state: stub('state'),
      state_set: stub('state_set'),
      state_foreign: stub('state_foreign'),

      // ── Trace / debug ─────────────────────────────────────────────────
      trace: stub('trace'),
      trace_num: stub('trace_num'),
      trace_float: stub('trace_float'),

      // ── Slot ──────────────────────────────────────────────────────────
      slot: stub('slot'),
      slot_clear: stub('slot_clear'),
      slot_count: stub('slot_count'),
      slot_float: stub('slot_float'),
      slot_id: stub('slot_id'),
      slot_set: stub('slot_set'),
      slot_size: stub('slot_size'),
      slot_subarray: stub('slot_subarray'),
      slot_subfield: stub('slot_subfield'),
      slot_type: stub('slot_type'),
      xpop_slot: stub('xpop_slot'),

      // ── Ledger ────────────────────────────────────────────────────────
      ledger_seq: stub('ledger_seq'),
      ledger_last_hash: stub('ledger_last_hash'),
      ledger_last_time: stub('ledger_last_time'),
      ledger_nonce: stub('ledger_nonce'),
      ledger_keylet: stub('ledger_keylet'),

      // ── Emit / etxn ───────────────────────────────────────────────────
      emit: stub('emit'),
      etxn_burden: stub('etxn_burden'),
      etxn_details: stub('etxn_details'),
      etxn_fee_base: stub('etxn_fee_base'),
      etxn_generation: stub('etxn_generation'),
      etxn_nonce: stub('etxn_nonce'),
      etxn_reserve: stub('etxn_reserve'),

      // ── Float (XFL) ───────────────────────────────────────────────────
      float_compare: stub('float_compare'),
      float_divide: stub('float_divide'),
      float_exponent: stub('float_exponent'),
      float_exponent_set: stub('float_exponent_set'),
      float_invert: stub('float_invert'),
      float_int: stub('float_int'),
      float_log: stub('float_log'),
      float_mantissa: stub('float_mantissa'),
      float_mantissa_set: stub('float_mantissa_set'),
      float_mulratio: stub('float_mulratio'),
      float_multiply: stub('float_multiply'),
      float_negate: stub('float_negate'),
      float_one: stub('float_one'),
      float_root: stub('float_root'),
      float_set: stub('float_set'),
      float_sign: stub('float_sign'),
      float_sign_set: stub('float_sign_set'),
      float_sto: stub('float_sto'),
      float_sto_set: stub('float_sto_set'),
      float_sum: stub('float_sum'),

      // ── Util ──────────────────────────────────────────────────────────
      util_accid: stub('util_accid'),
      util_keylet: stub('util_keylet'),
      util_raddr: stub('util_raddr'),
      util_sha512h: stub('util_sha512h'),
      util_verify: stub('util_verify'),

      // ── Serialise ─────────────────────────────────────────────────────
      sto_emplace: stub('sto_emplace'),
      sto_erase: stub('sto_erase'),
      sto_subarray: stub('sto_subarray'),
      sto_subfield: stub('sto_subfield'),
      sto_validate: stub('sto_validate'),

      // ── Crypto / misc ─────────────────────────────────────────────────
      meta_slot: stub('meta_slot'),
      fee_base: stub('fee_base'),
    },
  };
}
