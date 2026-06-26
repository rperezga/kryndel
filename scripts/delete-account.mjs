/**
 * delete-account.mjs — admin one-off. Deletes a user account + ALL related data
 * so the email can be registered fresh. Use for testing the live billing flow.
 *
 * ⚠️ IRREVERSIBLE on the target database. Dry-run by default.
 *
 * Usage (from packages/web or repo root, with MONGODB_URI in env):
 *   node scripts/delete-account.mjs rperezga@gmail.com            # dry run (shows what it would delete)
 *   node scripts/delete-account.mjs rperezga@gmail.com --confirm  # actually delete
 *
 * Local-only utility — not meant to live in the public repo. Delete it after use.
 */
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) { console.error('MONGODB_URI is not set'); process.exit(1); }

const email = (process.argv[2] || '').toLowerCase().trim();
const confirm = process.argv.includes('--confirm');
if (!email) {
  console.error('Usage: node scripts/delete-account.mjs <email> [--confirm]');
  process.exit(1);
}

const client = new MongoClient(uri);
await client.connect();
const db = client.db('kryndel');

const user = await db.collection('users').findOne({ email });
if (!user) {
  console.log(`No user found for "${email}". Nothing to do.`);
  await client.close();
  process.exit(0);
}

const uid = user._id;
console.log(`Found user "${email}"  (_id=${uid}, plan=${user.plan})`);
console.log(confirm ? '\n=== DELETING ===' : '\n=== DRY RUN (no --confirm) ===');

// Collections keyed by userId (ObjectId)
const byUserId = [
  'sessions', 'contracts', 'alert_rules', 'api_keys',
  'webhook_endpoints', 'webhook_deliveries', 'accounts', 'auth_sessions',
];
// Collections keyed by email / identifier
const byEmail = [['logins', 'email'], ['auth_tokens', 'identifier']];

let total = 0;
for (const c of byUserId) {
  const filter = { userId: uid };
  const n = await db.collection(c).countDocuments(filter);
  if (n) {
    console.log(`  ${c}: ${n}`);
    if (confirm) { const r = await db.collection(c).deleteMany(filter); total += r.deletedCount; }
  }
}
for (const [c, key] of byEmail) {
  const filter = { [key]: email };
  const n = await db.collection(c).countDocuments(filter);
  if (n) {
    console.log(`  ${c}: ${n}`);
    if (confirm) { const r = await db.collection(c).deleteMany(filter); total += r.deletedCount; }
  }
}
console.log(`  users: 1`);
if (confirm) {
  const r = await db.collection('users').deleteOne({ _id: uid });
  total += r.deletedCount;
  console.log(`\n✅ Deleted ${total} docs. "${email}" is now free to register again.`);
} else {
  console.log('\nDry run only. Re-run with --confirm to actually delete.');
}

await client.close();
