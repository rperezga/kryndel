/**
 * Weekly Sentinel report — pure, web-safe generator.
 *
 * Compiles, for one XRPL issuer: the current security posture + health metrics
 * (from the latest snapshot), the security/supply events of the period (from
 * the `sentinel_events` history), and week-over-week deltas (from the
 * `sentinel_metrics` daily history). Reused by the public report page and the
 * worker's weekly email digest, so it must stay free of Node-only APIs.
 */
import type { IssuerSnapshot, IssuerFlags, SecuritySignal, SignalLevel } from './sentinel.js';
import { totalSupplyByCurrency } from './sentinel.js';

/** One persisted Sentinel event (shape written by the worker into `sentinel_events`). */
export interface SentinelEvent {
  address: string;
  kind: 'security' | 'supply';
  level: SignalLevel;
  code: string;
  title: string;
  detail: string;
  txType?: string;
  hash?: string;
  currency?: string;
  before?: number;
  after?: number;
  ts: string; // ISO
}

/** A metrics point (shape written by the worker into `sentinel_metrics`). */
export interface MetricsPoint {
  supply: Record<string, number>;
  trustlines: number;
  ts: string; // ISO
}

export interface ReportMetrics {
  supply: Record<string, number>;
  trustlines: number;
}

export interface SupplyDelta {
  currency: string;
  before: number;
  after: number;
  pct: number; // signed fractional change (0.05 = +5%)
}

export interface WeeklyReport {
  address: string;
  label: string;
  periodStart: string; // ISO
  periodEnd: string; // ISO
  // Headline posture (worst current signal).
  postureLevel: SignalLevel;
  postureLabel: string;
  blackholed: boolean;
  // Current health.
  flags: IssuerFlags;
  signals: SecuritySignal[];
  metrics: ReportMetrics;
  // Deltas vs ~1 week ago (null when no baseline available).
  supplyDeltas: SupplyDelta[];
  trustlineDelta: number | null;
  hasBaseline: boolean;
  // This period's events.
  events: SentinelEvent[];
  securityEventCount: number;
  supplyEventCount: number;
  // One-line human summary.
  summary: string;
}

const LEVEL_RANK: Record<SignalLevel, number> = { ok: 0, info: 1, warn: 2, risk: 3 };

export function metricsFromSnapshot(snapshot: IssuerSnapshot): ReportMetrics {
  return {
    supply: totalSupplyByCurrency(snapshot),
    trustlines: snapshot.trustlines ?? 0,
  };
}

/**
 * Pick the metrics point closest to `targetMsAgo` ago (default ~7 days) from a
 * descending-by-ts list, used as the week-over-week baseline. Returns null if
 * the history doesn't reach back far enough to be meaningful.
 */
export function baselineFromHistory(
  history: MetricsPoint[],
  now: Date,
  targetMsAgo = 7 * 24 * 3_600_000,
  minMsAgo = 3 * 24 * 3_600_000,
): ReportMetrics | null {
  const target = now.getTime() - targetMsAgo;
  let best: MetricsPoint | null = null;
  let bestDist = Infinity;
  for (const p of history) {
    const t = new Date(p.ts).getTime();
    if (now.getTime() - t < minMsAgo) continue; // too recent to be a "last week" baseline
    const dist = Math.abs(t - target);
    if (dist < bestDist) {
      bestDist = dist;
      best = p;
    }
  }
  return best ? { supply: best.supply ?? {}, trustlines: best.trustlines ?? 0 } : null;
}

export function buildWeeklyReport(input: {
  snapshot: IssuerSnapshot;
  label?: string;
  events: SentinelEvent[];
  prevMetrics?: ReportMetrics | null;
  periodStart: Date;
  periodEnd: Date;
}): WeeklyReport {
  const { snapshot, events, prevMetrics, periodStart, periodEnd } = input;
  const metrics = metricsFromSnapshot(snapshot);

  // Worst posture from current signals.
  let postureLevel: SignalLevel = 'ok';
  for (const s of snapshot.signals ?? []) {
    if (LEVEL_RANK[s.level] > LEVEL_RANK[postureLevel]) postureLevel = s.level;
  }
  const postureLabel =
    postureLevel === 'risk' ? 'At risk' : postureLevel === 'warn' ? 'Watch' : postureLevel === 'info' ? 'Review' : 'Secure';

  // Supply deltas vs baseline.
  const supplyDeltas: SupplyDelta[] = [];
  if (prevMetrics) {
    const ccys = new Set([...Object.keys(metrics.supply), ...Object.keys(prevMetrics.supply)]);
    for (const ccy of ccys) {
      const after = metrics.supply[ccy] ?? 0;
      const before = prevMetrics.supply[ccy] ?? 0;
      if (before === after) continue;
      const pct = before > 0 ? (after - before) / before : after > 0 ? 1 : 0;
      supplyDeltas.push({ currency: ccy, before, after, pct });
    }
    supplyDeltas.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
  }
  const trustlineDelta = prevMetrics ? metrics.trustlines - prevMetrics.trustlines : null;

  const sortedEvents = [...events].sort((a, b) => +new Date(b.ts) - +new Date(a.ts));
  const securityEventCount = sortedEvents.filter((e) => e.kind === 'security').length;
  const supplyEventCount = sortedEvents.filter((e) => e.kind === 'supply').length;

  // One-line summary.
  const parts: string[] = [];
  parts.push(
    securityEventCount === 0
      ? 'no security changes'
      : `${securityEventCount} security change${securityEventCount === 1 ? '' : 's'}`,
  );
  if (supplyEventCount > 0) parts.push(`${supplyEventCount} supply move${supplyEventCount === 1 ? '' : 's'}`);
  const summary = `${postureLabel} — ${parts.join(', ')} this week.`;

  return {
    address: snapshot.address,
    label: input.label || snapshot.address,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    postureLevel,
    postureLabel,
    blackholed: snapshot.flags?.blackholed ?? false,
    flags: snapshot.flags,
    signals: snapshot.signals ?? [],
    metrics,
    supplyDeltas,
    trustlineDelta,
    hasBaseline: !!prevMetrics,
    events: sortedEvents,
    securityEventCount,
    supplyEventCount,
    summary,
  };
}
