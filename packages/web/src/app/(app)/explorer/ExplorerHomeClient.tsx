'use client';
/**
 * ExplorerHomeClient — Etapa 12
 * UniversalSearch + cards latest events / traces / calls.
 * DS tokens + Tailwind. focus-visible + reduced-motion.
 */
import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LiveDot, PhosphorPulse } from '@/components/ds/LiveIndicator';
import { StatusChip } from '@/components/ds';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EventRow {
  _id: string;
  name?: string;
  contract?: string;
  contractAddress?: string;
  txHash?: string;
  indexedAt?: string;
  args?: Record<string, unknown>;
}

interface TraceRow {
  _id: string;
  txHash: string;
  contractAddress?: string;
  method?: string;
  status?: string;
  blockNumber?: number;
  createdAt?: string;
  durationMs?: number;
}

interface CallRow {
  _id: string;
  name?: string;
  contract?: string;
  txHash?: string;
  indexedAt?: string;
  ledgerOrBlock?: number;
}

interface Props {
  latestEvents: Record<string, unknown>[];
  latestTraces: Record<string, unknown>[];
  latestCalls:  Record<string, unknown>[];
}

// ── UniversalSearch parser ────────────────────────────────────────────────────

type ParseResult =
  | { kind: 'evm-address';  value: string }
  | { kind: 'native-addr';  value: string }
  | { kind: 'xaddress';     value: string }
  | { kind: 'evm-txhash';   value: string }
  | { kind: 'selector';     value: string }
  | { kind: 'event-name';   value: string }
  | { kind: 'unknown';      value: string };

function parseInput(raw: string): ParseResult {
  const s = raw.trim();
  if (!s) return { kind: 'unknown', value: s };

  // EVM tx hash: 0x + 64 hex
  if (/^0x[0-9a-fA-F]{64}$/.test(s)) return { kind: 'evm-txhash', value: s.toLowerCase() };
  // EVM address: 0x + 40 hex
  if (/^0x[0-9a-fA-F]{40}$/.test(s)) return { kind: 'evm-address', value: s.toLowerCase() };
  // Function selector: 0x + 8 hex (4 bytes)
  if (/^0x[0-9a-fA-F]{8}$/.test(s)) return { kind: 'selector', value: s.toLowerCase() };
  // X-address (new XRP Ledger format, starts with X, 46+ chars base58)
  if (/^X[1-9A-HJ-NP-Za-km-z]{45,}$/.test(s)) return { kind: 'xaddress', value: s };
  // r-address (classic XRP Ledger, starts with r, 25-35 base58)
  if (/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(s)) return { kind: 'native-addr', value: s };
  // Event or function name (letters only)
  if (/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(s)) return { kind: 'event-name', value: s };
  return { kind: 'unknown', value: s };
}

