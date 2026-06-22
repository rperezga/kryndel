'use client';

import * as React from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  EventTimeline,
  RawJsonViewer,
  TxPill,
  StatusChip,
  Button,
  AddressPill,
} from '@/components/ds';
import type { AlertMatch } from '@/components/ds';
import type { TraceEvent } from '@kryndel/core';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RelatedRule {
  id: string;
  event: string;
  channel: string;
  target: string;
  active: boolean;
}

interface StoredTrace {
  txHash: string;
  contractAddress: string;
  method: string;
  status: 'success' | 'reverted';
  blockNumber: number | null;
  surface: 'evm' | 'native';
  durationMs: number;
  createdAt: string;
  trace: {
    contract: { surface: string; address: string };
    call?: { name: string; args: Record<string, unknown>; raw?: string };
    events: TraceEvent[];
    emitted: unknown[];
    stateDiff: Array<{ key: string; before: unknown; after: unknown }>;
    txHash?: string;
    durationMs: number;
  };
}

interface TraceDetailClientProps {
  txHash: string;
  stored: StoredTrace | null;
  traceError: string | null;
  relatedRules: RelatedRule[];
  contractName: string | null;
}

// ── Tabs definition ───────────────────────────────────────────────────────────

type TabKey = 'trace' | 'events' | 'raw' | 'alerts';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'trace',  label: 'Trace'  },
  { key: 'events', label: 'Events' },
  { key: 'raw',    label: 'Raw'    },
  { key: 'alerts', label: 'Alerts' },
];

// ── Helper: format gas / value ────────────────────────────────────────────────

function formatWei(raw: unknown): string {
  if (raw == null) return '—';
  try {
    const n = BigInt(String(raw));
    if (n === 0n) return '0 ETH';
    // Show in ETH with 6 decimal places
    const eth = Number(n) / 1e18;
    return `${eth.toFixed(6)} XRP`;
  } catch {
    return String(raw);
  }
}

function truncateHash(h: string): string {
  if (!h) return '—';
  return `${h.slice(0, 10)}…${h.slice(-8)}`;
}

// ── Header status summary ─────────────────────────────────────────────────────

