'use client';
/**
 * ContractClient — Etapa 12
 * 8-tab a11y shell: Overview · Events · Calls · State · Alerts · ABI · Source · Raw
 * DS tokens, no @kryndel/core imports, mobile-first scrollable tabs.
 */
import * as React from 'react';
import { useState, useCallback, useRef } from 'react';
import { useActionState } from 'react';
import { watchEvent, type WatchState } from './actions';
import { ALERT_TEMPLATES } from '@/lib/alert-templates';
import { createAlertHref } from '@/lib/create-alert-link';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  address:       string;
  surface:       string;
  contractName:  string;
  firstSeenAt:   string | null;
  updatedAt:     string | null;
  contractAbi:   unknown[] | null;
  calls:         Record<string, unknown>[];
  events:        Record<string, unknown>[];
  totalCallsCount: number;
  eventNames:    string[];
  isAuthenticated: boolean;
  userHasContract: boolean;
  userId:        string | null;
  alertRules:    Record<string, unknown>[];
  rawContract:   Record<string, unknown>;
  actionButton:  React.ReactNode;
}

// ── Tab config ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview', label: 'Overview'  },
  { id: 'events',   label: 'Events'    },
  { id: 'calls',    label: 'Calls'     },
  { id: 'state',    label: 'State'     },
  { id: 'alerts',   label: 'Alerts'    },
  { id: 'abi',      label: 'ABI'       },
  { id: 'source',   label: 'Source'    },
  { id: 'raw',      label: 'Raw'       },
] as const;

type TabId = typeof TABS[number]['id'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncateMiddle(s: string, start = 6, end = 4): string {
  if (!s) return '—';
  if (s.length <= start + end + 3) return s;
  return `${s.slice(0, start)}…${s.slice(-end)}`;
}

function relTime(iso?: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 10_000) return 'just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { void navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="font-ds-mono text-[9px] text-ds-text-3 hover:text-ds-green bg-transparent border border-solid border-ds-border hover:border-ds-green/40 px-2 py-0.5 rounded transition-colors cursor-pointer ml-2 shrink-0"
      title="Copy address"
      aria-label="Copy address"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function SectionEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center py-16 text-center">
      <p className="font-ds-mono text-xs text-ds-text-3">{children}</p>
    </div>
  );
}

