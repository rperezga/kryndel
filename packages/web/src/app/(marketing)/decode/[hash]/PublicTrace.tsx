import Link from 'next/link';
import { resolveAddressLabel } from '@/lib/address-labels';

/**
 * Server-rendered view of a decoded EVM transaction trace. Kept dependency-light
 * and server-only so the decoded content ships in the HTML (good for SEO).
 */

interface TraceEvent {
  t: number;
  kind: 'call' | 'event' | 'emit';
  label: string;
  data?: Record<string, unknown>;
}
interface Trace {
  contract: { address: string };
  call?: { name?: string; args?: Record<string, unknown> };
  events: TraceEvent[];
  txHash?: string;
  durationMs?: number;
}

const isAddr = (v: unknown): v is string =>
  typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v);

function fmtAddr(v: string): string {
  const label = resolveAddressLabel(v);
  if (label) return label;
  return `${v.slice(0, 8)}…${v.slice(-4)}`;
}

function fmtValue(v: unknown): string {
  if (typeof v === 'string' && /^\d{4,}$/.test(v)) {
    try {
      return BigInt(v).toLocaleString('en-US');
    } catch {
      return v;
    }
  }
  return String(v);
}

function Pill({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'green' | 'red' | 'amber' }) {
  const tones: Record<string, string> = {
    default: 'text-ds-text-2 border-ds-border bg-ds-panel',
    green: 'text-ds-green border-ds-green/40 bg-ds-green/5',
    red: 'text-ds-red border-ds-red/40 bg-ds-red/5',
    amber: 'text-ds-amber border-ds-amber/40 bg-ds-amber/5',
  };
  return (
    <span className={`px-2 py-0.5 border border-solid rounded font-ds-mono text-[10px] uppercase font-bold select-none ${tones[tone]}`}>
      {children}
    </span>
  );
}

function ArgRows({ data }: { data?: Record<string, unknown> }) {
  if (!data) return null;
  const entries = Object.entries(data).filter(([k]) => k !== '_from' && k !== 'args');
  if (entries.length === 0) return null;
  return (
    <div className="grid grid-cols-[minmax(80px,140px)_1fr] gap-x-4 gap-y-1.5 mt-2">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <div className="font-ds-mono text-[11px] text-ds-text-3 uppercase tracking-wider truncate">{k}</div>
          <div className="font-ds-mono text-[12px] text-ds-text break-all">
            {isAddr(v) ? (
              <span title={v}>
                <span className="text-ds-green">{fmtAddr(v)}</span>{' '}
                <span className="text-ds-text-3">{v.slice(0, 6)}…{v.slice(-4)}</span>
              </span>
            ) : (
              fmtValue(v)
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PublicTrace({
  txHash,
  trace,
  contractName,
}: {
  txHash: string;
  trace: Trace;
  contractName?: string | null;
}) {
  const call = trace.events.find((e) => e.kind === 'call');
  const emit = trace.events.find((e) => e.kind === 'emit');
  const events = trace.events.filter((e) => e.kind === 'event');
  const success = emit?.label === 'tx_success';
  const method = trace.call?.name ?? call?.label ?? 'unknown';
  const from = call?.data?.from as string | undefined;
  const to = call?.data?.to as string | undefined;
  const value = call?.data?.value as string | undefined;
  const block = emit?.data?.block as number | undefined;
  const gasUsed = emit?.data?.gasUsed as string | undefined;

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 md:py-16 space-y-8">
      {/* Header */}
      <header className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Pill tone={success ? 'green' : 'red'}>{success ? 'Success' : 'Reverted'}</Pill>
          <span className="font-ds-mono text-xs text-ds-text-3 uppercase tracking-wider">XRPL EVM · decoded</span>
        </div>
        <h1 className="font-ds-mono text-sm md:text-base text-ds-text break-all m-0">{txHash}</h1>
        <div className="flex flex-wrap gap-x-6 gap-y-1 font-ds-mono text-[11px] text-ds-text-3">
          {block != null && <span>Block {Number(block).toLocaleString('en-US')}</span>}
          {gasUsed && <span>Gas {fmtValue(gasUsed)}</span>}
          <span>
            Contract{' '}
            <span className="text-ds-text-2">
              {contractName ? `${contractName} · ` : ''}
              {trace.contract.address.slice(0, 8)}…{trace.contract.address.slice(-4)}
            </span>
          </span>
        </div>
      </header>

      {/* Call */}
      <section className="bg-ds-panel border border-solid border-ds-border rounded-lg p-5 space-y-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-ds-text-3" style={{ fontSize: '16px' }}>
            call
          </span>
          <span className="font-ds-mono text-xs uppercase tracking-wider text-ds-text-3">Call</span>
          <Pill>{method}</Pill>
        </div>
        <div className="font-ds-mono text-[12px] text-ds-text-2 flex flex-wrap items-center gap-2">
          {from && (
            <span title={from}>
              <span className="text-ds-green">{fmtAddr(from)}</span>
            </span>
          )}
          <span className="text-ds-text-3">→</span>
          {to && (
            <span title={to}>
              <span className="text-ds-green">{fmtAddr(to)}</span>
            </span>
          )}
          {value && value !== '0' && <span className="text-ds-text-3">· value {fmtValue(value)}</span>}
        </div>
        <ArgRows data={trace.call?.args} />
      </section>

      {/* Events */}
      <section className="space-y-3">
        <div className="font-ds-mono text-xs uppercase tracking-wider text-ds-text-3 flex items-center gap-2">
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>bolt</span>
          {events.length} event{events.length === 1 ? '' : 's'} decoded
        </div>
        {events.length === 0 ? (
          <div className="bg-ds-panel border border-dashed border-ds-border rounded-lg p-5 font-ds-mono text-xs text-ds-text-3">
            No event logs in this transaction.
          </div>
        ) : (
          events.map((ev, i) => {
            const external = ev.label.startsWith('[external]');
            const name = ev.label.replace(/^\[external\]\s*/, '');
            const emitter = ev.data?._from as string | undefined;
            return (
              <div key={i} className="bg-ds-panel border border-solid border-ds-border rounded-lg p-5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-ds-mono text-[10px] text-ds-text-3">#{i + 1}</span>
                  <Pill tone="green">{name}</Pill>
                  {external && <Pill tone="amber">external</Pill>}
                  {external && emitter && (
                    <span className="font-ds-mono text-[10px] text-ds-text-3" title={emitter}>
                      from {emitter.slice(0, 8)}…{emitter.slice(-4)}
                    </span>
                  )}
                </div>
                <ArgRows data={ev.data} />
              </div>
            );
          })
        )}
      </section>

      {/* CTA */}
      <section className="bg-ds-panel border border-solid border-ds-border rounded-lg p-6 text-center space-y-3">
        <p className="font-ds-sans text-sm text-ds-text-2 m-0">
          Want Kryndel to <span className="text-ds-text font-bold">alert you</span> the moment events
          like these fire on a contract?
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/login"
            className="px-5 py-2.5 bg-ds-green text-ds-shell rounded font-ds-mono text-xs uppercase font-bold tracking-wider no-underline hover:opacity-90 transition-opacity"
          >
            Start monitoring free
          </Link>
          <Link
            href="/decode"
            className="px-5 py-2.5 border border-solid border-ds-border text-ds-text-2 rounded font-ds-mono text-xs uppercase font-bold tracking-wider no-underline hover:border-ds-green hover:text-ds-green transition-colors"
          >
            Decode another
          </Link>
        </div>
      </section>
    </div>
  );
}
