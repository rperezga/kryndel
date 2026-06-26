/**
 * label-contracts.mjs — Sets a human label (the `name` field) on the contracts
 * that were registered without one (they currently show as a truncated address
 * like `0x0246d65b…`).
 *
 * Scope: only the contracts owned by EMAIL (default rperezga@gmail.com), matched
 * by address. Safe to re-run (idempotent).
 *
 * Usage (repo root, with .env = MONGODB_URI):
 *   node --env-file=.env scripts/label-contracts.mjs            # dry-run (default)
 *   node --env-file=.env scripts/label-contracts.mjs --confirm  # apply
 *   EMAIL=other@x.com node --env-file=.env scripts/label-contracts.mjs --confirm
 */
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('❌  MONGODB_URI not set — add it to .env');
  process.exit(1);
}
const EMAIL   = (process.env.EMAIL ?? 'rperezga@gmail.com').toLowerCase();
const CONFIRM = process.argv.includes('--confirm');

// address (lowercase) → label. Names taken from explorer.xrplevm.org token list.
const LABELS = {
  '0x0246d65ba41da3db6db55e489146eb25ca3634e5': 'ZNS Gift Cards',
  '0x9a68c88399cc5a8f4160c3e7c1ec2a42b7b5d38d': 'Mintiq OG Pass',
  '0xf180136ddc9e4f8c9b5a9fe59e2b1f07265c5d4d': 'ZNS Connect',
  '0x18282db4272edc93246f6134ce0b8588a543521e': 'XRPL PUNK',
  '0x5a2834908cdeec8e08b75c64f1a2d49b12d7548e': 'THE 3BULLS',
  '0xa16148c6ac9ede0d82f0c52899e22a575284f131': 'USDC',
  '0x004618ab3a96f0bdcaefabe3e305597c5fd7b969': 'X-BANK',
  '0x35e5c265bfb5b218bf8240b76409724675a4f64a': 'xrp-seoul',
  '0x6a90e3aab217b732fa92f1678e41c4d18bcd6ed9': 'PEPE',
  '0x06e0b0f1a644bb9881f675ef266cec15a63a3d47': 'Midas XRP',
  '0x4ba8028bc62a1cecf98e2ba5da19c6a025485392': 'LOOSH',
  '0x00000000001594c61dd8a6804da9ab58ed2483ce': 'Unnamed token (0x0000…83ce)',
};

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });

try {
  await client.connect();
  const db = client.db('kryndel');

  const user = await db.collection('users').findOne({ email: EMAIL });
  if (!user) {
    console.error(`❌  No user found for ${EMAIL}`);
    process.exit(1);
  }

  const contracts = await db
    .collection('contracts')
    .find({ userId: user._id })
    .project({ address: 1, name: 1 })
    .toArray();

  const byAddr = new Map(contracts.map((c) => [String(c.address).toLowerCase(), c]));

  console.log(`▶  ${contracts.length} contract(s) for ${EMAIL}\n`);

  const ops = [];
  for (const [addr, label] of Object.entries(LABELS)) {
    const c = byAddr.get(addr);
    if (!c) {
      console.log(`   ⚠  not found in account: ${addr}  (${label})`);
      continue;
    }
    if (c.name === label) {
      console.log(`   =  already "${label}"  (${addr.slice(0, 10)}…)`);
      continue;
    }
    console.log(`   →  "${c.name}"  ⇒  "${label}"  (${addr.slice(0, 10)}…)`);
    ops.push({
      updateOne: {
        filter: { _id: c._id },
        update: { $set: { name: label, updatedAt: new Date() } },
      },
    });
  }

  // Surface any still-unlabeled placeholders not covered by LABELS.
  const uncovered = contracts.filter(
    (c) => /…$/.test(String(c.name)) && !LABELS[String(c.address).toLowerCase()],
  );
  if (uncovered.length) {
    console.log(`\n   ℹ  ${uncovered.length} other placeholder contract(s) not in this map:`);
    for (const c of uncovered) console.log(`      ${c.address}  ("${c.name}")`);
  }

  if (!CONFIRM) {
    console.log(`\n🔎  DRY-RUN — would update ${ops.length} contract(s). Re-run with --confirm to apply.`);
  } else if (ops.length === 0) {
    console.log('\n✅  Nothing to update.');
  } else {
    const res = await db.collection('contracts').bulkWrite(ops, { ordered: false });
    console.log(`\n✅  Labeled ${res.modifiedCount} contract(s).`);
  }
} finally {
  await client.close();
}
