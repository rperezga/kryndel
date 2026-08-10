import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { createPublicClient, http } from 'viem';
import { traceEvmTx } from '@kryndel/core';
import { getDb } from '@/lib/db';
import { fetchVerifiedAbi } from '@/lib/fetch-abi';
import { rateLimit, clientIpFrom } from '@/lib/rate-limit';
import { DecodeForm } from '../DecodeForm';
import { PublicTrace } from './PublicTrace';

export const dynamic = 'force-dynamic';

const EVM_RPC_URL = process.env.EVM_RPC_URL ?? 'https://rpc.xrplevm.org';
const HASH_RE = /^0x[0-9a-f]{64}$/;

interface Props {
  params: Promise<{ hash: string }>;
}

const shortHash = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;

/** Make a trace JSON-safe (bigint → string) before storing / rendering. */
function serialize<T>(doc: T): T {
  return JSON.parse(
    JSON.stringify(doc, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { hash } = await params;
  const h = (hash ?? '').toLowerCase();
  const valid = HASH_RE.test(h);
  const title = valid
    ? `Decoded tx ${shortHash(h)} · XRPL EVM · Kryndel`
    : 'Decode transaction · Kryndel';
  const description = valid
    ? `Decoded contract call and events for XRPL EVM transaction ${shortHash(h)} — method, Transfer / Approval / Mint events and their arguments.`
    : 'Decode any XRPL EVM Sidechain transaction — free, no login.';
  return {
    title,
    description,
    alternates: { canonical: `https://kryndel.dev/decode/${h}` },
    openGraph: { title, description, url: `https://kryndel.dev/decode/${h}`, type: 'website' },
  };
}

export default async function DecodeHashPage({ params }: Props) {
  const { hash } = await params;
  const txHash = (hash ?? '').toLowerCase().trim();

  if (!HASH_RE.test(txHash)) {
    return <ErrorState txHash={hash} kind="invalid" />;
  }

  const isAuthenticated = !!(await auth())?.user;
  const db = await getDb();

  // 1. Public cache (shared across all visitors — good for SEO + abuse control).
  const cached = await db.collection('public_traces').findOne({ txHash });
  if (cached?.trace) {
    return (
      <PublicTrace
        txHash={txHash}
        trace={serialize(cached.trace)}
        contractName={(cached.contractName as string) ?? null}
        isAuthenticated={isAuthenticated}
      />
    );
  }

  // 2. Rate-limit by IP — only on the expensive cache-miss path.
  const ip = clientIpFrom(await headers());
  const rl = await rateLimit(`decode:${ip}`, { max: 15, windowMs: 60_000 });
  if (!rl.ok) {
    return <ErrorState txHash={txHash} kind="rate" retryAfterS={rl.retryAfterS} />;
  }

  // 3. Decode live. Best-effort: auto-fetch the target contract's verified ABI so
  //    custom events decode by name (not just standard Transfer/Approval/…).
  try {
    let abi: unknown[] | null = null;
    try {
      const client = createPublicClient({
        transport: http(EVM_RPC_URL, { timeout: 15_000, retryCount: 2 }),
      });
      const tx = await client.getTransaction({ hash: txHash as `0x${string}` });
      const to = (tx.to ?? '').toLowerCase();
      if (/^0x[0-9a-f]{40}$/.test(to)) abi = await fetchVerifiedAbi(to);
    } catch {
      /* fall through — traceEvmTx re-fetches the tx and works without the ABI */
    }

    const trace = serialize(
      await traceEvmTx(txHash, { endpoint: EVM_RPC_URL, abi: (abi ?? undefined) as never }),
    );

    const contractAddress = trace.contract.address;
    const emit = trace.events.find((e) => e.kind === 'emit');
    await db.collection('public_traces').updateOne(
      { txHash },
      {
        $set: {
          txHash,
          contractAddress,
          method: trace.call?.name ?? 'unknown',
          status: emit?.label === 'tx_success' ? 'success' : 'reverted',
          blockNumber: emit?.data?.block ?? null,
          trace,
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );

    // Note: we intentionally do NOT surface any user's private contract label on
    // this public page — only the address + built-in labels (resolveAddressLabel).
    return <PublicTrace txHash={txHash} trace={trace} contractName={null} isAuthenticated={isAuthenticated} />;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isNotFound = /not be found|not found|could not be found|transaction.*hash/i.test(msg);
    return <ErrorState txHash={txHash} kind={isNotFound ? 'notfound' : 'rpc'} detail={msg} />;
  }
}

// ── Error / empty states ────────────────────────────────────────────────────

function ErrorState({
  txHash,
  kind,
  retryAfterS,
  detail,
}: {
  txHash: string;
  kind: 'invalid' | 'notfound' | 'rate' | 'rpc';
  retryAfterS?: number;
  detail?: string;
}) {
  const COPY: Record<typeof kind, { title: string; body: string }> = {
    invalid: {
      title: 'That doesn’t look like a transaction hash',
      body: 'A transaction hash is 0x followed by 64 hexadecimal characters. Check the value and try again.',
    },
    notfound: {
      title: 'Transaction not found',
      body: 'We couldn’t find this transaction on the XRPL EVM Sidechain mainnet. Double-check the hash — it may be from another network or not yet indexed.',
    },
    rate: {
      title: 'Slow down a moment',
      body: `You’ve decoded a lot of fresh transactions just now. Try again in about ${retryAfterS ?? 60}s — already-decoded transactions stay instant.`,
    },
    rpc: {
      title: 'Couldn’t reach the network',
      body: 'The XRPL EVM RPC didn’t respond in time. This is usually temporary — please try again in a moment.',
    },
  };
  const { title, body } = COPY[kind];

  return (
    <div className="max-w-3xl mx-auto px-6 py-20 text-center space-y-6">
      <div className="font-ds-mono text-[11px] uppercase tracking-[0.2em] text-ds-amber font-bold select-none">
        Decoder
      </div>
      <h1 className="font-ds-sans text-2xl md:text-3xl font-bold text-ds-text m-0">{title}</h1>
      <p className="font-ds-sans text-base text-ds-text-2 max-w-xl mx-auto m-0 leading-relaxed">{body}</p>
      {txHash ? (
        <p className="font-ds-mono text-[11px] text-ds-text-3 break-all m-0">{txHash}</p>
      ) : null}
      <div className="pt-2">
        <DecodeForm />
      </div>
      <p className="font-ds-mono text-xs text-ds-text-3 m-0">
        <Link href="/decode" className="text-ds-green hover:underline">
          ← Back to the decoder
        </Link>
      </p>
      {process.env.NODE_ENV !== 'production' && detail ? (
        <p className="font-ds-mono text-[10px] text-ds-text-3/60 break-all">{detail}</p>
      ) : null}
    </div>
  );
}
