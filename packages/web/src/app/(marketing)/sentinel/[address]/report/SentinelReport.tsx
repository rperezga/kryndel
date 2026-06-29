import Link from 'next/link';
import type { WeeklyReport, IssuerSnapshot, SignalLevel } from '@kryndel/core';

/** Server-rendered weekly Sentinel report — self-contained & shareable. */

const LEVEL_DOT: Record<SignalLevel, string> = {
  ok: 'bg-ds-green',
  warn: 'bg-ds-amber',
  risk: 'bg-ds-red',
  info: 'bg-ds-text-3',
};

const POSTURE_PILL: Record<SignalLevel, string> = {
  ok: 'text-ds-green border-ds-green/40 bg-ds-green/5',
  warn: 'text-ds-amber border-ds-amber/40 bg-ds-amber/5',
  risk: 'text-ds-red border-ds-red/40 bg-ds-red/5',
  info: 'text-ds-text-2 border-ds-border bg-ds-panel',
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtPct(pct: number): string {
  const s = pct * 100;
  return `${s > 0 ? '+' : ''}${Number.isInteger(s) ? s : s.toFixed(1)}%`;
}
function fmtAmount(v: string): string {
  const [intPart, dec] = String(v).split('.');
  let head = intPart;
  try {
    head = BigInt(intPart.replace('-', '')).toLocaleString('en-US');
    if (intPart.startsWith('-')) head = `-${head}`;
  } catch {
    /* leave as-is */
  }
  return dec ? `${head}.${dec.slice(0, 4)}` : head;
}

function Fact({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'green' | 'red' | 'amber' }) {
  const tones: Record<string, string> = {
    default: 'text-ds-text',
    green: 'text-ds-green',
    red: 'text-ds-red',
    amber: 'text-ds-amber',
  };
  return (
    <div className="space-y-1">
      <div className="font-ds-mono text-[9px] uppercase tracking-wider text-ds-text-3 font-bold">{label}</div>
      <div className={`font-ds-mono text-sm font-bold ${tones[tone]}`}>{value}</div>
    </div>
  );
}

export function SentinelReport({ report, snapshot }: { report: WeeklyReport; snapshot: IssuerSnapshot }) {
  const { flags, obligations, trustlines, trustlinesTruncated, regularKey } = snapshot;
  const hasDeltas = report.hasBaseline && (report.supplyDeltas.length > 0 || (report.trustlineDelta ?? 0) !== 0);

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 md:py-16 space-y-8">
      {/* Header */}
      <header className="space-y-3">
        <div className="font-ds-mono text-[11px] uppercase tracking-[0.2em] text-ds-text-3 font-bold select-none">
          Weekly Sentinel Report
        </div>
        <h1 className="font-ds-sans text-2xl md:text-3xl font-bold text-ds-text m-0">{report.label}</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`px-2 py-0.5 border border-solid rounded font-ds-mono text-[10px] uppercase font-bold select-none ${POSTURE_PILL[report.postureLevel]}`}>
            {report.postureLabel}
          </span>
          <span className="font-ds-mono text-xs text-ds-text-3">
            {fmtDate(report.periodStart)} – {fmtDate(report.periodEnd)}
          </span>
        </div>
        <p className="font-ds-mono text-xs text-ds-text-3 break-all m-0">{report.address}</p>
        <p className="font-ds-sans text-sm text-ds-text-2 m-0 leading-relaxed">{report.summary}</p>
      </header>

      {/* Week over week */}
      {hasDeltas && (
        <section className="space-y-2">
          <div className="font-ds-mono text-xs uppercase tracking-wider text-ds-text-3">Week over week</div>
          <div className="bg-ds-panel border border-solid border-ds-border rounded-lg divide-y divide-ds-border/40">
            {report.supplyDeltas.slice(0, 6).map((d) => (
              <div key={d.currency} className="flex items-center justify-between px-4 py-2.5 gap-3">
                <span className="font-ds-mono text-sm text-ds-text font-bold">{d.currency} supply</span>
                <span className={`font-ds-mono text-sm font-bold text-right ${d.pct > 0 ? 'text-ds-amber' : d.pct < 0 ? 'text-ds-green' : 'text-ds-text-2'}`}>
                  {fmtPct(d.pct)}
                  <span className="text-ds-text-3 font-normal"> ({d.before.toLocaleString('en-US')} → {d.after.toLocaleString('en-US')})</span>
                </span>
              </div>
            ))}
            {report.trustlineDelta !== null && report.trustlineDelta !== 0 && (
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="font-ds-mono text-sm text-ds-text font-bold">Trustlines / holders</span>
                <span className={`font-ds-mono text-sm font-bold ${report.trustlineDelta > 0 ? 'text-ds-green' : 'text-ds-amber'}`}>
                  {report.trustlineDelta > 0 ? '+' : ''}
                  {report.trustlineDelta.toLocaleString('en-US')}
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* This week's events */}
      <section className="space-y-2">
        <div className="font-ds-mono text-xs uppercase tracking-wider text-ds-text-3">
          This week’s events ({report.events.length})
        </div>
        {report.events.length === 0 ? (
          <div className="bg-ds-panel border border-solid border-ds-border rounded-lg p-5 text-center">
            <p className="font-ds-sans text-sm text-ds-text-2 m-0">No security changes or supply anomalies this week. Quiet is good.</p>
          </div>
        ) : (
          <div className="bg-ds-panel border border-solid border-ds-border rounded-lg divide-y divide-ds-border/40">
            {report.events.slice(0, 50).map((e, i) => (
              <div key={i} className="flex gap-3 px-4 py-3">
                <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${LEVEL_DOT[e.level]}`} />
                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-ds-mono text-sm font-bold text-ds-text">{e.title}</span>
                    <span className="font-ds-mono text-[10px] text-ds-text-3 shrink-0">{fmtDateTime(e.ts)}</span>
                  </div>
                  <div className="font-ds-sans text-xs text-ds-text-2 leading-relaxed">{e.detail}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Current security & health (compact) */}
      <section className="space-y-2">
        <div className="font-ds-mono text-xs uppercase tracking-wider text-ds-text-3">Current security &amp; health</div>
        <div className="bg-ds-panel border border-solid border-ds-border rounded-lg p-5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
            <Fact label="Master key" value={flags.disableMaster ? 'Disabled' : 'Enabled'} tone={flags.disableMaster ? 'green' : 'red'} />
            <Fact label="Regular key" value={flags.hasRegularKey ? `${regularKey?.slice(0, 8)}…` : 'None'} tone={flags.hasRegularKey ? 'amber' : 'default'} />
            <Fact label="Blackholed" value={flags.blackholed ? 'Yes' : 'No'} tone={flags.blackholed ? 'green' : 'default'} />
            <Fact label="Global freeze" value={flags.globalFreeze ? 'ON' : 'Off'} tone={flags.globalFreeze ? 'red' : 'default'} />
            <Fact label="No-freeze" value={flags.noFreeze ? 'Yes' : 'No'} tone={flags.noFreeze ? 'green' : 'default'} />
            <Fact label="Clawback" value={flags.allowClawback ? 'Enabled' : 'No'} tone={flags.allowClawback ? 'red' : 'default'} />
            <Fact label="Require auth" value={flags.requireAuth ? 'Yes' : 'No'} />
            <Fact label="Default ripple" value={flags.defaultRipple ? 'On' : 'Off'} />
            <Fact label="Trustlines" value={trustlines != null ? `${trustlines.toLocaleString('en-US')}${trustlinesTruncated ? '+' : ''}` : '—'} />
          </div>
        </div>
        {obligations.length > 0 && (
          <div className="bg-ds-panel border border-solid border-ds-border rounded-lg divide-y divide-ds-border/40">
            {obligations.slice(0, 8).map((o) => (
              <div key={o.currency} className="flex items-center justify-between px-4 py-2.5">
                <span className="font-ds-mono text-sm text-ds-text font-bold">{o.currency}</span>
                <span className="font-ds-mono text-sm text-ds-text-2">{fmtAmount(o.value)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="bg-ds-panel border border-solid border-ds-border rounded-lg p-6 text-center space-y-3">
        <p className="font-ds-sans text-sm text-ds-text-2 m-0">
          Get this report every week, plus <span className="text-ds-text font-bold">instant alerts</span> the moment a critical flag changes.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/login"
            className="px-5 py-2.5 bg-ds-green text-ds-shell rounded font-ds-mono text-xs uppercase font-bold tracking-wider no-underline hover:opacity-90 transition-opacity"
          >
            Watch this issuer
          </Link>
          <Link
            href={`/sentinel/${report.address}`}
            className="px-5 py-2.5 border border-solid border-ds-border text-ds-text-2 rounded font-ds-mono text-xs uppercase font-bold tracking-wider no-underline hover:border-ds-green hover:text-ds-green transition-colors"
          >
            Live snapshot
          </Link>
        </div>
      </section>
    </div>
  );
}
