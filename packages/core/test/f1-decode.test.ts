/**
 * F1 decode tests
 *
 * Tests the 3-level cascade in createEvmDecoder.decodeEvent():
 *   Level 1 — contract ABI (if uploaded)
 *   Level 2 — standard event registry (topic0 lookup)
 *   Level 3 — unknown fallback: "unknown (0x…)"
 *
 * Also tests matchesRule() numeric filter operators ($gt/$lt/$gte/$lte/$eq).
 *
 * Logs are constructed manually (encodeAbiParameters + getEventSelector)
 * because viem 2.52.2 does not export encodeEventLog.
 */
import { describe, it, expect } from 'vitest';
import { encodeAbiParameters, getEventSelector } from 'viem';
import { createEvmDecoder, ERC20_ABI } from '../src/decoder.js';
import { lookupByTopic0, STANDARD_EVENT_NAMES } from '../src/event-registry.js';
import { matchesRule } from '../src/subscriber.js';
import type { ContractRef, AlertRule, ContractEvent } from '../src/types.js';

// ── ERC-20 Transfer log (manually encoded) ────────────────────────────────────
//
// Transfer(address indexed from, address indexed to, uint256 value)
//   topic0 = keccak256("Transfer(address,address,uint256)") — standard
//   topic1 = from (indexed, padded)
//   topic2 = to   (indexed, padded)
//   data   = abi-encoded value (non-indexed)

const TRANSFER_TOPIC0 =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' as const;

const FROM_ADDR = '0x1111111111111111111111111111111111111111' as const;
const VALUE_1E18 = 1_000_000_000_000_000_000n;

const TRANSFER_LOG = {
  topics: [
    TRANSFER_TOPIC0,
    // address indexed → padded to 32 bytes (lowercase checksum here is fine for decoding)
    '0x0000000000000000000000001111111111111111111111111111111111111111' as `0x${string}`,
    '0x0000000000000000000000002222222222222222222222222222222222222222' as `0x${string}`,
  ] as [`0x${string}`, ...`0x${string}`[]],
  data: encodeAbiParameters(
    [{ type: 'uint256' }],
    [VALUE_1E18],
  ) as `0x${string}`,
  address:         '0x4ba8000000000000000000000000000000000000' as const,
  transactionHash: '0xabc' as `0x${string}`,
  blockNumber:     42n,
  logIndex:        0,
};

// ── Custom OrderFilled event (manually encoded) ────────────────────────────────
//
// OrderFilled(uint256 indexed orderId, address maker, uint256 amount)
//   topic0 = keccak256 of signature (computed at runtime with getEventSelector)
//   topic1 = orderId (indexed)
//   data   = abi-encoded (maker, amount) non-indexed

const ORDER_FILLED_ABI = [
  {
    type:   'event' as const,
    name:   'OrderFilled',
    inputs: [
      { name: 'orderId', type: 'uint256' as const, indexed: true  },
      { name: 'maker',   type: 'address' as const, indexed: false },
      { name: 'amount',  type: 'uint256' as const, indexed: false },
    ],
  },
];

const MAKER_ADDR   = '0x3333333333333333333333333333333333333333' as const;
const ORDER_ID     = 99n;
const ORDER_AMOUNT = 500n;

const ORDER_TOPIC0 = getEventSelector('OrderFilled(uint256,address,uint256)') as `0x${string}`;

const ORDER_LOG = {
  topics: [
    ORDER_TOPIC0,
    // orderId=99 indexed, padded to 32 bytes
    ('0x' + ORDER_ID.toString(16).padStart(64, '0')) as `0x${string}`,
  ] as [`0x${string}`, ...`0x${string}`[]],
  data: encodeAbiParameters(
    [{ type: 'address' }, { type: 'uint256' }],
    [MAKER_ADDR, ORDER_AMOUNT],
  ) as `0x${string}`,
  address:         '0xe4c3000000000000000000000000000000000000' as const,
  transactionHash: '0xdef' as `0x${string}`,
  blockNumber:     99n,
  logIndex:        0,
};

// ─────────────────────────────────────────────────────────────────────────────

describe('event-registry', () => {
  it('lookupByTopic0 — finds Transfer by standard topic0', () => {
    const entry = lookupByTopic0(TRANSFER_TOPIC0);
    expect(entry).toBeDefined();
    expect(entry!.name).toBe('Transfer');
  });

  it('lookupByTopic0 — returns undefined for unknown topic0', () => {
    expect(
      lookupByTopic0('0xdeadbeef00000000000000000000000000000000000000000000000000000000'),
    ).toBeUndefined();
  });

  it('STANDARD_EVENT_NAMES includes Transfer, Approval, Swap', () => {
    expect(STANDARD_EVENT_NAMES).toContain('Transfer');
    expect(STANDARD_EVENT_NAMES).toContain('Approval');
    expect(STANDARD_EVENT_NAMES).toContain('Swap');
  });
});

