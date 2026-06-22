'use client';
/**
 * EventDetailClient — Etapa 13
 * Decoded event: name, args, topic0, link to tx + contract, delivery pipeline, alert context.
 * References: group 3/event_transfer/code.html
 */
import * as React from 'react';
import { useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  event:      Record<string, unknown>;
  alertRules: Record<string, unknown>[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function truncateMiddle(s: string, start = 8, end = 6): string {
  if (!s) return '—';
  if (s.length <= start + end + 3) return s;
  return `${s.slice(0, start)}…${s.slice(-end)}`;
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => { void navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }}
      className="font-ds-mono text-[9px] text-ds-text-3 hover:text-ds-green bg-transparent border border-solid border-ds-border hover:border-ds-green/30 px-2 py-0.5 rounded cursor-pointer transition-colors shrink-0"
      aria-label="Copy"
    >
      {ok ? 'Copied!' : 'Copy'}
    </button>
  );
}

// ── Decoded Args table ─────────────────────────────────────────────────────────

function DecodedArgsTable({ args }: { args: Record<string, unknown> }) {
  // Try to infer type from value
  function inferType(v: unknown): string {
    if (typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v)) return 'address';
    if (typeof v === 'string' && /^\d+$/.test(v)) return 'uint256';
    if (typeof v === 'number') return 'uint256';
    if (typeof v === 'boolean') return 'bool';
    return 'bytes';
  }

  function formatValue(v: unknown): string {
    if (v == null) return '—';
    if (typeof v === 'string' && /^\d{15,}$/.test(v)) {
      // large number, try to format as 6-decimal
      try {
        const n = BigInt(v);
        const dec = Number(n) / 1e6;
        return `${dec.toLocaleString('en-US', { maximumFractionDigits: 6 })} (${v})`;
      } catch { return v; }
    }
    return String(v);
  }

  const entries = Object.entries(args);
  if (entries.length === 0) return <p className="font-ds-mono text-[10px] text-ds-text-3">(no decoded args)</p>;

  return (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="border-0 border-b border-solid border-ds-border/50">
          {['Key', 'Type', 'Value'].map(h => (
            <th key={h} className="font-ds-mono text-[9px] text-ds-text-3 uppercase tracking-wider py-2 px-3 whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {entries.map(([k, v]) => {
          const isAddr = typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v);
          return (
            <tr key={k} className="group border-0 border-b border-solid border-ds-border/20 hover:bg-ds-panel-2/50 transition-colors">
              <td className="py-3 px-3 font-ds-mono text-[10px] text-ds-green font-bold">{k}</td>
              <td className="py-3 px-3">
                <span className="font-ds-mono text-[9px] text-ds-text-3 bg-ds-panel-2 border border-solid border-ds-border px-2 py-0.5 rounded">
                  {inferType(v)}
                </span>
              </td>
              <td className="py-3 px-3">
                <div className="flex items-center gap-2">
                  {isAddr ? (
                    <a href={`/explorer/address/${v as string}`}
                      className="font-ds-mono text-[10px] text-ds-green hover:underline no-underline break-all">
                      {v as string}
                    </a>
                  ) : (
                    <span className={`font-ds-mono text-[10px] break-all ${typeof v === 'number' ? 'text-ds-amber font-bold' : 'text-ds-text-2'}`}>
                      {formatValue(v)}
                    </span>
                  )}
                  {typeof v === 'string' && v.length > 6 && (
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <CopyBtn text={v} />
                    </span>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── Raw Log Topics ─────────────────────────────────────────────────────────────

function RawTopics({ topics, data }: { topics?: string[]; data?: string }) {
  const allTopics = topics ?? [];

  type TopicRow = { offset: string; value: string };
  const rows: TopicRow[] = allTopics.map((t, i) => ({
    offset: i === 0 ? '0x0000' : `0x${(i * 32).toString(16).padStart(4, '0')}`,
    value: t,
  }));
  if (data) rows.push({ offset: 'data  ', value: data.slice(0, 120) + (data.length > 120 ? '…' : '') });

  if (rows.length === 0) return <p className="font-ds-mono text-[10px] text-ds-text-3">(no raw topic data)</p>;

  return (
    <div className="overflow-x-auto">
      {rows.map((r, i) => (
        <div key={i} className="flex gap-3 leading-relaxed">
          <span className="font-ds-mono text-[11px] text-ds-green/60 shrink-0 select-none">{r.offset}:</span>
          <span className="font-ds-mono text-[11px] text-ds-text-2 break-all">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Alert context ──────────────────────────────────────────────────────────────

function AlertContext({ rules }: { rules: Record<string, unknown>[] }) {
  if (rules.length === 0) {
    return (
      <div className="space-y-2">
        <p className="font-ds-mono text-[10px] text-ds-text-3">No active alert rules matched this event.</p>
        <a href="/dashboard/rules" className="font-ds-mono text-[10px] text-ds-green hover:underline no-underline">
          Set up alert →
        </a>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {rules.map((r, i) => (
        <div key={i} className="flex items-start gap-3 p-3 bg-ds-amber/5 border border-solid border-ds-amber/20 rounded-lg">
          <span className="text-ds-amber text-sm mt-0.5" aria-hidden>⚠</span>
          <div>
            <p className="font-ds-mono text-xs text-ds-amber font-bold">{r.event as string}</p>
            <p className="font-ds-mono text-[10px] text-ds-text-3 mt-0.5">{r.channel as string}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export function EventDetailClient({ event, alertRules }: Props) {
  const name        = (event.name as string | undefined) ?? 'unknown';
  const contractRaw = (event.contractAddress ?? event.contract ?? '') as string;
  const txHash      = (event.txHash ?? event.transactionHash ?? '') as string;
  const indexedAt   = event.indexedAt as string | undefined;
  const blockNum    = (event.ledgerOrBlock ?? event.blockNumber) as number | undefined;
  const args        = (event.args ?? {}) as Record<string, unknown>;
  const topics      = event.topics as string[] | undefined;
  const rawData     = event.rawData as string | undefined;

  const hasDecoded = !!(args && Object.keys(args).length > 0);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 font-ds-mono text-[10px] text-ds-text-3">
        <a href="/explorer" className="hover:text-ds-green no-underline transition-colors">Explorer</a>
        <span>/</span>
        <span className="text-ds-text-2">Event: {name}</span>
      </nav>

      {/* Hero header — left border accent like reference */}
      <div className="border-l-2 border-solid border-ds-green pl-5 py-2">
        <div className="flex items-center gap-3 flex-wrap mb-2">
          <h1 className="font-ds-mono text-2xl sm:text-3xl font-bold text-ds-green uppercase tracking-wide m-0">
            {name}
          </h1>
          {hasDecoded && (
            <span className="font-ds-mono text-[9px] text-ds-green border border-solid border-ds-green/30 bg-ds-green/5 px-2 py-0.5 rounded uppercase tracking-wider">
              Decoded
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-ds-mono text-[9px] text-ds-text-3 uppercase tracking-wider w-20 shrink-0">CONTRACT</span>
            {contractRaw ? (
              <a href={`/contract/${contractRaw}`}
                className="font-ds-mono text-xs text-ds-amber hover:underline no-underline">
                {truncateMiddle(contractRaw, 10, 8)}
              </a>
            ) : <span className="font-ds-mono text-xs text-ds-text-3">—</span>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-ds-mono text-[9px] text-ds-text-3 uppercase tracking-wider w-20 shrink-0">TX HASH</span>
            {txHash ? (
              <>
                <a href={`/explorer/tx/${txHash}`}
                  className="font-ds-mono text-xs text-ds-text-2 hover:text-ds-green no-underline transition-colors">
                  {truncateMiddle(txHash, 10, 8)}
                </a>
                <CopyBtn text={txHash} />
              </>
            ) : <span className="font-ds-mono text-xs text-ds-text-3">—</span>}
          </div>
        </div>

        <div className="mt-3 text-right sm:text-left">
          <p className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-wider">TIMESTAMP</p>
          <p className="font-ds-mono text-sm text-ds-text">{fmtDate(indexedAt)}</p>
          {!!blockNum && (
            <p className="font-ds-mono text-[10px] text-ds-green">BLOCK #{blockNum.toLocaleString()}</p>
          )}
        </div>
      </div>

      {/* Main bento grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* Decoded Args (8 cols) */}
        <div className="lg:col-span-8 bg-ds-panel border border-solid border-ds-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-0 border-b border-solid border-ds-border/50">
            <h2 className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-wider font-bold m-0">
              Decoded Parameters
            </h2>
            <span className="font-ds-mono text-[9px] text-ds-text-3">
              {hasDecoded ? `${Object.keys(args).length} args` : 'No ABI'}
            </span>
          </div>
          <div className="overflow-x-auto">
            {hasDecoded
              ? <DecodedArgsTable args={args} />
              : (
                <div className="p-6 text-center space-y-2">
                  <p className="font-ds-mono text-xs text-ds-text-3">Event args not decoded — ABI not uploaded for this contract.</p>
                  {!!contractRaw && (
                    <a href={`/contract/${contractRaw}#abi`}
                      className="font-ds-mono text-[10px] text-ds-green hover:underline no-underline">
                      Upload ABI →
                    </a>
                  )}
                </div>
              )
            }
          </div>
        </div>

        {/* Right: Alerts + network */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-ds-panel border border-solid border-ds-border rounded-lg p-4">
            <h2 className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-wider font-bold mb-3">
              Matched Alerts
            </h2>
            <AlertContext rules={alertRules} />
          </div>

          {/* Quick links */}
          <div className="bg-ds-panel border border-solid border-ds-border rounded-lg p-4 space-y-2">
            <h2 className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-wider font-bold mb-2">
              Links
            </h2>
            {!!txHash && (
              <a href={`/explorer/tx/${txHash}`}
                className="flex items-center gap-2 font-ds-mono text-xs text-ds-text-2 hover:text-ds-green no-underline transition-colors">
                <span className="text-[10px]">→</span> View Tx trace
              </a>
            )}
            {!!contractRaw && (
              <a href={`/contract/${contractRaw}`}
                className="flex items-center gap-2 font-ds-mono text-xs text-ds-text-2 hover:text-ds-green no-underline transition-colors">
                <span className="text-[10px]">→</span> Contract page
              </a>
            )}
            {!!contractRaw && (
              <a href={`/explorer/address/${contractRaw}`}
                className="flex items-center gap-2 font-ds-mono text-xs text-ds-text-2 hover:text-ds-green no-underline transition-colors">
                <span className="text-[10px]">→</span> Address overview
              </a>
            )}
          </div>
        </div>

        {/* Raw event logs (topic0) */}
        <div className="lg:col-span-12 bg-ds-shell border border-solid border-ds-border rounded-lg overflow-hidden">
          <div className="bg-ds-panel flex items-center justify-between px-4 py-2 border-0 border-b border-solid border-ds-border/40">
            <div className="flex items-center gap-2">
              <span className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-wider">Raw Event Logs (Topic 0)</span>
            </div>
            <div className="flex gap-1.5" aria-hidden>
              <span className="w-2 h-2 rounded-full bg-ds-red/40" />
              <span className="w-2 h-2 rounded-full bg-ds-amber/40" />
              <span className="w-2 h-2 rounded-full bg-ds-green/40" />
            </div>
          </div>
          <div className="p-4">
            <RawTopics topics={topics} data={rawData} />
          </div>
        </div>

      </div>
    </div>
  );
}
