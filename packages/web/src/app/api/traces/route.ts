/**
 * /api/traces — store and fetch EVM tx traces
 * GET  ?txHash=0x… → return cached trace from DB (or 404)
 * POST { txHash, contractAddress?, abi? } → run traceEvmTx, store, return
 */
import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/lib/current-user';
import { getDb } from '@/lib/db';
import { assertSafePublicUrl } from '@/lib/ssrf';
import { traceEvmTx } from '@kryndel/core';

const EVM_RPC_URL = process.env.EVM_RPC_URL ?? 'https://rpc.xrplevm.org';

export const dynamic = 'force-dynamic';

// ── GET /api/traces?txHash=0x… ────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const txHash = req.nextUrl.searchParams.get('txHash');
  if (!txHash) return NextResponse.json({ error: 'Missing txHash' }, { status: 400 });

  const db = await getDb();
  const stored = await db.collection('traces').findOne(
    { userId: user._id, txHash: txHash.toLowerCase() },
    { sort: { createdAt: -1 } }
  );
  if (!stored) return NextResponse.json({ error: 'Trace not found' }, { status: 404 });

  return NextResponse.json({ ok: true, trace: stored });
}

// ── POST /api/traces ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { txHash?: string; abi?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { txHash, abi } = body;
  if (!txHash || typeof txHash !== 'string') {
    return NextResponse.json({ error: 'Missing txHash' }, { status: 400 });
  }

  // SSRF guard — only allow outbound to allowlisted RPC endpoints
  const endpoint = EVM_RPC_URL;
  try {
    await assertSafePublicUrl(endpoint);
  } catch {
    return NextResponse.json({ error: 'Endpoint not allowed' }, { status: 400 });
  }

  try {
    const trace = await traceEvmTx(txHash, {
      endpoint,
      abi: abi as any,
    });

    // Derive summary fields for list view
    const call = trace.call;
    const method = call?.name ?? 'unknown';
    const contractAddress = trace.contract.address;
    const emitEvent = trace.events.find((e) => e.kind === 'emit');
    const txStatus = emitEvent?.label === 'tx_success' ? 'success' : 'reverted';
    const blockNumber = emitEvent?.data?.block ?? null;

    const db = await getDb();
    const doc = {
      userId: user._id,
      txHash: txHash.toLowerCase(),
      contractAddress,
      method,
      status: txStatus,
      blockNumber,
      surface: 'evm' as const,
      durationMs: trace.durationMs,
      trace, // full trace JSON
      createdAt: new Date(),
    };

    await db.collection('traces').updateOne(
      { userId: user._id, txHash: txHash.toLowerCase() },
      { $set: doc },
      { upsert: true }
    );

    return NextResponse.json({ ok: true, trace: doc });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Trace failed: ${msg}` }, { status: 502 });
  }
}