function ArgsPreview({ args }: { args: unknown }) {
  const s = JSON.stringify(args ?? {});
  return (
    <span className="font-ds-mono text-[9px] text-ds-text-3 truncate max-w-[180px] block">
      {s.length > 80 ? s.slice(0, 80) + '…' : s}
    </span>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({
  address, surface, contractName, firstSeenAt, updatedAt,
  calls, events, totalCallsCount, actionButton,
}: Pick<Props, 'address' | 'surface' | 'contractName' | 'firstSeenAt' | 'updatedAt' | 'calls' | 'events' | 'totalCallsCount' | 'actionButton'>) {
  const surfaceColor = surface === 'evm' ? 'text-ds-green' : 'text-ds-amber';

  return (
    <div className="space-y-6">
      {/* Address card */}
      <div className="bg-ds-panel-2 border border-solid border-ds-border rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <span className={`font-ds-mono text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full border border-solid ${
            surface === 'evm'
              ? 'text-ds-green border-ds-green/30 bg-ds-green/5'
              : 'text-ds-amber border-ds-amber/30 bg-ds-amber/5'
          }`}>
            {surface}
          </span>
          <div>{actionButton}</div>
        </div>

        <div className="space-y-1">
          {contractName && (
            <p className="font-ds-sans text-base font-semibold text-ds-text">{contractName}</p>
          )}
          <div className="flex items-center flex-wrap gap-1">
            <code className="font-ds-mono text-xs text-ds-text-2 break-all">{address}</code>
            <CopyButton text={address} />
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Events (50 latest)', value: String(events.length) },
          { label: 'Calls indexed',      value: totalCallsCount.toLocaleString() },
          { label: 'First seen',         value: relTime(firstSeenAt) },
          { label: 'Last active',        value: relTime(updatedAt) },
        ].map(s => (
          <div key={s.label} className="bg-ds-panel border border-solid border-ds-border rounded-lg p-4">
            <p className="font-ds-mono text-[9px] text-ds-text-3 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`font-ds-mono text-lg font-bold ${surfaceColor}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Recent events preview */}
      {events.slice(0, 5).length > 0 && (
        <div className="bg-ds-panel border border-solid border-ds-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-0 border-b border-solid border-ds-border/50">
            <h3 className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-wider font-bold m-0">Latest events</h3>
          </div>
          <div className="divide-y divide-ds-border/30">
            {events.slice(0, 5).map((ev, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2">
                <span className="font-ds-mono text-[10px] text-ds-amber font-bold w-24 truncate shrink-0">
                  {(ev.name as string) || 'unknown'}
                </span>
                {!!ev.txHash && (
                  <a href={`/dashboard/traces/${ev.txHash as string}`}
                    className="font-ds-mono text-[9px] text-ds-green hover:underline no-underline flex-1 truncate"
                  >
                    {truncateMiddle(ev.txHash as string, 8, 6)}
                  </a>
                )}
                <span className="font-ds-mono text-[9px] text-ds-text-3 shrink-0 tabular-nums">
                  {relTime(ev.indexedAt as string)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Events tab ────────────────────────────────────────────────────────────────

function EventsTab({ events, address }: { events: Record<string, unknown>[]; address: string }) {
  if (events.length === 0) {
    return <SectionEmpty>No events indexed yet for {truncateMiddle(address, 8, 6)}.</SectionEmpty>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-0 border-b border-solid border-ds-border/50">
            {['Event', 'Tx Hash', 'Args', 'Block / Ledger', 'Time'].map(h => (
              <th key={h} className="font-ds-mono text-[9px] text-ds-text-3 uppercase tracking-wider font-bold py-2 px-3 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map((ev, i) => {
            const hash = ev.txHash as string | undefined;
            return (
              <tr key={i} className="border-0 border-b border-solid border-ds-border/20 hover:bg-ds-panel-2/50 transition-colors">
                <td className="py-2 px-3">
                  <span className="font-ds-mono text-[10px] text-ds-amber font-bold">{(ev.name as string) || 'unknown'}</span>
                </td>
                <td className="py-2 px-3">
                  {hash
                    ? <a href={`/dashboard/traces/${hash}`} className="font-ds-mono text-[10px] text-ds-green hover:underline no-underline">{truncateMiddle(hash, 8, 6)}</a>
                    : <span className="font-ds-mono text-[10px] text-ds-text-3">—</span>
                  }
                </td>
                <td className="py-2 px-3 max-w-[200px]">
                  <ArgsPreview args={ev.args} />
                </td>
                <td className="py-2 px-3">
                  <span className="font-ds-mono text-[10px] text-ds-text-3 tabular-nums">
                    {(ev.ledgerOrBlock as number | undefined) ?? '—'}
                  </span>
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

// ── Calls tab ─────────────────────────────────────────────────────────────────

function CallsTab({ calls, address }: { calls: Record<string, unknown>[]; address: string }) {
  if (calls.length === 0) {
    return <SectionEmpty>No calls indexed yet for {truncateMiddle(address, 8, 6)}.</SectionEmpty>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-0 border-b border-solid border-ds-border/50">
            {['Function', 'Tx Hash', 'Args', 'Block / Ledger', 'Time'].map(h => (
              <th key={h} className="font-ds-mono text-[9px] text-ds-text-3 uppercase tracking-wider font-bold py-2 px-3 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {calls.map((c, i) => {
            const hash = c.txHash as string | undefined;
            return (
              <tr key={i} className="border-0 border-b border-solid border-ds-border/20 hover:bg-ds-panel-2/50 transition-colors">
                <td className="py-2 px-3">
                  <span className="font-ds-mono text-[10px] text-ds-green font-bold">{(c.name as string) || 'unknown'}</span>
                </td>
                <td className="py-2 px-3">
                  {hash
                    ? <a href={`/dashboard/traces/${hash}`} className="font-ds-mono text-[10px] text-ds-green hover:underline no-underline">{truncateMiddle(hash, 8, 6)}</a>
                    : <span className="font-ds-mono text-[10px] text-ds-text-3">—</span>
                  }
                </td>
                <td className="py-2 px-3 max-w-[200px]">
                  <ArgsPreview args={c.args} />
                </td>
                <td className="py-2 px-3">
                  <span className="font-ds-mono text-[10px] text-ds-text-3 tabular-nums">
                    {(c.ledgerOrBlock as number | undefined) ?? '—'}
                  </span>
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

// ── State tab ─────────────────────────────────────────────────────────────────

function StateTab() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <span className="font-ds-mono text-2xl" aria-hidden>⬡</span>
      <div>
        <p className="font-ds-mono text-sm text-ds-text-2 font-bold">State diff tracking</p>
        <p className="font-ds-mono text-xs text-ds-text-3 mt-1">Coming in a future release — storage slot reads & write diffs.</p>
      </div>
    </div>
  );
}

// ── Alerts tab ────────────────────────────────────────────────────────────────

function AlertTemplateLinks({ address, isAuthenticated }: { address: string; isAuthenticated: boolean }) {
  return (
    <div className="bg-ds-panel border border-solid border-ds-border rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-wider font-bold m-0">
            Create alert
          </h3>
          <p className="font-ds-mono text-[10px] text-ds-text-3 mt-1 mb-0">
            Open the rule builder with this contract prefilled.
          </p>
        </div>
        <a
          href={createAlertHref(address, isAuthenticated, 'any')}
          className="font-ds-mono text-xs bg-ds-green text-ds-shell font-bold px-4 py-2 rounded no-underline hover:opacity-90 transition-opacity"
        >
          Create alert →
        </a>
      </div>
      <div className="flex flex-wrap gap-2">
        {ALERT_TEMPLATES.map((template) => (
          <a
            key={template.id}
            href={createAlertHref(address, isAuthenticated, template.id)}
            title={template.blurb}
            className="font-ds-mono text-[10px] text-ds-text-2 border border-solid border-ds-border hover:border-ds-green hover:text-ds-green px-3 py-1.5 rounded no-underline transition-colors"
          >
            {template.label}
          </a>
        ))}
      </div>
    </div>
  );
}

function AlertsTab({
  address,
  eventNames,
  isAuthenticated,
  alertRules,
}: {
  address: string;
  eventNames: string[];
  isAuthenticated: boolean;
  alertRules: Record<string, unknown>[];
}) {
  const initial: WatchState = {};
  const [state, action, pending] = useActionState(watchEvent, initial);

  if (!isAuthenticated) {
    return (
      <div className="space-y-4">
        <AlertTemplateLinks address={address} isAuthenticated={false} />
        <p className="font-ds-mono text-xs text-ds-text-3 text-center">
          Sign in continues directly to the prefilled rule builder.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AlertTemplateLinks address={address} isAuthenticated />

      {/* Existing rules */}
      {alertRules.length > 0 ? (
        <div className="bg-ds-panel border border-solid border-ds-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-0 border-b border-solid border-ds-border/50">
            <h3 className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-wider font-bold m-0">
              Your rules for this contract
            </h3>
          </div>
          <div className="divide-y divide-ds-border/30">
            {alertRules.map((r, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <span className={`font-ds-mono text-[9px] uppercase font-bold px-2 py-0.5 rounded-full border border-solid ${
                  r.active ? 'text-ds-green border-ds-green/30 bg-ds-green/5' : 'text-ds-text-3 border-ds-border'
                }`}>
                  {r.active ? 'ACTIVE' : 'PAUSED'}
                </span>
                <span className="font-ds-mono text-[10px] text-ds-amber font-bold">{r.event as string}</span>
                <span className="font-ds-mono text-[10px] text-ds-text-3">{r.channel as string}</span>
                {!!r.target && (
                  <span className="font-ds-mono text-[9px] text-ds-text-3 truncate max-w-[160px]">{r.target as string}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="font-ds-mono text-xs text-ds-text-3">No alert rules yet for this contract.</p>
      )}

      {/* Create new rule */}
      <div className="bg-ds-panel border border-solid border-ds-border rounded-lg p-5 space-y-4">
        <h3 className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-wider font-bold m-0">
          Create alert rule
        </h3>
        <form action={action} className="space-y-4">
          <input type="hidden" name="contract" value={address} />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Event */}
            <div className="space-y-1.5">
              <label htmlFor="alert-event" className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-wider">
                Event
              </label>
              {eventNames.length > 0 ? (
                <select
                  id="alert-event"
                  name="event"
                  className="w-full bg-ds-shell border border-solid border-ds-border rounded px-3 py-2 font-ds-mono text-xs text-ds-text focus:outline-none focus:border-ds-green"
                >
                  {eventNames.map(n => <option key={n} value={n}>{n}</option>)}
                  <option value="">— custom —</option>
                </select>
              ) : (
                <input
                  id="alert-event"
                  name="event"
                  placeholder="Transfer or 0xabc123…"
                  maxLength={80}
                  className="w-full bg-ds-shell border border-solid border-ds-border rounded px-3 py-2 font-ds-mono text-xs text-ds-text focus:outline-none focus:border-ds-green placeholder:text-ds-text-3"
                />
              )}
            </div>

            {/* Channel */}
            <div className="space-y-1.5">
              <label htmlFor="alert-channel" className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-wider">
                Channel
              </label>
              <select
                id="alert-channel"
                name="channel"
                className="w-full bg-ds-shell border border-solid border-ds-border rounded px-3 py-2 font-ds-mono text-xs text-ds-text focus:outline-none focus:border-ds-green"
              >
                <option value="telegram">Telegram</option>
                <option value="discord">Discord</option>
                <option value="webhook">Webhook</option>
              </select>
            </div>

            {/* Target */}
            <div className="space-y-1.5">
              <label htmlFor="alert-target" className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-wider">
                Target
              </label>
              <input
                id="alert-target"
                name="target"
                placeholder="Chat ID or webhook URL"
                maxLength={256}
                autoComplete="off"
                className="w-full bg-ds-shell border border-solid border-ds-border rounded px-3 py-2 font-ds-mono text-xs text-ds-text focus:outline-none focus:border-ds-green placeholder:text-ds-text-3"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={pending}
            className="font-ds-mono text-xs bg-ds-green text-ds-shell font-bold px-5 py-2 rounded border-0 cursor-pointer hover:bg-ds-green/90 transition-colors disabled:opacity-50 disabled:cursor-wait"
          >
            {pending ? 'Saving…' : 'Watch →'}
          </button>

          {state.error && (
            <p className="font-ds-mono text-[10px] text-ds-red">
              {state.error === 'You must sign in to create alert rules.' ? (
                <span>
                  You must <a href={`/login?callbackUrl=${encodeURIComponent(`/contract/${address}`)}`} className="underline">sign in</a> to create alert rules.
                </span>
              ) : state.error}
            </p>
          )}
          {state.success && (
            <p className="font-ds-mono text-[10px] text-ds-green">✓ {state.success}</p>
          )}
        </form>
      </div>
    </div>
  );
}

// ── ABI tab ───────────────────────────────────────────────────────────────────

function AbiTab({
  address,
  contractAbi,
  isAuthenticated,
}: {
  address: string;
  contractAbi: unknown[] | null;
  isAuthenticated: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [uploadOk,  setUploadOk]  = useState(false);
  const [localAbi,  setLocalAbi]  = useState(contractAbi);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const raw = textareaRef.current?.value ?? '';
    setUploading(true); setUploadErr(null); setUploadOk(false);
    try {
      const res = await fetch(`/api/contracts/${address}/abi`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ abi: raw }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setUploadErr((d as Record<string, string>).error ?? 'Upload failed.');
      } else {
        setUploadOk(true);
        try { setLocalAbi(JSON.parse(raw)); } catch { /* keep old */ }
      }
    } catch {
      setUploadErr('Network error.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Show existing ABI */}
      {localAbi && Array.isArray(localAbi) && localAbi.length > 0 ? (
        <div className="bg-ds-panel border border-solid border-ds-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-0 border-b border-solid border-ds-border/50 flex items-center justify-between">
            <h3 className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-wider font-bold m-0">
              ABI — {localAbi.length} entries
            </h3>
            <span className="font-ds-mono text-[9px] text-ds-green">✓ Uploaded</span>
          </div>
          <div className="max-h-80 overflow-y-auto p-4">
            <pre className="font-ds-mono text-[10px] text-ds-text-2 whitespace-pre-wrap break-all m-0">
              {JSON.stringify(localAbi, null, 2)}
            </pre>
          </div>
        </div>
      ) : (
        <p className="font-ds-mono text-xs text-ds-text-3">No ABI uploaded for this contract.</p>
      )}

      {/* Upload form */}
      {isAuthenticated && (
        <div className="bg-ds-panel border border-solid border-ds-border rounded-lg p-5 space-y-3">
          <h3 className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-wider font-bold m-0">
            Upload / Replace ABI
          </h3>
          <p className="font-ds-mono text-[10px] text-ds-text-3">Paste a JSON ABI array. Max 500 entries / 100 KB.</p>
          <form onSubmit={handleUpload} className="space-y-3">
            <textarea
              ref={textareaRef}
              rows={8}
              placeholder='[{"type":"event","name":"Transfer","inputs":[...]}]'
              className="w-full bg-ds-shell border border-solid border-ds-border rounded px-3 py-2 font-ds-mono text-[10px] text-ds-text focus:outline-none focus:border-ds-green placeholder:text-ds-text-3 resize-y"
            />
            <button
              type="submit"
              disabled={uploading}
              className="font-ds-mono text-xs bg-ds-green text-ds-shell font-bold px-5 py-2 rounded border-0 cursor-pointer hover:bg-ds-green/90 transition-colors disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : 'Upload ABI'}
            </button>
            {uploadErr && <p className="font-ds-mono text-[10px] text-ds-red">{uploadErr}</p>}
            {uploadOk  && <p className="font-ds-mono text-[10px] text-ds-green">✓ ABI uploaded successfully.</p>}
          </form>
        </div>
      )}
    </div>
  );
}

// ── Source tab ────────────────────────────────────────────────────────────────

function SourceTab() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <span className="font-ds-mono text-2xl" aria-hidden>⬡</span>
      <div>
        <p className="font-ds-mono text-sm text-ds-text-2 font-bold">Source verification</p>
        <p className="font-ds-mono text-xs text-ds-text-3 mt-1">Contract source has not been verified.</p>
      </div>
    </div>
  );
}

// ── Raw tab ───────────────────────────────────────────────────────────────────

function RawTab({ rawContract }: { rawContract: Record<string, unknown> }) {
  const json = JSON.stringify(rawContract, null, 2);
  return (
    <div className="bg-ds-panel border border-solid border-ds-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-0 border-b border-solid border-ds-border/50 flex items-center justify-between">
        <h3 className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-wider font-bold m-0">
          Raw contract document
        </h3>
        <CopyButton text={json} />
      </div>
      <div className="max-h-[60vh] overflow-y-auto p-4">
        <pre className="font-ds-mono text-[10px] text-ds-text-2 whitespace-pre-wrap break-all m-0">{json}</pre>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ContractClient({
  address, surface, contractName, firstSeenAt, updatedAt,
  contractAbi, calls, events, totalCallsCount, eventNames,
  isAuthenticated, userHasContract, userId, alertRules,
  rawContract, actionButton,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // Keyboard: left/right arrow to switch tabs
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

  return (
    <div className="space-y-0">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 font-ds-mono text-[10px] text-ds-text-3 mb-4">
        <a href="/explorer" className="hover:text-ds-green no-underline transition-colors">Explorer</a>
        <span aria-hidden>/</span>
        <span className="text-ds-text-2 truncate max-w-[240px]">{address}</span>
      </nav>

      {/* Tab list — horizontally scrollable on mobile */}
      <div
        ref={tablistRef}
        role="tablist"
        aria-label="Contract sections"
        className="flex overflow-x-auto gap-0 border-0 border-b border-solid border-ds-border no-scrollbar"
      >
        {TABS.map((tab, idx) => {
          const isActive = tab.id === activeTab;
          // Badge counts
          const badge =
            tab.id === 'events' && events.length > 0 ? events.length :
            tab.id === 'calls'  && calls.length  > 0 ? calls.length  :
            tab.id === 'alerts' && alertRules.length > 0 ? alertRules.length :
            tab.id === 'abi'    && contractAbi   ? 1 : null;

          return (
            <button
              key={tab.id}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={e => handleTabKeyDown(e, idx)}
              className={`
                shrink-0 flex items-center gap-1.5 px-4 py-2.5 font-ds-mono text-[11px] font-bold
                border-0 border-b-2 border-solid bg-transparent cursor-pointer
                transition-all outline-none whitespace-nowrap
                focus-visible:ring-1 focus-visible:ring-ds-green
                ${isActive
                  ? 'border-ds-green text-ds-green'
                  : 'border-transparent text-ds-text-3 hover:text-ds-text-2'}
              `}
            >
              {tab.label}
              {badge !== null && (
                <span className={`font-ds-mono text-[8px] px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-ds-green/15 text-ds-green' : 'bg-ds-border text-ds-text-3'
                }`}>
                  {badge === 1 && tab.id === 'abi' ? '✓' : badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab panels */}
      {TABS.map(tab => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`panel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          hidden={tab.id !== activeTab}
          className="pt-6"
        >
          {tab.id === 'overview' && (
            <OverviewTab
              address={address} surface={surface} contractName={contractName}
              firstSeenAt={firstSeenAt} updatedAt={updatedAt}
              calls={calls} events={events} totalCallsCount={totalCallsCount}
              actionButton={actionButton}
            />
          )}
          {tab.id === 'events' && <EventsTab events={events} address={address} />}
          {tab.id === 'calls'  && <CallsTab  calls={calls}   address={address} />}
          {tab.id === 'state'  && <StateTab  />}
          {tab.id === 'alerts' && (
            <AlertsTab
              address={address} eventNames={eventNames}
              isAuthenticated={isAuthenticated} alertRules={alertRules}
            />
          )}
          {tab.id === 'abi' && (
            <AbiTab address={address} contractAbi={contractAbi} isAuthenticated={isAuthenticated} />
          )}
          {tab.id === 'source' && <SourceTab />}
          {tab.id === 'raw'    && <RawTab rawContract={rawContract} />}
        </div>
      ))}
    </div>
  );
}
