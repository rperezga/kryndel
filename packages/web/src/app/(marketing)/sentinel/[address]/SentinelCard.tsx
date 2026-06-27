import Link from 'next/link';
import type { IssuerSnapshot, SecuritySignal, SignalLevel } from '@kryndel/core';

/** Server-rendered XRPL issuer security & health card (SEO-friendly). */

const LEVEL: Record<SignalLevel, { dot: string; text: string; border: string }> = {
  ok: { dot: 'bg-ds-green', text: 'text-ds-green', border: 'border-ds-green/30' },
  warn: { dot: 'bg-ds-amber', text: 'text-ds-amber', border: 'border-ds-amber/30' },
  risk: { dot: 'bg-ds-red', text: 'text-ds-red', border: 'border-ds-red/30' },
  info: { dot: 'bg-ds-text-3', text: 'text-ds-text-2', border: 'border-ds-border' },
};

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

export function SentinelCard({ snapshot, stale = false }: { snapshot: IssuerSnapshot; stale?: boolean }) {
  const { address, flags, signals, obligations, trustlines, trustlinesTruncated, regularKey, domain } = snapshot;

  const hasRisk = signals.some((s: SecuritySignal) => s.level === 'risk');
  const verdict = flags.blackholed
    ? { label: 'Blackholed · supply fixed', tone: 'green' as const }
    : hasRisk
      ? { label: 'Needs attention', tone: 'red' as const }
      : { label: 'Active issuer', tone: 'amber' as const };
  const verdictPill: Record<string, string> = {
    green: 'text-ds-green border-ds-green/40 bg-ds-green/5',
    red: 'text-ds-red border-ds-red/40 bg-ds-red/5',
    amber: 'text-ds-amber border-ds-amber/40 bg-ds-amber/5',
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 md:py-16 space-y-8">
      {/* Header */}
      <header className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`px-2 py-0.5 border border-solid rounded font-ds-mono text-[10px] uppercase font-bold select-none ${verdictPill[verdict.tone]}`}>
            {verdict.label}
          </span>
          <span className="font-ds-mono text-xs text-ds-text-3 uppercase tracking-wider">XRPL issuer · Sentinel</span>
          {stale && <span className="font-ds-mono text-[10px] text-ds-text-3">(cached)</span>}
        </div>
        <h1 className="font-ds-mono text-sm md:text-base text-ds-text break-all m-0">{address}</h1>
        {domain && <p className="font-ds-mono text-xs text-ds-text-3 m-0">domain: {domain}</p>}
      </header>

      {/* Signals */}
      <section className="space-y-3">
        {signals.map((s: SecuritySignal, i: number) => (
          <div key={i} className={`bg-ds-panel border border-solid rounded-lg p-4 flex gap-3 ${LEVEL[s.level].border}`}>
            <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${LEVEL[s.level].dot}`} />
            <div className="space-y-0.5">
              <div className={`font-ds-mono text-sm font-bold ${LEVEL[s.level].text}`}>{s.title}</div>
              <div className="font-ds-sans text-xs text-ds-text-2 leading-relaxed">{s.detail}</div>
            </div>
          </div>
        ))}
      </section>

      {/* Key facts */}
      <section className="bg-ds-panel border border-solid border-ds-border rounded-lg p-5">
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
      </section>

      {/* Supply */}
      {obligations.length > 0 && (
        <section className="space-y-2">
          <div className="font-ds-mono text-xs uppercase tracking-wider text-ds-text-3">Issued supply</div>
          <div className="bg-ds-panel border border-solid border-ds-border rounded-lg divide-y divide-ds-border/40">
            {obligations.slice(0, 12).map((o) => (
              <div key={o.currency} className="flex items-center justify-between px-4 py-2.5">
                <span className="font-ds-mono text-sm text-ds-text font-bold">{o.currency}</span>
                <span className="font-ds-mono text-sm text-ds-text-2">{fmtAmount(o.value)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="bg-ds-panel border border-solid border-ds-border rounded-lg p-6 text-center space-y-3">
        <p className="font-ds-sans text-sm text-ds-text-2 m-0">
          Want an <span className="text-ds-text font-bold">instant alert</span> if any of this changes —
          master key re-enabled, freeze or clawback toggled, supply jumps?
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/login"
            className="px-5 py-2.5 bg-ds-green text-ds-shell rounded font-ds-mono text-xs uppercase font-bold tracking-wider no-underline hover:opacity-90 transition-opacity"
          >
            Watch this issuer
          </Link>
          <Link
            href="/sentinel"
            className="px-5 py-2.5 border border-solid border-ds-border text-ds-text-2 rounded font-ds-mono text-xs uppercase font-bold tracking-wider no-underline hover:border-ds-green hover:text-ds-green transition-colors"
          >
            Check another
          </Link>
        </div>
      </section>
    </div>
  );
}
