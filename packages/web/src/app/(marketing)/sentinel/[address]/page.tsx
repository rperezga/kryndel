import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { fetchIssuerSnapshot, type IssuerSnapshot } from '@kryndel/core';
import { getDb } from '@/lib/db';
import { rateLimit, clientIpFrom } from '@/lib/rate-limit';
import { SentinelForm } from '../SentinelForm';
import { SentinelCard } from './SentinelCard';

export const dynamic = 'force-dynamic';

const XRPL_RPC_URL = process.env.XRPL_RPC_URL ?? 'https://xrplcluster.com';
const R_ADDR = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;
const FRESH_MS = 5 * 60_000; // re-use a cached snapshot for 5 minutes

interface Props {
  params: Promise<{ address: string }>;
}

const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

function serialize<T>(doc: T): T {
  return JSON.parse(JSON.stringify(doc, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address } = await params;
  const valid = R_ADDR.test(address ?? '');
  const title = valid
    ? `Token security for ${shortAddr(address)} · XRPL · Kryndel Sentinel`
    : 'XRPL token security check · Kryndel Sentinel';
  const description = valid
    ? `Security & health of XRPL issuer ${shortAddr(address)} — blackhole status, freeze/clawback powers, regular key, issued supply and holders.`
    : 'Check any XRPL token issuer — blackhole, freeze, clawback, supply. Free, no login.';
  return {
    title,
    description,
    alternates: { canonical: `https://kryndel.dev/sentinel/${address}` },
    openGraph: { title, description, url: `https://kryndel.dev/sentinel/${address}`, type: 'website' },
  };
}

export default async function SentinelAddressPage({ params }: Props) {
  const { address } = await params;
  const addr = (address ?? '').trim();

  if (!R_ADDR.test(addr)) {
    return <ErrorState address={address} kind="invalid" />;
  }

  const db = await getDb();

  // 1. Fresh cache hit (shared across visitors).
  const cached = await db.collection('sentinel_snapshots').findOne({ address: addr });
  if (cached?.snapshot && cached.cachedAt && Date.now() - new Date(cached.cachedAt).getTime() < FRESH_MS) {
    return <SentinelCard snapshot={serialize(cached.snapshot) as IssuerSnapshot} />;
  }

  // 2. Rate-limit by IP on the refresh path.
  const ip = clientIpFrom(await headers());
  const rl = await rateLimit(`sentinel:${ip}`, { max: 12, windowMs: 60_000 });
  if (!rl.ok) {
    // Serve a stale snapshot if we have one; otherwise ask to retry.
    if (cached?.snapshot) return <SentinelCard snapshot={serialize(cached.snapshot) as IssuerSnapshot} stale />;
    return <ErrorState address={addr} kind="rate" retryAfterS={rl.retryAfterS} />;
  }

  // 3. Fetch live from XRPL mainnet.
  let snapshot: IssuerSnapshot;
  try {
    snapshot = await fetchIssuerSnapshot(addr, { endpoint: XRPL_RPC_URL, timeoutMs: 12_000 });
  } catch (err) {
    if (cached?.snapshot) return <SentinelCard snapshot={serialize(cached.snapshot) as IssuerSnapshot} stale />;
    return <ErrorState address={addr} kind="rpc" detail={err instanceof Error ? err.message : String(err)} />;
  }

  if (!snapshot.exists) {
    return <ErrorState address={addr} kind="notfound" detail={snapshot.error} />;
  }

  await db.collection('sentinel_snapshots').updateOne(
    { address: addr },
    { $set: { address: addr, snapshot: serialize(snapshot), cachedAt: new Date() } },
    { upsert: true },
  );

  return <SentinelCard snapshot={snapshot} />;
}

// ── Error / empty states ────────────────────────────────────────────────────

function ErrorState({
  address,
  kind,
  retryAfterS,
  detail,
}: {
  address: string;
  kind: 'invalid' | 'notfound' | 'rate' | 'rpc';
  retryAfterS?: number;
  detail?: string;
}) {
  const COPY: Record<typeof kind, { title: string; body: string }> = {
    invalid: {
      title: 'That doesn’t look like an XRPL account',
      body: 'An issuer account is a classic address that starts with “r”. Check the value and try again.',
    },
    notfound: {
      title: 'Account not found',
      body: 'We couldn’t find this account on the XRPL mainnet. It may be unfunded, or the address may be from another network.',
    },
    rate: {
      title: 'Slow down a moment',
      body: `You’ve checked a lot of issuers just now. Try again in about ${retryAfterS ?? 60}s — recently-checked accounts stay instant.`,
    },
    rpc: {
      title: 'Couldn’t reach the XRPL network',
      body: 'The XRPL RPC didn’t respond in time. This is usually temporary — please try again in a moment.',
    },
  };
  const { title, body } = COPY[kind];

  return (
    <div className="max-w-3xl mx-auto px-6 py-20 text-center space-y-6">
      <div className="font-ds-mono text-[11px] uppercase tracking-[0.2em] text-ds-amber font-bold select-none">
        Sentinel
      </div>
      <h1 className="font-ds-sans text-2xl md:text-3xl font-bold text-ds-text m-0">{title}</h1>
      <p className="font-ds-sans text-base text-ds-text-2 max-w-xl mx-auto m-0 leading-relaxed">{body}</p>
      {address ? <p className="font-ds-mono text-[11px] text-ds-text-3 break-all m-0">{address}</p> : null}
      <div className="pt-2">
        <SentinelForm />
      </div>
      <p className="font-ds-mono text-xs text-ds-text-3 m-0">
        <Link href="/sentinel" className="text-ds-green hover:underline">
          ← Back to Sentinel
        </Link>
      </p>
      {process.env.NODE_ENV !== 'production' && detail ? (
        <p className="font-ds-mono text-[10px] text-ds-text-3/60 break-all">{detail}</p>
      ) : null}
    </div>
  );
}
