'use client';
/**
 * AddressClient — Etapa 13
 * Address summary + tabs: Activity, Events, Calls, Contracts.
 * References: group 3/address_0xe4c3…1ea6/code.html
 */
import * as React from 'react';
import { useState, useCallback, useRef } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  address:          string;
  contract:         Record<string, unknown> | null;
  events:           Record<string, unknown>[];
  calls:            Record<string, unknown>[];
  traces:           Record<string, unknown>[];
  totalEventsCount: number;
}

// ── Tab config ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'activity',   label: 'Activity'   },
  { id: 'events',     label: 'Events'     },
  { id: 'calls',      label: 'Calls'      },
  { id: 'contracts',  label: 'Contracts'  },
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
      aria-label="Copy address"
    >
      {ok ? 'Copied!' : 'Copy'}
    </button>
  );
}

// ── Activity tab — combined events + calls + traces ────────────────────────────

function ActivityTab({
  events, calls, traces,
}: {
  events: Record<string, unknown>[];
  calls:  Record<string, unknown>[];
  traces: Record<string, unknown>[];
}) {
  // Merge and sort by time
  type Row = { type: 'event' | 'call' | 'trace'; time?: string; row: Record<string, unknown> };
  const rows: Row[] = [
    ...events.map(r => ({ type: 'event' as const, time: r.indexedAt as string, row: r })),
    ...calls.map(r  => ({ type: 'call'  as const, time: r.indexedAt as string, row: r })),
    ...traces.map(r => ({ type: 'trace' as const, time: r.createdAt as string, row: r })),
  ].sort((a, b) => {
    const ta = a.time ? new Date(a.time).getTime() : 0;
    const tb = b.time ? new Date(b.time).getTime() : 0;
    return tb - ta;
  }).slice(0, 40);

  if (rows.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="font-ds-mono text-xs text-ds-text-3">No activity indexed for this address.</p>
      </div>
    );
  }

  const typeColors: Record<string, string> = {
    event: 'bg-ds-amber/80',
    call:  'bg-ds-green/80',
    trace: 'bg-ds-text-3/60',
  };

  const typeLabels: Record<string, string> = {
    event: 'EVENT',
    call:  'CALL',
    trace: 'TRACE',
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-0 border-b border-solid border-ds-border/50">
            {['Tx Hash', 'Type', 'Name', 'Block', 'Age'].map(h => (
              <th key={h} className="font-ds-mono text-[9px] text-ds-text-3 uppercase tracking-wider py-2 px-3 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const hash = (r.row.txHash ?? r.row.transactionHash) as string | undefined;
            const name = (r.row.name ?? r.row.method) as string | undefined;
            const block = (r.row.ledgerOrBlock ?? r.row.blockNumber) as number | undefined;
            const status = r.row.status as string | undefined;

            return (
              <tr key={i} className="border-0 border-b border-solid border-ds-border/20 hover:bg-ds-panel-2/50 transition-colors cursor-pointer"
                onClick={() => hash && window.location.assign(`/explorer/tx/${hash}`)}>
                <td className="py-2 px-3">
                  {hash ? (
                    <a href={`/explorer/tx/${hash}`}
                      className="font-ds-mono text-[10px] text-ds-green hover:underline no-underline"
                      onClick={e => e.stopPropagation()}>
                      {truncateMiddle(hash, 6, 4)}
                    </a>
                  ) : <span className="font-ds-mono text-[10px] text-ds-text-3">—</span>}
                </td>
                <td className="py-2 px-3">
                  <span className={`font-ds-mono text-[8px] font-bold px-1.5 py-0.5 rounded text-ds-shell ${typeColors[r.type]}`}>
                    {typeLabels[r.type]}
                  </span>
                </td>
                <td className="py-2 px-3">
                  <span className={`font-ds-mono text-[10px] font-bold ${
                    r.type === 'event' ? 'text-ds-amber' : 'text-ds-green'
                  }`}>{name ?? '—'}</span>
                  {status && (
                    <span className={`ml-2 font-ds-mono text-[8px] ${status === 'success' ? 'text-ds-green' : 'text-ds-red'}`}>
                      {status === 'success' ? '✓' : '✗'}
                    </span>
                  )}
                </td>
                <td className="py-2 px-3 font-ds-mono text-[10px] text-ds-text-3 tabular-nums">
                  {block ? `#${block.toLocaleString()}` : '—'}
                </td>
                <td className="py-2 px-3 whitespace-nowrap">
                  <span className="font-ds-mono text-[9px] text-ds-text-3">{relTime(r.time)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Events tab ─────────────────────────────────────────────────────────────────

function EventsTab({ events }: { events: Record<string, unknown>[] }) {
  if (events.length === 0) return (
    <div className="py-12 text-center">
      <p className="font-ds-mono text-xs text-ds-text-3">No events indexed for this address.</p>
    </div>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-0 border-b border-solid border-ds-border/50">
            {['Event', 'Tx Hash', 'Args', 'Block', 'Age'].map(h => (
              <th key={h} className="font-ds-mono text-[9px] text-ds-text-3 uppercase tracking-wider py-2 px-3 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map((ev, i) => {
            const hash = (ev.txHash ?? ev.transactionHash) as string | undefined;
            const args = ev.args as Record<string, unknown> | undefined;
            return (
              <tr key={i} className="border-0 border-b border-solid border-ds-border/20 hover:bg-ds-panel-2/50 transition-colors">
                <td className="py-2 px-3">
                  <span className="font-ds-mono text-[10px] text-ds-amber font-bold">{ev.name as string ?? '—'}</span>
                </td>
                <td className="py-2 px-3">
                  {hash ? (
                    <a href={`/explorer/tx/${hash}`}
                      className="font-ds-mono text-[10px] text-ds-green hover:underline no-underline">
                      {truncateMiddle(hash, 6, 4)}
                    </a>
                  ) : <span className="font-ds-mono text-[10px] text-ds-text-3">—</span>}
                </td>
                <td className="py-2 px-3 max-w-[180px]">
                  <span className="font-ds-mono text-[9px] text-ds-text-3 truncate block max-w-full">
                    {args ? JSON.stringify(args).slice(0, 60) : '—'}
                  </span>
                </td>
                <td className="py-2 px-3 font-ds-mono text-[10px] text-ds-text-3 tabular-nums">
                  {ev.ledgerOrBlock ? `#${(ev.ledgerOrBlock as number).toLocaleString()}` : '—'}
                </td>
                <td className="py-2 px-3 whitespace-nowrap">
                  <span className="font-ds-mono text-[9px] text-ds-text-3">{relTime(ev.indexedAt as string)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Calls tab ──────────────────────────────────────────────────────────────────

function CallsTab({ calls }: { calls: Record<string, unknown>[] }) {
  if (calls.length === 0) return (
    <div className="py-12 text-center">
      <p className="font-ds-mono text-xs text-ds-text-3">No calls indexed for this address.</p>
    </div>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-0 border-b border-solid border-ds-border/50">
            {['Function', 'Tx Hash', 'Args', 'Block', 'Age'].map(h => (
              <th key={h} className="font-ds-mono text-[9px] text-ds-text-3 uppercase tracking-wider py-2 px-3 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {calls.map((c, i) => {
            const hash = c.txHash as string | undefined;
            const args = c.args as Record<string, unknown> | undefined;
            return (
              <tr key={i} className="border-0 border-b border-solid border-ds-border/20 hover:bg-ds-panel-2/50 transition-colors">
                <td className="py-2 px-3">
                  <span className="font-ds-mono text-[10px] text-ds-green font-bold">{c.name as string ?? '—'}</span>
                </td>
                <td className="py-2 px-3">
                  {hash ? (
                    <a href={`/explorer/tx/${hash}`}
                      className="font-ds-mono text-[10px] text-ds-green hover:underline no-underline">
                      {truncateMiddle(hash, 6, 4)}
                    </a>
                  ) : <span className="font-ds-mono text-[10px] text-ds-text-3">—</span>}
                </td>
                <td className="py-2 px-3 max-w-[180px]">
                  <span className="font-ds-mono text-[9px] text-ds-text-3 truncate block max-w-full">
                    {args ? JSON.stringify(args).slice(0, 60) : '—'}
                  </span>
                </td>
                <td className="py-2 px-3 font-ds-mono text-[10px] text-ds-text-3 tabular-nums">
                  {c.ledgerOrBlock ? `#${(c.ledgerOrBlock as number).toLocaleString()}` : '—'}
                </td>
                <td className="py-2 px-3 whitespace-nowrap">
                  <span className="font-ds-mono text-[9px] text-ds-text-3">{relTime(c.indexedAt as string)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Contracts tab ──────────────────────────────────────────────────────────────

function ContractsTab({ contract, address }: { contract: Record<string, unknown> | null; address: string }) {
  if (!contract) {
    return (
      <div className="py-12 text-center space-y-3">
        <p className="font-ds-mono text-xs text-ds-text-3">This address is not indexed as a contract in Kryndel.</p>
        <a href={`/contract/${address}`}
          className="inline-block font-ds-mono text-xs text-ds-green border border-solid border-ds-green/30 hover:bg-ds-green/5 px-4 py-2 rounded no-underline transition-colors">
          Open contract page →
        </a>
      </div>
    );
  }

  const surface = (contract.surface ?? 'evm') as string;
  const name    = (contract.name ?? contract.label ?? '') as string;
  const hasAbi  = !!(contract.abi && Array.isArray(contract.abi) && (contract.abi as unknown[]).length > 0);

  return (
    <div className="space-y-4">
      <div className="bg-ds-panel border border-solid border-ds-border rounded-lg p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            {name && <p className="font-ds-sans text-sm font-bold text-ds-text">{name}</p>}
            <span className={`font-ds-mono text-[9px] uppercase font-bold px-2 py-0.5 rounded-full border border-solid mt-1 inline-block ${
              surface === 'evm' ? 'text-ds-green border-ds-green/30 bg-ds-green/5' : 'text-ds-amber border-ds-amber/30 bg-ds-amber/5'
            }`}>{surface}</span>
          </div>
          <a href={`/contract/${address}`}
            className="font-ds-mono text-xs text-ds-green border border-solid border-ds-green/30 hover:bg-ds-green/5 px-3 py-1.5 rounded no-underline transition-colors">
            Open full contract page →
          </a>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'ABI', value: hasAbi ? `✓ ${(contract.abi as unknown[]).length} entries` : 'Not uploaded' },
            { label: 'First seen', value: relTime(contract.firstSeenAt as string) },
            { label: 'Last active', value: relTime(contract.updatedAt as string) },
          ].map(s => (
            <div key={s.label}>
              <p className="font-ds-mono text-[9px] text-ds-text-3 uppercase tracking-wider mb-0.5">{s.label}</p>
              <p className={`font-ds-mono text-sm ${hasAbi && s.label === 'ABI' ? 'text-ds-green' : 'text-ds-text-2'}`}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AddressClient({ address, contract, events, calls, traces, totalEventsCount }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('activity');
  const tablistRef = useRef<HTMLDivElement>(null);
  const isContract = !!contract;
  const surface    = (contract?.surface ?? 'evm') as string;

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

  return (
    <div className="space-y-0 max-w-5xl">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 font-ds-mono text-[10px] text-ds-text-3 mb-5">
        <a href="/explorer" className="hover:text-ds-green no-underline transition-colors">Explorer</a>
        <span>/</span>
        <span className="text-ds-text-2 truncate max-w-xs">{address}</span>
      </nav>

      {/* Address header */}
      <div className="bg-ds-panel border border-solid border-ds-border rounded-lg p-5 mb-6 relative overflow-hidden">
        {/* Faint bg icon */}
        <span className="absolute top-2 right-2 text-[80px] text-ds-text-3/5 pointer-events-none select-none" aria-hidden>⬡</span>

        <div className="relative">
          <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-ds-mono text-[9px] text-ds-text-3 uppercase tracking-wider">
                  {isContract ? 'Contract Address' : 'Active Address'}
                </span>
                {isContract && (
                  <span className={`font-ds-mono text-[9px] px-2 py-0.5 rounded-full border border-solid font-bold ${
                    surface === 'evm' ? 'text-ds-green border-ds-green/30 bg-ds-green/5' : 'text-ds-amber border-ds-amber/30 bg-ds-amber/5'
                  }`}>{surface.toUpperCase()}</span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-ds-mono text-sm sm:text-base font-bold text-ds-text break-all m-0">{address}</h1>
                <CopyBtn text={address} />
              </div>
            </div>

            {isContract && (
              <a href={`/contract/${address}`}
                className="font-ds-mono text-xs text-ds-green border border-solid border-ds-green/30 hover:bg-ds-green/10 px-3.5 py-1.5 rounded no-underline transition-colors flex items-center gap-2 shrink-0">
                <span aria-hidden>⬡</span> View Contract
              </a>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 border-0 border-t border-solid border-ds-border/40 pt-4">
            {[
              { label: 'Events indexed', value: totalEventsCount.toLocaleString(), color: 'text-ds-green' },
              { label: 'Calls indexed',  value: calls.length.toLocaleString(), color: 'text-ds-text-2' },
              { label: 'Traces cached', value: traces.length.toLocaleString(), color: 'text-ds-text-2' },
            ].map(s => (
              <div key={s.label} className="border-l-2 border-solid border-ds-border pl-3">
                <p className="font-ds-mono text-[9px] text-ds-text-3 uppercase tracking-wider mb-0.5">{s.label}</p>
                <p className={`font-ds-mono text-xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tab list */}
      <div
        ref={tablistRef}
        role="tablist"
        aria-label="Address sections"
        className="flex overflow-x-auto gap-0 border-0 border-b border-solid border-ds-border no-scrollbar"
      >
        {TABS.map((tab, idx) => {
          const isActive = tab.id === activeTab;
          const badge =
            tab.id === 'activity'  ? events.length + calls.length :
            tab.id === 'events'    ? events.length :
            tab.id === 'calls'     ? calls.length  :
            tab.id === 'contracts' && isContract ? 1 : null;

          return (
            <button
              key={tab.id}
              role="tab"
              id={`addr-tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`addr-panel-${tab.id}`}
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
              {badge !== null && badge !== 0 && (
                <span className={`font-ds-mono text-[8px] px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-ds-green/15 text-ds-green' : 'bg-ds-border text-ds-text-3'
                }`}>
                  {tab.id === 'contracts' ? '✓' : badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Panels */}
      <div className="pt-6">
        <div role="tabpanel" id="addr-panel-activity" aria-labelledby="addr-tab-activity" hidden={activeTab !== 'activity'}>
          <ActivityTab events={events} calls={calls} traces={traces} />
        </div>
        <div role="tabpanel" id="addr-panel-events" aria-labelledby="addr-tab-events" hidden={activeTab !== 'events'}>
          <EventsTab events={events} />
        </div>
        <div role="tabpanel" id="addr-panel-calls" aria-labelledby="addr-tab-calls" hidden={activeTab !== 'calls'}>
          <CallsTab calls={calls} />
        </div>
        <div role="tabpanel" id="addr-panel-contracts" aria-labelledby="addr-tab-contracts" hidden={activeTab !== 'contracts'}>
          <ContractsTab contract={contract} address={address} />
        </div>
      </div>
    </div>
  );
}
