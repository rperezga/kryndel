/**
 * redecode-unknown-events.mjs — Re-decode historical `events` rows whose `name`
 * is still an "unknown (0x…)" placeholder, using each contract's now-stored ABI
 * (e.g. one auto-fetched from the explorer). Example renames:
 *   "unknown (0x10119521…)" → TokenBurnt
 *   "unknown (0x49522ac0…)" → TokenMinted
 *
 * How matching works: the worker stored these rows with a TRUNCATED topic0 in
 * the name (first 4 bytes, e.g. "0x10119521…"). We compute each ABI event's full
 * topic0 with viem and match it by that prefix, scoped per-contract (so a 4-byte
 * prefix is effectively unique — no cross-contract collisions).
 *
 * Scope/limitation: only the `name` is repaired. The original raw log (topics +
 * data) isn't stored on these rows, so their decoded args (e.g. amount) can't be
 * back-filled here. NEW live events decode fully (name + args) because the worker
 * now has the ABI. One-shot, idempotent, safe to re-run.
 *
 * Usage (repo root, with .env containing MONGODB_URI):
 *   node --env-file=.env scripts/redecode-unknown-events.mjs            # dry-run (default)
 *   node --env-file=.env scripts/redecode-unknown-events.mjs --confirm  # apply
 */
import { MongoClient } from 'mongodb';
import { toEventSelector } from 'viem';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('❌  MONGODB_URI not set — add it to .env');
  process.exit(1);
}
const CONFIRM = process.argv.includes('--confirm');

// A stored name worth re-decoding: an "unknown (0x…)" placeholder, or (defensively)
// a bare topic0 hash. Anything already named (Transfer, …) is skipped.
const isUnknownName = (n) =>
  typeof n === 'string' && (/unknown/i.test(n) || /^0x[0-9a-fA-F]{40,}$/.test(n));
// First hex fragment inside the name — the (possibly truncated) topic0.
const FRAG_RE = /0x[0-9a-fA-F]{6,}/;

/** [{ topic0, name }] for every event in an ABI. Never throws. */
function eventTopics(abi) {
  const list = [];
  if (!Array.isArray(abi)) return list;
  for (const item of abi) {
    if (!item || item.type !== 'event') continue;
    try {
      list.push({ topic0: toEventSelector(item).toLowerCase(), name: item.name });
    } catch {
      /* skip malformed ABI entries */
    }
  }
  return list;
}

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });

try {
  await client.connect();
  const db = client.db('kryndel');
  const contractsCol = db.collection('contracts');
  const eventsCol = db.collection('events');

  const contracts = await contractsCol
    .find({ abi: { $exists: true, $ne: null } })
    .project({ address: 1, name: 1, abi: 1 })
    .toArray();

  if (contracts.length === 0) console.log('No contracts with an ABI — nothing to re-decode.');

  let totalRenamed = 0;
  const grand = {}; // eventName → count (all contracts)

  for (const c of contracts) {
    const addr = String(c.address ?? '').toLowerCase();
    if (!addr) continue;

    const topics = eventTopics(c.abi);
    if (topics.length === 0) continue;

    // Rows for this contract keyed by either field the worker may have written.
    const rows = await eventsCol
      .find({ $or: [{ contract: addr }, { contractAddress: addr }] })
      .project({ _id: 1, name: 1 })
      .toArray();

    const ops = [];
    const summary = {};

    for (const ev of rows) {
      if (!isUnknownName(ev.name)) continue;
      const m = String(ev.name).match(FRAG_RE);
      if (!m) continue;
      const frag = m[0].toLowerCase();
      // Match the ABI event whose full topic0 starts with the stored fragment.
      const hit = topics.find((t) => t.topic0.startsWith(frag));
      if (!hit) continue;
      summary[hit.name] = (summary[hit.name] ?? 0) + 1;
      grand[hit.name] = (grand[hit.name] ?? 0) + 1;
      ops.push({
        updateOne: { filter: { _id: ev._id }, update: { $set: { name: hit.name } } },
      });
    }

    if (ops.length === 0) continue;
    totalRenamed += ops.length;

    const label = c.name || `${addr.slice(0, 10)}…`;
    const breakdown = Object.entries(summary)
      .map(([n, k]) => `${n}×${k}`)
      .join(', ');
    console.log(`▶  ${label} (${addr.slice(0, 10)}…): ${breakdown}`);

    if (CONFIRM) await eventsCol.bulkWrite(ops, { ordered: false });
  }

  console.log('');
  if (Object.keys(grand).length) {
    console.log('Σ  ' + Object.entries(grand).map(([n, k]) => `${n}: ${k}`).join('  ·  '));
  }
  if (!CONFIRM) {
    console.log(`\n🔎  DRY-RUN — would rename ${totalRenamed} event row(s). Re-run with --confirm to apply.`);
  } else {
    console.log(`\n✅  Renamed ${totalRenamed} event row(s).`);
  }
} finally {
  await client.close();
}
