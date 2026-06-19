/**
 * PATCH /api/contracts/[address]/abi — upload a custom ABI for event decoding.
 *
 * Security invariants:
 * - Auth: requireUser() — 401 if anonymous.
 * - Ownership: contract must belong to the authenticated user.
 * - Input validation: JSON parse, Array check, ≤500 entries, ≤100 KB, each entry
 *   has .type (string) and .name (string). Fails loudly on any violation.
 * - sanitizeKeys(): strips $ and . from all keys before MongoDB insert
 *   (MongoDB operator injection guard — on-chain ABI content is untrusted).
 * - EVM Sidechain only. Native contracts (XLS-0101) are out of scope here.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { requireUser }  from '@/lib/current-user';
import { getDb }        from '@/lib/db';
import { sanitizeKeys } from '@/lib/ssrf';

export const dynamic = 'force-dynamic';

const MAX_ENTRIES = 500;
const MAX_BYTES   = 100_000; // 100 KB

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  let user;
  try { user = await requireUser(); } catch (e) { return e as Response; }

  const { address } = await params;
  const addr = address.toLowerCase();

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || !('abi' in body)) {
    return NextResponse.json({ error: 'Missing "abi" field.' }, { status: 400 });
  }

  // abi field must be a JSON string (the raw ABI array as text)
  const abiRaw = (body as Record<string, unknown>).abi;
  if (typeof abiRaw !== 'string') {
    return NextResponse.json({ error: '"abi" must be a JSON string.' }, { status: 400 });
  }

  // ── Size check (before parse) ────────────────────────────────────────────────
  if (abiRaw.length > MAX_BYTES) {
    return NextResponse.json(
      { error: `ABI exceeds maximum size of ${MAX_BYTES} bytes.` },
      { status: 400 },
    );
  }

  // ── Parse ABI ───────────────────────────────────────────────────────────────
  let parsed: unknown;
  try { parsed = JSON.parse(abiRaw); } catch {
    return NextResponse.json({ error: 'ABI is not valid JSON.' }, { status: 400 });
  }

  if (!Array.isArray(parsed)) {
    return NextResponse.json({ error: 'ABI must be a JSON array.' }, { status: 400 });
  }

  if (parsed.length > MAX_ENTRIES) {
    return NextResponse.json(
      { error: `ABI must have ≤${MAX_ENTRIES} entries (got ${parsed.length}).` },
      { status: 400 },
    );
  }

  // ── Validate each entry ──────────────────────────────────────────────────────
  for (let i = 0; i < parsed.length; i++) {
    const entry = parsed[i];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return NextResponse.json(
        { error: `ABI entry ${i} must be an object.` },
        { status: 400 },
      );
    }
    const e = entry as Record<string, unknown>;
    if (typeof e.type !== 'string' || e.type.trim() === '') {
      return NextResponse.json(
        { error: `ABI entry ${i} missing "type" string.` },
        { status: 400 },
      );
    }
    if (typeof e.name !== 'string' || e.name.trim() === '') {
      return NextResponse.json(
        { error: `ABI entry ${i} missing "name" string.` },
        { status: 400 },
      );
    }
  }

  // ── Sanitize keys (MongoDB injection guard) ──────────────────────────────────
  const sanitized = sanitizeKeys(parsed);

  // ── Verify contract ownership ────────────────────────────────────────────────
  const db = await getDb();
  const contract = await db.collection('contracts').findOne({
    userId: user._id, address: addr,
  });
  if (!contract) {
    return NextResponse.json({ error: 'Contract not found.' }, { status: 404 });
  }

  // ── Upsert ABI ───────────────────────────────────────────────────────────────
  await db.collection('contracts').updateOne(
    { userId: user._id, address: addr },
    { $set: { abi: sanitized, abiUpdatedAt: new Date() } },
  );

  return NextResponse.json({ ok: true });
}