describe('decoder cascade', () => {

  // ── Level 2: registry (no ABI on contract) ───────────────────────────────
  it('F1 — 0x4ba8: Transfer decoded via registry WITHOUT uploaded ABI', () => {
    const ref: ContractRef = { surface: 'evm', address: '0x4ba8000000000000000000000000000000000000' };
    const event = createEvmDecoder(ref).decodeEvent(TRANSFER_LOG);

    expect(event.name).toBe('Transfer');
    expect(event.args).toHaveProperty('from');
    expect(event.args).toHaveProperty('to');
    expect(event.args).toHaveProperty('value');
    expect(event.args.value).toBe('1000000000000000000');
    expect(event.contractAddress).toBe('0x4ba8000000000000000000000000000000000000');
  });

  // ── Level 1: contract ABI takes precedence over registry ─────────────────
  it('F1 — Transfer decoded via contract ABI (level 1 wins over registry)', () => {
    const ref: ContractRef = {
      surface: 'evm',
      address: '0x4ba8000000000000000000000000000000000000',
      abi:     ERC20_ABI,
    };
    const event = createEvmDecoder(ref).decodeEvent(TRANSFER_LOG);
    expect(event.name).toBe('Transfer');
    expect(event.args.value).toBe('1000000000000000000');
  });

  // ── Level 1: custom ABI (OrderFilled is not in the registry) ─────────────
  it('F1 — 0xe4c3: OrderFilled decoded WITH uploaded ABI', () => {
    const ref: ContractRef = {
      surface: 'evm',
      address: '0xe4c3000000000000000000000000000000000000',
      abi:     ORDER_FILLED_ABI,
    };
    const event = createEvmDecoder(ref).decodeEvent(ORDER_LOG);

    expect(event.name).toBe('OrderFilled');
    expect(event.args.orderId).toBe('99');
    expect(String(event.args.maker).toLowerCase()).toBe(MAKER_ADDR.toLowerCase());
    expect(event.args.amount).toBe('500');
  });

  // ── Level 3: true unknown (not in registry, no ABI) ──────────────────────
  it('F1 — unknown topic0 → fallback "unknown (0x…)"', () => {
    const ref: ContractRef = { surface: 'evm', address: '0xdeadbeef00000000000000000000000000000000' };
    const event = createEvmDecoder(ref).decodeEvent({
      topics: ['0xdeadbeef00000000000000000000000000000000000000000000000000000000' as `0x${string}`],
      data:   '0x' as `0x${string}`,
    });
    expect(event.name).toBe('unknown (0xdeadbeef…)');
    expect(event.args).toEqual({});
  });

  // ── ABI present but topic not in it → falls through to registry ──────────
  it('F1 — topic in registry but not in custom ABI → registry (level 2)', () => {
    // Custom ABI only knows OrderFilled, not Transfer
    const ref: ContractRef = {
      surface: 'evm',
      address: '0x4ba8000000000000000000000000000000000000',
      abi:     ORDER_FILLED_ABI,
    };
    const event = createEvmDecoder(ref).decodeEvent(TRANSFER_LOG);
    // Level 1 fails (OrderFilled ABI doesn't know Transfer topic0)
    // Level 2 (registry) finds Transfer
    expect(event.name).toBe('Transfer');
    expect(event.args).toHaveProperty('value');
  });

  // ── Custom event topic not in registry → stays unknown without ABI ────────
  it('F1 — custom event topic without ABI → unknown (not in registry)', () => {
    const ref: ContractRef = { surface: 'evm', address: '0xe4c3000000000000000000000000000000000000' };
    const event = createEvmDecoder(ref).decodeEvent(ORDER_LOG);
    // No ABI + not in registry → fallback
    expect(event.name).toMatch(/^unknown/);
    expect(event.args).toEqual({});
  });

});

describe('matchesRule — numeric filter operators (F1.4)', () => {
  const base: ContractEvent = {
    name:            'Transfer',
    contractAddress: '0xabc',
    args:            { value: '2000000000000000000' }, // 2e18
  };
  const rule: AlertRule = {
    id:       'r1',
    contract: '0xabc',
    event:    'Transfer',
    channel:  'telegram',
    target:   '-100',
  };

  it('$gt — fires when value exceeds threshold', () => {
    expect(matchesRule(base, { ...rule, filter: { value: { $gt: '1000000000000000000' } } })).toBe(true);
  });

  it('$gt — does NOT fire when value is below threshold', () => {
    expect(matchesRule(base, { ...rule, filter: { value: { $gt: '3000000000000000000' } } })).toBe(false);
  });

  it('$lt — fires when value is below threshold', () => {
    expect(matchesRule(base, { ...rule, filter: { value: { $lt: '3000000000000000000' } } })).toBe(true);
  });

  it('$gte — fires at exact threshold', () => {
    expect(matchesRule(base, { ...rule, filter: { value: { $gte: '2000000000000000000' } } })).toBe(true);
  });

  it('$lte — fires at exact threshold', () => {
    expect(matchesRule(base, { ...rule, filter: { value: { $lte: '2000000000000000000' } } })).toBe(true);
  });

  it('$eq — fires at exact match', () => {
    expect(matchesRule(base, { ...rule, filter: { value: { $eq: '2000000000000000000' } } })).toBe(true);
  });

  it('$eq — does NOT fire when value differs', () => {
    expect(matchesRule(base, { ...rule, filter: { value: { $eq: '1' } } })).toBe(false);
  });

  it('unknown operator → rejects (returns false)', () => {
    expect(matchesRule(base, { ...rule, filter: { value: { $exists: 'true' } } })).toBe(false);
  });

  it('plain string equality still works (existing behaviour)', () => {
    const r: AlertRule = { ...rule, filter: { from: FROM_ADDR } };
    const ev: ContractEvent = { ...base, args: { from: FROM_ADDR, value: '100' } };
    expect(matchesRule(ev, r)).toBe(true);
  });
});
