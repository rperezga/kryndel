/**
 * Weekly Sentinel report job — emails each issuer's owner a digest of the past
 * week (security events, supply moves, week-over-week deltas, current posture),
 * with a link to the shareable public report page. Runs hourly; sends per issuer
 * at most once every 7 days (tracked via `lastReportAt`). First report goes out
 * as soon as the issuer has a snapshot.
 */
import { ObjectId } from 'mongodb';
import {
  buildWeeklyReport,
  baselineFromHistory,
  type IssuerSnapshot,
  type SentinelEvent,
  type MetricsPoint,
  type SignalLevel,
  type WeeklyReport,
} from '@kryndel/core/full';
import { getDb } from './db.js';
import { sendEmail } from './dispatcher.js';

const CHECK_MS = 60 * 60_000; // hourly
const WEEK_MS = 7 * 24 * 3_600_000;
const BASE_URL = process.env.PUBLIC_BASE_URL ?? 'https://kryndel.dev';

let _active = true;

export function startSentinelReportLoop(): () => void {
  void loop();
  return () => {
    _active = false;
  };
}

async function loop(): Promise<void> {
  // Give the Sentinel poller a couple of minutes to write fresh snapshots
  // before the first run, so first-time reports aren't skipped for lack of data.
  await new Promise<void>((r) => setTimeout(r, 2 * 60_000));
  while (_active) {
    try {
      await runOnce();
    } catch (e) {
      console.error('[sentinel-report] loop error:', e);
    }
    await new Promise<void>((r) => setTimeout(r, CHECK_MS));
  }
}

async function runOnce(): Promise<void> {
  const db = await getDb();
  const issuers = await db.collection('issuers').find({ active: { $ne: false } }).toArray();
  const now = Date.now();
  for (const issuer of issuers) {
    const last = issuer.lastReportAt ? new Date(issuer.lastReportAt as Date).getTime() : 0;
    if (now - last < WEEK_MS) continue;
    await sendReportFor(issuer).catch((e) => console.error(`[sentinel-report] ${issuer.address} failed:`, e));
  }
}

async function sendReportFor(issuer: Record<string, unknown>): Promise<void> {
  const db = await getDb();
  const addr = String(issuer.address);

  // Owner email.
  const userId = issuer.userId as ObjectId | undefined;
  if (!userId) return;
  const user = await db.collection('users').findOne({ _id: userId });
  const to = user?.email as string | undefined;
  if (!to) return;

  // Snapshot must exist (the poller writes it).
  const snapDoc = await db.collection('sentinel_snapshots').findOne({ address: addr });
  const snapshot = snapDoc?.snapshot as IssuerSnapshot | undefined;
  if (!snapshot || !snapshot.exists) return;

  const now = new Date();
  const periodStart = new Date(now.getTime() - WEEK_MS);

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
    ts: new Date(e.ts as Date).toISOString(),
  }));

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

  const label = (issuer.label as string) || addr;
  const report = buildWeeklyReport({ snapshot, label, events, prevMetrics, periodStart, periodEnd: now });

  const { subject, html } = formatReportEmail(report);
  await sendEmail(to, subject, html);

  await db.collection('issuers').updateOne(
    { _id: issuer._id as ObjectId },
    { $set: { lastReportAt: now, lastReportMetrics: report.metrics } },
  );
  console.log(`[sentinel-report] sent weekly report for ${addr} to ${to}`);
}

// ── Email rendering ────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatReportEmail(report: WeeklyReport): { subject: string; html: string } {
  const url = `${BASE_URL}/sentinel/${report.address}/report`;
  const period = `${shortDate(report.periodStart)}–${shortDate(report.periodEnd)}`;
  const subject = `Kryndel Sentinel — ${report.label}: ${report.postureLabel}, ${report.securityEventCount} change${report.securityEventCount === 1 ? '' : 's'} this week`;
  const postureColor =
    report.postureLevel === 'risk' ? '#f85149' : report.postureLevel === 'warn' ? '#d29922' : '#3fb950';

  const deltasHtml =
    report.hasBaseline && report.supplyDeltas.length > 0
      ? `<p style="color:#8b949e;margin:18px 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:1px">Week over week</p>` +
        report.supplyDeltas
          .slice(0, 5)
          .map(
            (d) =>
              `<div style="color:#e6edf3;font-size:14px;margin:2px 0"><b>${esc(d.currency)} supply</b> ${d.pct > 0 ? '+' : ''}${(d.pct * 100).toFixed(1)}% <span style="color:#8b949e">(${d.before.toLocaleString('en-US')} → ${d.after.toLocaleString('en-US')})</span></div>`,
          )
          .join('')
      : '';

  const eventsHtml =
    report.events.length === 0
      ? `<p style="color:#8b949e;margin:0">No security changes or supply anomalies this week. Quiet is good.</p>`
      : `<table style="width:100%;border-collapse:collapse">` +
        report.events
          .slice(0, 20)
          .map(
            (e) =>
              `<tr><td style="padding:8px 0;border-bottom:1px solid #21262d">
                <div style="font-weight:700;color:#e6edf3;font-size:14px">${esc(e.title)}</div>
                <div style="color:#8b949e;font-size:13px">${esc(e.detail)}</div>
                <div style="color:#484f58;font-size:11px">${new Date(e.ts).toLocaleString('en-US')}</div>
              </td></tr>`,
          )
          .join('') +
        `</table>`;

  const html = `<!doctype html><html><body style="margin:0;background:#0d1117;font-family:-apple-system,'Segoe UI',sans-serif;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#161b22;border:1px solid #30363d;border-radius:10px;padding:24px;color:#e6edf3">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#8b949e;font-weight:700">Weekly Sentinel Report</div>
    <h1 style="font-size:22px;margin:8px 0 4px;color:#e6edf3">${esc(report.label)}</h1>
    <div style="color:#8b949e;font-size:13px;margin-bottom:12px">${period} · <b style="color:${postureColor}">${report.postureLabel}</b></div>
    <p style="color:#c9d1d9;margin:0 0 4px;font-size:15px">${esc(report.summary)}</p>
    ${deltasHtml}
    <p style="color:#8b949e;margin:18px 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:1px">This week's events (${report.events.length})</p>
    ${eventsHtml}
    <div style="margin-top:24px;text-align:center">
      <a href="${url}" style="display:inline-block;background:#3fb950;color:#0d1117;text-decoration:none;font-weight:700;padding:11px 22px;border-radius:6px;font-size:13px">View full report →</a>
    </div>
    <p style="color:#484f58;font-size:11px;margin-top:22px;text-align:center">Kryndel Sentinel · XRPL token security monitoring<br><a href="${BASE_URL}/sentinel" style="color:#8b949e">kryndel.dev/sentinel</a></p>
  </div></body></html>`;

  return { subject, html };
}