function StatusHeader({ stored, txHash }: { stored: StoredTrace; txHash: string }) {
  const { status, method, blockNumber, contractAddress, durationMs, createdAt } = stored;
  const call = stored.trace?.call;
  const fromAddr = call?.args?.from as string | undefined;
  const toAddr   = call?.args?.to   as string | undefined;
  const value    = call?.args?.value;
  const gasUsed  = stored.trace?.events.find((e) => e.kind === 'emit')?.data?.gasUsed;

  return (
    <div className="rounded-lg border border-solid border-ds-border bg-ds-panel p-4 flex flex-col gap-4">
      {/* Row 1: status chip + tx hash + share */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <StatusChip
            status={status === 'success' ? 'ok' : 'fail'}
            label={status === 'success' ? 'SUCCESS' : 'REVERTED'}
          />
          <TxPill hash={txHash} status={status} />
        </div>
        <a
          href="/dashboard/traces"
          className="font-ds-mono text-[10px] text-ds-text-3 hover:text-ds-green no-underline transition-colors flex-shrink-0"
          aria-label="Back to traces list"
        >
          ← All Traces
        </a>
      </div>

      {/* Row 2: meta fields grid */}
      <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-3">
        {method && (
          <div>
            <dt className="font-ds-mono text-[9px] text-ds-text-3 uppercase tracking-widest">Method</dt>
            <dd className="font-ds-mono text-sm text-ds-amber font-semibold mt-0.5 truncate">{method}</dd>
          </div>
        )}
        {contractAddress && (
          <div className="col-span-2 sm:col-span-1">
            <dt className="font-ds-mono text-[9px] text-ds-text-3 uppercase tracking-widest">Contract</dt>
            <dd className="mt-0.5">
              <AddressPill address={contractAddress} />
            </dd>
          </div>
        )}
        {fromAddr && (
          <div className="col-span-2 sm:col-span-1">
            <dt className="font-ds-mono text-[9px] text-ds-text-3 uppercase tracking-widest">From</dt>
            <dd className="mt-0.5">
              <AddressPill address={fromAddr} />
            </dd>
          </div>
        )}
        {toAddr && (
          <div className="col-span-2 sm:col-span-1">
            <dt className="font-ds-mono text-[9px] text-ds-text-3 uppercase tracking-widest">To</dt>
            <dd className="mt-0.5">
              <AddressPill address={toAddr} />
            </dd>
          </div>
        )}
        <div>
          <dt className="font-ds-mono text-[9px] text-ds-text-3 uppercase tracking-widest">Value</dt>
          <dd className="font-ds-mono text-sm text-ds-text font-semibold mt-0.5 tabular-nums">{formatWei(value)}</dd>
        </div>
        {gasUsed != null && (
          <div>
            <dt className="font-ds-mono text-[9px] text-ds-text-3 uppercase tracking-widest">Gas Used</dt>
            <dd className="font-ds-mono text-sm text-ds-text font-semibold mt-0.5 tabular-nums">
              {Number(gasUsed).toLocaleString()}
            </dd>
          </div>
        )}
        {blockNumber != null && (
          <div>
            <dt className="font-ds-mono text-[9px] text-ds-text-3 uppercase tracking-widest">Block</dt>
            <dd className="font-ds-mono text-sm text-ds-text font-semibold mt-0.5 tabular-nums">#{Number(blockNumber).toLocaleString()}</dd>
          </div>
        )}
        <div>
          <dt className="font-ds-mono text-[9px] text-ds-text-3 uppercase tracking-widest">Traced in</dt>
          <dd className="font-ds-mono text-sm text-ds-text-2 mt-0.5 tabular-nums">{durationMs}ms</dd>
        </div>
      </dl>
    </div>
  );
}

// ── Trace tab: timeline ───────────────────────────────────────────────────────

function TraceTab({ trace, relatedRules }: { trace: StoredTrace['trace']; relatedRules: RelatedRule[] }) {
  const alertMatches: AlertMatch[] = relatedRules
    .filter((r) => r.active)
    .map((r) => ({
      ruleId:   r.id,
      ruleName: `${r.event} → ${r.channel}`,
      event:    r.event,
      channel:  r.channel,
    }));

  return (
    <div className="flex flex-col gap-4">
      <p className="font-ds-mono text-xs text-ds-text-3">
        Call path decoded from EVM receipt. Click any node to expand args.
      </p>
      <EventTimeline
        events={trace.events as TraceEvent[]}
        alertMatches={alertMatches}
      />
    </div>
  );
}

// ── Events tab: decoded logs ──────────────────────────────────────────────────

function EventsTab({ trace }: { trace: StoredTrace['trace'] }) {
  const logEvents = (trace.events as TraceEvent[]).filter((e) => e.kind === 'event');

  if (logEvents.length === 0) {
    return (
      <p className="font-ds-mono text-xs text-ds-text-3 py-6 text-center">
        No decoded events in this transaction.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {logEvents.map((ev, idx) => (
        <div key={idx} className="rounded-lg border border-solid border-ds-border bg-ds-panel p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="font-ds-mono text-[9px] uppercase tracking-widest text-ds-amber bg-ds-amber/10 border border-ds-amber/20 px-1.5 py-0.5 rounded">
              event
            </span>
            <span className="font-ds-mono text-sm text-ds-text font-semibold">{ev.label}</span>
            <span className="ml-auto font-ds-mono text-[9px] text-ds-text-3 tabular-nums">#{idx}</span>
          </div>
          {ev.data && Object.keys(ev.data).length > 0 && (
            <dl className="grid grid-cols-[minmax(80px,auto)_1fr] gap-x-4 gap-y-1.5">
              {Object.entries(ev.data).map(([k, v]) => (
                <React.Fragment key={k}>
                  <dt className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-wide leading-5">{k}</dt>
                  <dd className="font-ds-mono text-xs text-ds-text break-all leading-5">
                    {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                  </dd>
                </React.Fragment>
              ))}
            </dl>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Raw tab ───────────────────────────────────────────────────────────────────

function RawTab({ trace }: { trace: StoredTrace['trace'] }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="font-ds-mono text-xs text-ds-text-3">
        Full decoded trace object. Expand nodes to inspect any field.
      </p>
      <RawJsonViewer data={trace} initiallyExpanded />
    </div>
  );
}

// ── Alerts tab ────────────────────────────────────────────────────────────────

function AlertsTab({ relatedRules, contractAddress }: { relatedRules: RelatedRule[]; contractAddress: string }) {
  if (relatedRules.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="font-ds-mono text-xs text-ds-text-3 mb-4">
          No alert rules configured for contract{' '}
          <span className="text-ds-text">{contractAddress.slice(0, 10)}…</span>
        </p>
        <a
          href="/dashboard/rules"
          className="font-ds-mono text-xs text-ds-green no-underline hover:underline"
        >
          Create an alert rule →
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-ds-mono text-xs text-ds-text-3">
        Alert rules configured for this contract that would match events in this trace.
      </p>
      {relatedRules.map((rule) => (
        <div key={rule.id} className="rounded-lg border border-solid border-ds-border bg-ds-panel p-4 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded border font-ds-mono text-[9px] uppercase tracking-widest font-bold ${rule.active ? 'bg-ds-green/10 text-ds-green border-ds-green/20' : 'bg-ds-border/30 text-ds-text-3 border-ds-border'}`}>
                {rule.active ? 'active' : 'paused'}
              </span>
              <span className="font-ds-mono text-sm text-ds-text font-semibold truncate">{rule.event}</span>
            </div>
            <p className="font-ds-mono text-xs text-ds-text-3">
              Channel: <span className="text-ds-text-2">{rule.channel}</span>
              {' · '}
              Target: <span className="text-ds-text-2 truncate">{rule.target}</span>
            </p>
          </div>
          <a
            href="/dashboard/rules"
            className="font-ds-mono text-[10px] text-ds-green no-underline hover:underline flex-shrink-0"
          >
            Edit →
          </a>
        </div>
      ))}
    </div>
  );
}

// ── Error state ───────────────────────────────────────────────────────────────

function TraceErrorView({ txHash, error }: { txHash: string; error: string }) {
  return (
    <div className="flex flex-col gap-6">
      {/* Back nav */}
      <a href="/dashboard/traces" className="font-ds-mono text-xs text-ds-text-3 hover:text-ds-green no-underline">← All Traces</a>

      <div className="rounded-lg border border-solid border-ds-red/30 bg-ds-red/5 p-6 flex flex-col items-center gap-4 text-center">
        <svg className="w-10 h-10 text-ds-red" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div>
          <p className="font-ds-mono text-sm font-bold text-ds-text mb-2">Trace Failed</p>
          <p className="font-ds-mono text-xs text-ds-text-3 mb-1">Hash: <span className="text-ds-text">{truncateHash(txHash)}</span></p>
          <p className="font-ds-mono text-xs text-ds-red mt-2 max-w-md">{error}</p>
        </div>
        <div className="flex gap-3 flex-wrap justify-center">
          <a href="/dashboard/traces" className="font-ds-mono text-xs border border-solid border-ds-border text-ds-text-2 px-4 py-2 rounded-lg hover:border-ds-green/40 hover:text-ds-green no-underline transition-colors">
            Back to list
          </a>
          <Button variant="primary" size="sm" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TraceDetailClient({
  txHash,
  stored,
  traceError,
  relatedRules,
  contractName,
}: TraceDetailClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('trace');

  // Error state
  if (traceError || !stored) {
    return <TraceErrorView txHash={txHash} error={traceError ?? 'Trace data unavailable'} />;
  }

  const { trace } = stored;
  const contractAddress = stored.contractAddress;

  return (
    <div className="flex flex-col gap-4 pb-32 md:pb-6">
      {/* Status header (desktop + mobile) */}
      <StatusHeader stored={stored} txHash={txHash} />

      {/* Mobile tabs — horizontal scrollable */}
      <nav
        className="flex gap-1 overflow-x-auto border-b border-solid border-ds-border pb-0 -mb-px scrollbar-none"
        aria-label="Trace detail tabs"
        role="tablist"
      >
        {TABS.map(({ key, label }) => {
          const count = key === 'alerts' ? relatedRules.length
                      : key === 'events' ? (trace.events as TraceEvent[]).filter((e) => e.kind === 'event').length
                      : null;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={activeTab === key}
              aria-controls={`tabpanel-${key}`}
              onClick={() => setActiveTab(key)}
              className={`flex-shrink-0 px-4 py-2.5 font-ds-mono text-xs uppercase tracking-wide transition-colors border-b-2 border-solid outline-none focus-visible:ring-2 focus-visible:ring-ds-green focus-visible:ring-offset-1 focus-visible:ring-offset-ds-shell ${
                activeTab === key
                  ? 'text-ds-green border-ds-green'
                  : 'text-ds-text-3 border-transparent hover:text-ds-text-2'
              }`}
            >
              {label}
              {count != null && count > 0 && (
                <span className="ml-1.5 font-ds-mono text-[9px] bg-ds-panel-2 border border-solid border-ds-border rounded-full px-1.5 py-0.5 tabular-nums">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Tab panels */}
      <div
        id={`tabpanel-${activeTab}`}
        role="tabpanel"
        aria-label={`${activeTab} panel`}
        className="min-h-[300px]"
      >
        {activeTab === 'trace'  && <TraceTab trace={trace} relatedRules={relatedRules} />}
        {activeTab === 'events' && <EventsTab trace={trace} />}
        {activeTab === 'raw'    && <RawTab trace={trace} />}
        {activeTab === 'alerts' && <AlertsTab relatedRules={relatedRules} contractAddress={contractAddress} />}
      </div>

      {/* Sticky mobile CTA — "Create alert" */}
      <div className="fixed bottom-[60px] left-0 right-0 px-4 pb-3 bg-gradient-to-t from-ds-shell via-ds-shell/90 to-transparent pt-8 z-40 md:hidden pointer-events-none">
        <div className="pointer-events-auto flex gap-2">
          <a
            href={`/dashboard/rules?contract=${contractAddress}`}
            className="flex-1 flex items-center justify-center gap-2 bg-ds-green text-ds-shell font-ds-mono text-xs font-bold uppercase tracking-wide py-3 rounded-lg no-underline hover:bg-ds-green/90 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-green focus-visible:ring-offset-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
              <line x1="12" y1="3" x2="12" y2="1" /><line x1="6.6" y1="4.6" x2="5.2" y2="3.2" />
            </svg>
            Create Alert
          </a>
        </div>
      </div>

      {/* Desktop CTA bar */}
      <div className="hidden md:flex items-center justify-between border-t border-solid border-ds-border pt-4 mt-2">
        <p className="font-ds-mono text-xs text-ds-text-3">
          {contractName ? (
            <>Contract: <span className="text-ds-text">{contractName}</span> · </>
          ) : null}
          Surface: <span className="text-ds-text">{stored.surface.toUpperCase()}</span>
          {' · '}
          Traced: <span className="text-ds-text">{stored.durationMs}ms</span>
        </p>
        <a
          href={`/dashboard/rules?contract=${contractAddress}`}
          className="font-ds-mono text-xs border border-solid border-ds-green text-ds-green px-4 py-2 rounded-lg hover:bg-ds-green/10 no-underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-green"
        >
          + Create Alert
        </a>
      </div>
    </div>
  );
}
