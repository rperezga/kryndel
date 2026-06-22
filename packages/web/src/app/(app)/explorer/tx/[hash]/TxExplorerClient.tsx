'use client';
/**
 * TxExplorerClient — Etapa 13
 * Timeline + Call Graph (text tree) + Decoded Logs + Raw JSON + Related Alerts.
 * No @kryndel/core imports. DS tokens throughout. Mobile-first.
 */
import * as React from 'react';
import { useState, useCallback, useRef } from 'react';
import { EventTimeline }  from '@/components/ds/EventTimeline';
import { RawJsonViewer }  from '@/components/ds/RawJsonViewer';
import type { TraceEvent } from '@kryndel/core';

// ── Types ──────────────────────────────────────────────────────────────────────

interface StoredTrace {
  txHash: string;
  contractAddress?: string;
  method?: string;
  status?: string;
  blockNumber?: number;
  surface?: string;
  durationMs?: number;
  createdAt?: string;
  trace?: {
    call?: { name?: string; args?: Record<string, unknown> };
    events?: TraceEvent[];
    stateDiff?: Array<{ key: string; before: unknown; after: unknown }>;
    durationMs?: number;
  };
}

interface Props {
  txHash: string;
  stored: Record<string, unknown> | null;
  decodedEvents: Record<string, unknown>[];
  relatedRules: Record<string, unknown>[];
}

// ── Tab config ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'timeline', label: 'Timeline'    },
  { id: 'callgraph', label: 'Call Graph' },
  { id: 'logs',     label: 'Logs'       },
  { id: 'raw',      label: 'Raw'        },
  { id: 'alerts',   label: 'Alerts'     },
] as const;
type TabId = typeof TABS[number]['id'];

// ── Helpers ────────────────────────────────────────────────────────────────────

function truncateMiddle(s: string, start = 6, end = 4): string {
  if (!s) return '—';
  if (s.length <= start + end + 3) return s;
  return `${s.slice(0, start)}…${s.slice(-end)}`;
}

function relTime(iso?: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: string }) {
  const isOk = status === 'success';
  const isRev = status === 'reverted';
  return (
    <span className={`inline-flex items-center gap-1.5 font-ds-mono text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border border-solid ${
      isOk  ? 'text-ds-green border-ds-green/30 bg-ds-green/10' :
      isRev ? 'text-ds-red border-ds-red/30 bg-ds-red/10' :
              'text-ds-text-3 border-ds-border bg-ds-panel'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isOk ? 'bg-ds-green' : isRev ? 'bg-ds-red' : 'bg-ds-text-3'}`} aria-hidden />
      {isOk ? 'Success' : isRev ? 'Reverted' : status ?? 'Unknown'}
    </span>
  );
}

// ── Call Graph (text tree) ─────────────────────────────────────────────────────

function buildCallTree(stored: StoredTrace | null): string {
  if (!stored?.trace?.events) return '(no trace data)';
  const events = stored.trace.events as TraceEvent[];
  const callEvents = events.filter(e => e.kind === 'call');
  if (callEvents.length === 0 && stored.trace.call) {
    return `└─ CALL  ${stored.trace.call.name ?? 'unknown'}`;
  }
  if (callEvents.length === 0) return '(no call events)';
  return callEvents.map((e, i) => {
    const indent = '  '.repeat(i === 0 ? 0 : 1);
    const prefix = i === 0 ? '└─' : `${indent}└─`;
    const label = e.label ?? 'unknown';
    return `${prefix} CALL  ${label}`;
  }).join('\n');
}

// ── Args preview table ─────────────────────────────────────────────────────────

