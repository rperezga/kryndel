import type { Metadata } from 'next';
import Link from 'next/link';
import {
  fetchIssuerSnapshot,
  buildWeeklyReport,
  baselineFromHistory,
  type IssuerSnapshot,
  type SentinelEvent,
  type MetricsPoint,
  type SignalLevel,
} from '@kryndel/core';
import { getDb } from '@/lib/db';
import { SentinelForm } from '../../SentinelForm';
import { SentinelReport } from './SentinelReport';

export const dynamic = 'force-dynamic';

const XRPL_RPC_URL = process.env.XRPL_RPC_URL ?? 'https://xrplcluster.com';
const R_ADDR = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;
const WEEK_MS = 7 * 24 * 3_600_000;

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
    ? `Weekly token report — ${shortAddr(address)} · XRPL · Kryndel Sentinel`
    : 'Weekly XRPL token report · Kryndel Sentinel';
  const description = valid
    ? `This week's security & health report for XRPL issuer ${shortAddr(address)} — flag changes, supply moves, blackhole/freeze/clawback status and holders.`
    : 'Weekly security & health reports for any XRPL token issuer.';
  return {
    title,
    description,
    alternates: { canonical: `https://kryndel.dev/sentinel/${address}/report` },
    openGraph: { title, description, url: `https://kryndel.dev/sentinel/${address}/report`, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function SentinelReportPage({ params }: Props) {
  const { address } = await params;
  const addr = (address ?? '').trim();
  if (!R_ADDR.test(addr)) return <ErrorState address={address} kind="invalid" />;

  const db = await getDb();

  // Snapshot: prefer the worker's cached one; otherwise fetch live. The public
  // XRPL cluster can transiently return "not found", so retry once and fall back
  // to a stale cache rather than showing a false negative on a shared link.
  let snapshot: IssuerSnapshot | null = null;
  const cached = await db.collection('sentinel_snapshots').findOne({ address: addr });
  if (cached?.snapshot) {
    const c = serialize(cached.snapshot) as IssuerSnapshot;
    if (c.exists) snapshot = c;
  }
  if (!snapshot) {
    try {
      let live = await fetchIssuerSnapshot(addr, { endpoint: XRPL_RPC_URL, timeoutMs: 12_000 });
      if (!live.exists) live = await fetchIssuerSnapshot(addr, { endpoint: XRPL_RPC_URL, timeoutMs: 12_000 });
      if (live.exists) {
        snapshot = live;
        await db.collection('sentinel_snapshots').updateOne(
          { address: addr },
          { $set: { address: addr, snapshot: serialize(live), cachedAt: new Date() } },
          { upsert: true },
        );
      } else {
        snapshot = live;
      }
    } catch {
      if (cached?.snapshot) snapshot = serialize(cached.snapshot) as IssuerSnapshot;
      else return <ErrorState address={addr} kind="rpc" />;
    }
  }
  if (!snapshot.exists) return <ErrorState address={addr} kind="notfound" />;

  const now = new Date();
  const periodStart = new Date(now.getTime() - WEEK_MS);

  // Events of the last 7 days.
  const evDocs = await db
    .collection('sentinel_events')
    .find({ address: addr, ts: { $gte: periodStart } })
    .sort({ ts: -1 })
    .limit(200)
    .toArray();
  const events: SentinelEvent[] = evDocs.map((e) => ({
    address: addr,
    kind: e.kind === 'supply' ? 'supply' : 'security',
    level: (e.level ?? 'info') as SignalLevel,
    code: String(e.code ?? ''),
    title: String(e.title ?? ''),
    detail: String(e.detail ?? ''),
    txType: e.txType ? String(e.txType) : undefined,
    hash: e.hash ? String(e.hash) : undefined,
    currency: e.currency ? String(e.currency) : undefined,
    before: typeof e.before === 'number' ? e.before : undefined,
    after: typeof e.after === 'number' ? e.after : undefined,
    ts: new Date(e.ts as Date).toISOString(),
  }));

  // Metrics history → week-over-week baseline.
  const metDocs = await db
    .collection('sentinel_metrics')
    .find({ address: addr })
    .sort({ ts: -1 })
    .limit(45)
    .toArray();
  const history: MetricsPoint[] = metDocs.map((m) => ({
    supply: (m.supply ?? {}) as Record<string, number>,
    trustlines: typeof m.trustlines === 'number' ? m.trustlines : 0,
    ts: new Date(m.ts as Date).toISOString(),
  }));
  const prevMetrics = baselineFromHistory(history, now);

  const monitored = await db.collection('issuers').findOne({ address: addr });
  const label = (monitored?.label as string) || shortAddr(addr);

  const report = buildWeeklyReport({ snapshot, label, events, prevMetrics, periodStart, periodEnd: now });

  return <SentinelReport report={report} snapshot={snapshot} />;
}

// ── Error / empty state ───────────────────────────────────────────────────────

function ErrorState({ address, kind }: { address: string; kind: 'invalid' | 'notfound' | 'rpc' }) {
  const COPY: Record<typeof kind, { title: string; body: string }> = {
    invalid: {
      title: 'That doesn’t look like an XRPL account',
      body: 'A weekly report needs a classic issuer address that starts with “r”. Check the value and try again.',
    },
    notfound: {
      title: 'Account not found',
      body: 'We couldn’t find this account on the XRPL mainnet. It may be unfunded, or from another network.',
    },
    rpc: {
      title: 'Couldn’t reach the XRPL network',
      body: 'The XRPL RPC didn’t respond in time. This is usually temporary — please try again in a moment.',
    },
  };
  const { title, body } = COPY[kind];
  return (
    <div className="max-w-3xl mx-auto px-6 py-20 text-center space-y-6">
      <div className="font-ds-mono text-[11px] uppercase tracking-[0.2em] text-ds-amber font-bold select-none">Sentinel · Weekly report</div>
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
    </div>
  );
}
