/**
 * repair-event-names.mjs — Repairs historical `events` rows whose `name` is a
 * raw 32-byte topic0 hash (from seed.mjs and pre-registry watch-seed runs)
 * by replacing it with the decoded standard event name (Transfer, Approval, …).
 *
 * Why: the live worker now persists DECODED names, but old rows still show the
 * raw hash in the dashboard Event Stream. This is a one-shot backfill.
 *
 * Usage (repo root, with .env = MONGODB_URI):
 *   node --env-file=.env scripts/repair-event-names.mjs           # dry-run (default)
 *   node --env-file=.env scripts/repair-event-names.mjs --confirm # apply
 *
 * Only rows matching a KNOWN standard topic0 are renamed. Unknown topic hashes
 * are left untouched (the UI shows them as `Unknown (0x…)`), so they can be
 * decoded later if the registry grows.
 */
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('❌  MONGODB_URI not set — add it to .env');
  process.exit(1);
}
const CONFIRM = process.argv.includes('--confirm');

// Standard EIP event topic0 → human name. Mirrors core/src/event-registry.ts.
const TOPIC0_NAMES = {
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef': 'Transfer',
  '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925': 'Approval',
  '0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31': 'ApprovalForAll',
  '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62': 'TransferSingle',
  '0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb': 'TransferBatch',
  '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822': 'Swap',
  '0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1': 'Sync',
  '0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f': 'Mint',
  '0xdccd412f0b1252819cb1fd330b93224ca42612892bb3f4f789976e6d81936496': 'Burn',
  '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c': 'Deposit',
  '0x7fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b65': 'Withdrawal',
};
const TOPIC0_RE = /^0x[0-9a-fA-F]{64}$/;

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });

try {
  await client.connect();
  const db = client.db('kryndel');
  const events = db.collection('events');

  // Pull rows whose name is a raw topic0 hash.
  const candidates = await events
    .find({ name: { $regex: TOPIC0_RE } })
    .project({ _id: 1, name: 1, raw: 1 })
    .toArray();

  console.log(`▶  ${candidates.length} event row(s) with a raw-hash name.\n`);

  const summary = {};   // newName → count
  let known = 0;
  let unknown = 0;
  const ops = [];

  for (const ev of candidates) {
    const topic0 = String(
      TOPIC0_RE.test(ev.name) ? ev.name : (ev.raw?.topics?.[0] ?? ''),
    ).toLowerCase();
    const newName = TOPIC0_NAMES[topic0];
    if (!newName) {
      unknown++;
      continue;
    }
    known++;
    summary[newName] = (summary[newName] ?? 0) + 1;
    ops.push({
      updateOne: {
        filter: { _id: ev._id },
        update: { $set: { name: newName } },
      },
    });
  }

  for (const [name, count] of Object.entries(summary)) {
    console.log(`   ${name.padEnd(16)} → ${count}`);
  }
  if (unknown) console.log(`   (left untouched: ${unknown} unknown topic hash(es))`);

  if (!CONFIRM) {
    console.log(`\n🔎  DRY-RUN — would rename ${known} row(s). Re-run with --confirm to apply.`);
  } else if (ops.length === 0) {
    console.log('\n✅  Nothing to rename.');
  } else {
    const res = await events.bulkWrite(ops, { ordered: false });
    console.log(`\n✅  Renamed ${res.modifiedCount} event row(s).`);
  }
} finally {
  await client.close();
}