function ArgsTable({ args }: { args: Record<string, unknown> }) {
  const entries = Object.entries(args);
  if (entries.length === 0) return <p className="font-ds-mono text-[10px] text-ds-text-3">(no args)</p>;
  return (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="border-0 border-b border-solid border-ds-border/50">
          {['Key', 'Value'].map(h => (
            <th key={h} className="font-ds-mono text-[9px] text-ds-text-3 uppercase tracking-wider py-2 px-3">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k} className="border-0 border-b border-solid border-ds-border/20 hover:bg-ds-panel-2/50 transition-colors">
            <td className="py-2 px-3 font-ds-mono text-[10px] text-ds-green font-bold">{k}</td>
            <td className="py-2 px-3 font-ds-mono text-[10px] text-ds-text-2 break-all">{
              typeof v === 'object' ? JSON.stringify(v).slice(0, 120) : String(v).slice(0, 120)
            }</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Decoded Logs table ─────────────────────────────────────────────────────────

function LogsTab({ decodedEvents }: { decodedEvents: Record<string, unknown>[] }) {
  if (decodedEvents.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="font-ds-mono text-xs text-ds-text-3">No decoded events found for this tx hash.</p>
        <p className="font-ds-mono text-[10px] text-ds-text-3 mt-1">Logs appear after the indexer processes the transaction.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-0 border-b border-solid border-ds-border/50">
            {['#', 'Event', 'Args (decoded)', 'Contract'].map(h => (
              <th key={h} className="font-ds-mono text-[9px] text-ds-text-3 uppercase tracking-wider py-2 px-3 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {decodedEvents.map((ev, i) => {
            const name = ev.name as string | undefined;
            const args = ev.args as Record<string, unknown> | undefined;
            const contract = (ev.contractAddress ?? ev.contract) as string | undefined;
            const logIdx = ev.logIndex as number | undefined;
            return (
              <tr key={i} className="border-0 border-b border-solid border-ds-border/20 hover:bg-ds-panel-2/40 transition-colors">
                <td className="py-2 px-3 font-ds-mono text-[10px] text-ds-text-3">[{logIdx ?? i}]</td>
                <td className="py-2 px-3">
                  <span className="font-ds-mono text-[10px] text-ds-amber font-bold">{name ?? 'unknown'}</span>
                </td>
                <td className="py-2 px-3 max-w-[240px]">
                  <span className="font-ds-mono text-[9px] text-ds-text-3 truncate block max-w-full">
                    {args ? JSON.stringify(args).slice(0, 100) : '—'}
                  </span>
                </td>
                <td className="py-2 px-3">
                  {contract ? (
                    <a href={`/contract/${contract}`}
                      className="font-ds-mono text-[9px] text-ds-green hover:underline no-underline">
                      {truncateMiddle(contract, 6, 4)}
                    </a>
                  ) : <span className="font-ds-mono text-[10px] text-ds-text-3">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Related Alerts sidebar ─────────────────────────────────────────────────────

function AlertsPanel({ rules }: { rules: Record<string, unknown>[] }) {
  if (rules.length === 0) {
    return (
      <div className="py-10 text-center space-y-2">
        <p className="font-ds-mono text-xs text-ds-text-3">No active alert rules for this contract.</p>
        <a href="/dashboard/rules" className="font-ds-mono text-[10px] text-ds-green hover:underline no-underline">
          Create alert rule →
        </a>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {rules.map((r, i) => (
        <div key={i} className={`p-3 border-l-2 border-solid rounded-r-lg ${
          r.active ? 'border-ds-green bg-ds-green/5' : 'border-ds-border bg-ds-panel-2/30'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-ds-mono text-[10px] text-ds-amber font-bold">{r.event as string}</span>
            <span className={`font-ds-mono text-[9px] px-1.5 py-0.5 rounded-full border border-solid ${
              r.active ? 'text-ds-green border-ds-green/30' : 'text-ds-text-3 border-ds-border'
            }`}>
              {r.active ? 'ACTIVE' : 'PAUSED'}
            </span>
          </div>
          <p className="font-ds-mono text-[9px] text-ds-text-3">{r.channel as string} → {
            r.target ? (r.target as string).slice(0, 30) + '…' : '—'
          }</p>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TxExplorerClient({ txHash, stored, decodedEvents, relatedRules }: Props) {
  const tr = stored as unknown as StoredTrace | null;
  const [activeTab, setActiveTab] = useState<TabId>('timeline');
  const tablistRef = useRef<HTMLDivElement>(null);

  const handleTabKeyDown = useCallback((e: React.KeyboardEvent, idx: number) => {
    const tabs = TABS;
    let next = idx;
    if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    else return;
    e.preventDefault();
    setActiveTab(tabs[next].id);
    const el = tablistRef.current?.querySelectorAll('[role="tab"]')[next] as HTMLElement;
    el?.focus();
  }, []);

  const traceEvents = (tr?.trace?.events ?? []) as TraceEvent[];
  const callGraph   = buildCallTree(tr);

  return (
    <div className="space-y-0">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 font-ds-mono text-[10px] text-ds-text-3 mb-5">
        <a href="/explorer" className="hover:text-ds-green no-underline transition-colors">Explorer</a>
        <span aria-hidden>/</span>
        <span className="text-ds-text-2 truncate max-w-xs">{txHash}</span>
      </nav>

      {/* Hero status section */}
      <div className="bg-ds-panel border border-solid border-ds-border rounded-lg p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-5">
          <StatusBadge status={tr?.status} />
          <div className="flex-1 min-w-0">
            <p className="font-ds-mono text-base font-bold text-ds-text truncate">
              {tr?.method ?? 'unknown method'}
            </p>
          </div>
        </div>

        {/* Tx hash + contract row */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-ds-mono text-[9px] text-ds-text-3 uppercase tracking-wider w-16 shrink-0">Tx Hash</span>
            <code className="font-ds-mono text-xs text-ds-text-2 break-all">{txHash}</code>
            <CopyBtn text={txHash} />
          </div>
          {!!tr?.contractAddress && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-ds-mono text-[9px] text-ds-text-3 uppercase tracking-wider w-16 shrink-0">Contract</span>
              <a href={`/contract/${tr.contractAddress}`}
                className="font-ds-mono text-xs text-ds-green hover:underline no-underline break-all">
                {tr.contractAddress}
              </a>
            </div>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-0 border-t border-solid border-ds-border/40">
          {[
            { label: 'Block',    value: tr?.blockNumber ? `#${(tr.blockNumber as number).toLocaleString()}` : '—' },
            { label: 'Surface',  value: tr?.surface ?? 'evm' },
            { label: 'Duration', value: tr?.durationMs ? `${tr.durationMs}ms` : '—' },
            { label: 'Traced',   value: relTime(tr?.createdAt) },
          ].map(s => (
            <div key={s.label}>
              <p className="font-ds-mono text-[9px] text-ds-text-3 uppercase tracking-wider mb-0.5">{s.label}</p>
              <p className="font-ds-mono text-sm text-ds-text font-bold tabular-nums">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Call args (if decoded) */}
      {!!tr?.trace?.call?.args && Object.keys(tr.trace.call.args).length > 0 && (
        <div className="bg-ds-panel border border-solid border-ds-border rounded-lg overflow-hidden mb-6">
          <div className="px-4 py-3 border-0 border-b border-solid border-ds-border/50">
            <h2 className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-wider font-bold m-0">
              Call Args — {tr.trace.call.name ?? 'unknown'}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <ArgsTable args={tr.trace.call.args} />
          </div>
        </div>
      )}

      {/* Main tabs */}
      <div
        ref={tablistRef}
        role="tablist"
        aria-label="Transaction detail sections"
        className="flex overflow-x-auto gap-0 border-0 border-b border-solid border-ds-border no-scrollbar"
      >
        {TABS.map((tab, idx) => {
          const isActive = tab.id === activeTab;
          const badge =
            tab.id === 'logs'   && decodedEvents.length > 0 ? decodedEvents.length :
            tab.id === 'alerts' && relatedRules.length  > 0 ? relatedRules.length  :
            tab.id === 'timeline' && traceEvents.length > 0 ? traceEvents.length   : null;

          return (
            <button
              key={tab.id}
              role="tab"
              id={`tx-tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`tx-panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={e => handleTabKeyDown(e, idx)}
              className={`
                shrink-0 flex items-center gap-1.5 px-4 py-2.5 font-ds-mono text-[11px] font-bold
                border-0 border-b-2 border-solid bg-transparent cursor-pointer
                transition-all outline-none whitespace-nowrap
                focus-visible:ring-1 focus-visible:ring-ds-green
                ${isActive ? 'border-ds-green text-ds-green' : 'border-transparent text-ds-text-3 hover:text-ds-text-2'}
              `}
            >
              {tab.label}
              {badge !== null && (
                <span className={`font-ds-mono text-[8px] px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-ds-green/15 text-ds-green' : 'bg-ds-border text-ds-text-3'
                }`}>{badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab panels */}
      <div className="pt-6">

        {/* Timeline */}
        <div role="tabpanel" id="tx-panel-timeline" aria-labelledby="tx-tab-timeline" hidden={activeTab !== 'timeline'}>
          {traceEvents.length === 0 ? (
            <div className="py-12 text-center">
              <p className="font-ds-mono text-xs text-ds-text-3">No trace events recorded.</p>
              <p className="font-ds-mono text-[10px] text-ds-text-3 mt-1">
                This transaction may not have been indexed yet, or it is not an EVM contract call.
              </p>
            </div>
          ) : (
            <EventTimeline events={traceEvents} />
          )}
        </div>

        {/* Call Graph */}
        <div role="tabpanel" id="tx-panel-callgraph" aria-labelledby="tx-tab-callgraph" hidden={activeTab !== 'callgraph'}>
          <div className="bg-ds-shell border border-solid border-ds-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-0 border-b border-solid border-ds-border/50">
              <h2 className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-wider font-bold m-0">
                Call Graph (text tree)
              </h2>
              <span className="font-ds-mono text-[9px] text-ds-text-3">Depth: {traceEvents.filter(e => e.kind === 'call').length}</span>
            </div>
            <div className="p-4 overflow-x-auto">
              <pre className="font-ds-mono text-xs text-ds-text-2 leading-relaxed whitespace-pre m-0">{callGraph}</pre>
            </div>
            <div className="px-4 py-3 border-0 border-t border-solid border-ds-border/30 bg-ds-panel-2/30">
              <p className="font-ds-mono text-[9px] text-ds-text-3">
                Visual trace tree (React Flow) available in a future release.
              </p>
            </div>
          </div>
        </div>

        {/* Decoded Logs */}
        <div role="tabpanel" id="tx-panel-logs" aria-labelledby="tx-tab-logs" hidden={activeTab !== 'logs'}>
          <LogsTab decodedEvents={decodedEvents} />
        </div>

        {/* Raw JSON */}
        <div role="tabpanel" id="tx-panel-raw" aria-labelledby="tx-tab-raw" hidden={activeTab !== 'raw'}>
          {stored ? (
            <RawJsonViewer data={stored} initiallyExpanded={false} />
          ) : (
            <div className="py-12 text-center">
              <p className="font-ds-mono text-xs text-ds-text-3">No stored trace data for this transaction.</p>
            </div>
          )}
        </div>

        {/* Alerts */}
        <div role="tabpanel" id="tx-panel-alerts" aria-labelledby="tx-tab-alerts" hidden={activeTab !== 'alerts'}>
          <AlertsPanel rules={relatedRules} />
        </div>

      </div>
    </div>
  );
}
