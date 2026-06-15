/**
 * seed.mjs — Inserts 2-3 known EVM Sidechain contracts into Atlas so the
 * Vercel explorer has data to display immediately after deploy.
 *
 * Usage (from repo root, with .env present):
 *   node --env-file=.env scripts/seed.mjs
 *
 * Requires: MONGODB_URI in .env
 * Contracts seeded: active EVM Sidechain mainnet contracts verified 2026-06-14.
 */

import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('❌  MONGODB_URI not set — add it to .env');
  process.exit(1);
}

const CONTRACTS = [
  {
    address: '0xe4c3ee653d7861cf236b2bea4bdb2a261231ea67',
    surface: 'evm',
    label: 'Active EVM contract (verified active 2026-06-14, events every ~10 min)',
    indexedAt: new Date(),
  },
  {
    address: '0x4ba8028bc62a1cecf98e2ba5da19c6a025485392',
    surface: 'evm',
    label: 'LOOSH ERC-20 token (XRPL EVM Sidechain mainnet)',
    indexedAt: new Date(),
  },
];

// Sample events from the active watcher session (2026-06-14, real mainnet data)
const EVENTS = [
  {
    contract: '0xe4c3ee653d7861cf236b2bea4bdb2a261231ea67',
    surface: 'evm',
    name: '0xc2000795532095aa59c3b6d8106aa8693aec543acb1848eac376ee10f1124b3c',
    txHash: '0xac750671287c3eae79d65a2cb5bf27d71c8270f7e77524e710013df112313e4e',
    blockHash: null,
    logIndex: 0,
    indexedAt: new Date('2026-06-14T19:56:00Z'),
    raw: { topics: ['0xc2000795532095aa59c3b6d8106aa8693aec543acb1848eac376ee10f1124b3c'] },
  },
  {
    contract: '0xe4c3ee653d7861cf236b2bea4bdb2a261231ea67',
    surface: 'evm',
    name: '0xc2000795532095aa59c3b6d8106aa8693aec543acb1848eac376ee10f1124b3c',
    txHash: null,
    blockHash: null,
    logIndex: 1,
    indexedAt: new Date('2026-06-14T20:12:00Z'),
    raw: { topics: ['0xc2000795532095aa59c3b6d8106aa8693aec543acb1848eac376ee10f1124b3c'] },
  },
  {
    contract: '0x4ba8028bc62a1cecf98e2ba5da19c6a025485392',
    surface: 'evm',
    name: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
    txHash: '0xac750671287c3eae79d65a2cb5bf27d71c8270f7e77524e710013df112313e4e',
    blockHash: null,
    logIndex: 0,
    indexedAt: new Date('2026-06-14T19:56:00Z'),
    raw: { topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'] },
  },
];

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });

try {
  await client.connect();
  const db = client.db('kryndel');

  // Upsert contracts
  for (const c of CONTRACTS) {
    await db.collection('contracts').updateOne(
      { address: c.address },
      { $set: c },
      { upsert: true },
    );
    console.log(`  ✓ contract ${c.address.slice(0, 12)}…`);
  }

  // Insert events (skip duplicates)
  for (const e of EVENTS) {
    const key = `${e.txHash ?? 'null'}:${e.logIndex}:${e.contract}`;
    await db.collection('events').updateOne(
      { _seedKey: key },
      { $set: { ...e, _seedKey: key } },
      { upsert: true },
    );
    console.log(`  ✓ event  ${e.name.slice(0, 14)}… @ ${e.contract.slice(0, 12)}…`);
  }

  console.log('\n✅  Seed complete. Open the Vercel URL and search:');
  console.log('   0xe4c3ee653d7861cf236b2bea4bdb2a261231ea67');
  console.log('   0x4ba8028bc62a1cecf98e2ba5da19c6a025485392');
} finally {
  await client.close();
}