function routeForResult(r: ParseResult): string | null {
  switch (r.kind) {
    case 'evm-address':
    case 'native-addr':
    case 'xaddress':
      return `/contract/${r.value}`;
    case 'evm-txhash':
      return `/dashboard/traces/${r.value}`;
    case 'selector':
    case 'event-name':
      // Filter explorer events by name — stay on /explorer?q=<name>
      return null; // handled inline
    default:
      return null;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncateMiddle(s: string, start = 6, end = 4): string {
  if (s.length <= start + end + 3) return s;
  return `${s.slice(0, start)}…${s.slice(-end)}`;
}

function relTime(iso?: string): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 10_000) return 'just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ── UniversalSearch ────────────────────────────────────────────────────────────

function UniversalSearch({ onFilterEvent }: { onFilterEvent: (name: string) => void }) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [hint,  setHint]  = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Live hint as user types
  useEffect(() => {
    if (!value.trim()) { setHint(null); setError(null); return; }
    const r = parseInput(value);
    const hints: Record<string, string> = {
      'evm-address':  'EVM contract address — press Enter to explore',
      'native-addr':  'XRP Ledger native address — press Enter to explore',
      'xaddress':     'X-address (new format) — press Enter to explore',
      'evm-txhash':   'EVM tx hash — press Enter to open trace',
      'selector':     'Function selector (4 bytes)',
      'event-name':   'Event / function name — press Enter to filter',
      'unknown':      null as unknown as string,
    };
    setHint(hints[r.kind] ?? null);
    setError(null);
  }, [value]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const r = parseInput(value);
    const dest = routeForResult(r);
    if (dest) {
      router.push(dest);
    } else if (r.kind === 'event-name' || r.kind === 'selector') {
      onFilterEvent(r.value);
    } else if (r.kind === 'unknown') {
      setError('Paste an EVM address (0x…), tx hash, r-address, or event name.');
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-2">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <input
            ref={inputRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="0x… address · tx hash · r-address · Transfer · selector"
            spellCheck={false}
            aria-label="Universal search"
            className="w-full bg-ds-panel border border-solid border-ds-border rounded-lg px-4 py-3 font-ds-mono text-sm text-ds-text placeholder:text-ds-text-3 focus:outline-none focus:border-ds-green focus-visible:ring-1 focus-visible:ring-ds-green transition-colors"
          />
        </div>
        <button
          type="submit"
          className="shrink-0 px-5 py-3 bg-ds-green text-ds-shell font-ds-mono text-sm font-bold rounded-lg hover:bg-ds-green/90 transition-colors border-0 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ds-green"
        >
          Search →
        </button>
      </form>

      {hint && (
        <p className="font-ds-mono text-[10px] text-ds-green flex items-center gap-1.5 pl-1">
          <span aria-hidden>→</span> {hint}
        </p>
      )}
      {error && (
        <p className="font-ds-mono text-[10px] text-ds-red pl-1">{error}</p>
      )}

      <p className="font-ds-mono text-[9px] text-ds-text-3 pl-1">
        Accepts: EVM address · EVM tx hash · r-address · X-address · event name (e.g. Transfer) · 4-byte selector
      </p>
    </div>
  );
}

// ── Activity card ─────────────────────────────────────────────────────────────

function SectionCard({ title, badge, children }: {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-ds-panel border border-solid border-ds-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-0 border-b border-solid border-ds-border/50">
        <h2 className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-wider font-bold m-0">
          {title}
        </h2>
        {badge}
      </div>
      <div>{children}</div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="px-4 py-6 text-center font-ds-mono text-[10px] text-ds-text-3">
      {text}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ExplorerHomeClient({ latestEvents, latestTraces, latestCalls }: Props) {
  const events = latestEvents as unknown as EventRow[];
  const traces = latestTraces as unknown as TraceRow[];
  const calls  = latestCalls  as unknown as CallRow[];

  const [filterName, setFilterName] = useState('');
  const [pulseIdx, setPulseIdx] = useState<number | null>(null);

  // Simulate a phosphor pulse on mount (first item = newest)
  useEffect(() => {
    if (events.length > 0) {
      setPulseIdx(0);
      const t = setTimeout(() => setPulseIdx(null), 800);
      return () => clearTimeout(t);
    }
  }, [events.length]);

  const filteredEvents = filterName
    ? events.filter(e => (e.name ?? '').toLowerCase().includes(filterName.toLowerCase()))
    : events;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center space-y-4 py-8">
        <h1 className="font-ds-sans text-3xl sm:text-4xl font-bold text-ds-text m-0">
          X-ray your{' '}
          <span className="text-ds-green">XRPL contracts</span>
        </h1>
        <p className="font-ds-sans text-sm text-ds-text-2 max-w-lg mx-auto m-0">
          Decode calls, trace events and set real-time alerts for EVM Sidechain contracts.
        </p>
        <UniversalSearch onFilterEvent={setFilterName} />

        {filterName && (
          <div className="flex items-center justify-center gap-2">
            <span className="font-ds-mono text-xs text-ds-text-2">
              Filtering events by: <span className="text-ds-green font-bold">"{filterName}"</span>
            </span>
            <button
              onClick={() => setFilterName('')}
              className="font-ds-mono text-[10px] text-ds-text-3 hover:text-ds-red bg-transparent border-0 cursor-pointer"
            >
              ✕ clear
            </button>
          </div>
        )}
      </div>

      {/* Activity grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Latest Events */}
        <div className="lg:col-span-2">
          <SectionCard
            title={filterName ? `Events — "${filterName}"` : 'Latest Events'}
            badge={<LiveDot />}
          >
            {filteredEvents.length === 0 ? (
              <EmptyRow text={filterName ? 'No matching events.' : 'No events indexed yet.'} />
            ) : (
              <div className="divide-y divide-ds-border/30">
                {filteredEvents.map((ev, i) => {
                  const addr = ev.contractAddress ?? ev.contract ?? '';
                  return (
                    <PhosphorPulse key={ev._id} active={i === pulseIdx}>
                      <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-ds-panel-2/50 transition-colors">
                        <span className="font-ds-mono text-[10px] font-bold text-ds-amber uppercase tracking-wide shrink-0 w-24 truncate">
                          {ev.name ?? 'unknown'}
                        </span>
                        <span className="flex-1 min-w-0">
                          <a
                            href={addr ? `/contract/${addr}` : '#'}
                            className="font-ds-mono text-[10px] text-ds-text-3 hover:text-ds-green transition-colors no-underline truncate block"
                          >
                            {addr ? truncateMiddle(addr, 8, 6) : '—'}
                          </a>
                        </span>
                        {ev.txHash && (
                          <a
                            href={`/dashboard/traces/${ev.txHash}`}
                            className="font-ds-mono text-[9px] text-ds-text-3 hover:text-ds-green no-underline shrink-0 hidden sm:block"
                          >
                            {truncateMiddle(ev.txHash, 6, 4)}
                          </a>
                        )}
                        <span className="font-ds-mono text-[9px] text-ds-text-3 shrink-0 tabular-nums">
                          {relTime(ev.indexedAt)}
                        </span>
                      </div>
                    </PhosphorPulse>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right column: Traces + Calls */}
        <div className="space-y-4">

          {/* Latest Traces */}
          <SectionCard title="Latest Tx Traces">
            {traces.length === 0 ? (
              <EmptyRow text="No traces yet. Paste a tx hash above." />
            ) : (
              <div className="divide-y divide-ds-border/30">
                {traces.map(tr => (
                  <div key={tr._id} className="flex items-center gap-2 px-4 py-2 hover:bg-ds-panel-2/50 transition-colors">
                    <StatusChip
                      status={tr.status === 'success' ? 'ok' : tr.status === 'reverted' ? 'fail' : 'neutral'}
                      label={tr.status === 'success' ? 'OK' : tr.status === 'reverted' ? 'REV' : '—'}
                    />
                    <div className="flex-1 min-w-0">
                      <a
                        href={`/dashboard/traces/${tr.txHash}`}
                        className="font-ds-mono text-[10px] text-ds-green hover:underline no-underline block truncate"
                      >
                        {truncateMiddle(tr.txHash, 6, 4)}
                      </a>
                      {tr.method && tr.method !== 'unknown' && (
                        <span className="font-ds-mono text-[9px] text-ds-amber">{tr.method}</span>
                      )}
                    </div>
                    <span className="font-ds-mono text-[9px] text-ds-text-3 tabular-nums shrink-0">
                      {tr.blockNumber ? `#${tr.blockNumber.toLocaleString()}` : relTime(tr.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Latest Calls */}
          <SectionCard title="Latest Calls">
            {calls.length === 0 ? (
              <EmptyRow text="No calls indexed yet." />
            ) : (
              <div className="divide-y divide-ds-border/30">
                {calls.map(c => (
                  <div key={c._id} className="flex items-center gap-2 px-4 py-2 hover:bg-ds-panel-2/50 transition-colors">
                    <span className="font-ds-mono text-[10px] text-ds-green font-bold shrink-0 truncate max-w-[80px]">
                      {c.name ?? 'unknown'}
                    </span>
                    <div className="flex-1 min-w-0">
                      {c.contract && (
                        <a
                          href={`/contract/${c.contract}`}
                          className="font-ds-mono text-[9px] text-ds-text-3 hover:text-ds-green no-underline block truncate"
                        >
                          {truncateMiddle(c.contract, 6, 4)}
                        </a>
                      )}
                    </div>
                    <span className="font-ds-mono text-[9px] text-ds-text-3 tabular-nums shrink-0">
                      {c.ledgerOrBlock ? `#${c.ledgerOrBlock}` : relTime(c.indexedAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

        </div>
      </div>

      {/* Suggestions */}
      <div className="bg-ds-panel border border-solid border-ds-border rounded-lg p-5 space-y-3">
        <h3 className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-wider font-bold m-0">
          Quick examples
        </h3>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'USDC Bridge (EVM)', addr: '0xe4c3ee653d7861cf236b2bea4bdb2a261231ea67' },
            { label: 'XLS-0101 native', addr: 'r3kmCwWFa5rvPTh4K3L689254d1ab' },
          ].map(s => (
            <a
              key={s.addr}
              href={`/contract/${s.addr}`}
              className="font-ds-mono text-[10px] text-ds-text-2 hover:text-ds-green border border-solid border-ds-border hover:border-ds-green/40 px-3 py-1.5 rounded transition-colors no-underline"
            >
              {s.label} <span className="text-ds-text-3">{truncateMiddle(s.addr, 6, 4)}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
