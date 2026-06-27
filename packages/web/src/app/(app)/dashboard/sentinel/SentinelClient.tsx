'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import type { IssuerSnapshot } from '@kryndel/core';
import { addIssuerAction, deleteIssuerAction, toggleIssuerActiveAction } from './actions';

interface IssuerRow {
  address: string;
  label: string;
  active: boolean;
  snapshot: IssuerSnapshot | null;
}

interface Props {
  issuers: IssuerRow[];
  maxIssuers: number;
  plan: string;
}

type Tone = 'default' | 'green' | 'red' | 'amber';

const PILL: Record<Tone, string> = {
  default: 'text-ds-text-2 border-ds-border bg-ds-panel',
  green: 'text-ds-green border-ds-green/40 bg-ds-green/5',
  red: 'text-ds-red border-ds-red/40 bg-ds-red/5',
  amber: 'text-ds-amber border-ds-amber/40 bg-ds-amber/5',
};

function verdictOf(snap: IssuerSnapshot | null): { label: string; tone: Tone } {
  if (!snap || !snap.exists) return { label: 'Unavailable', tone: 'default' };
  if (snap.flags.blackholed) return { label: 'Blackholed', tone: 'green' };
  if (snap.signals.some((s) => s.level === 'risk')) return { label: 'Needs attention', tone: 'red' };
  return { label: 'Active issuer', tone: 'amber' };
}

function Mini({ label, value, tone = 'default' }: { label: string; value: string; tone?: Tone }) {
  const colors: Record<Tone, string> = {
    default: 'text-ds-text',
    green: 'text-ds-green',
    red: 'text-ds-red',
    amber: 'text-ds-amber',
  };
  return (
    <div>
      <div className="font-ds-mono text-[9px] uppercase tracking-wider text-ds-text-3 font-bold">{label}</div>
      <div className={`font-ds-mono text-xs font-bold ${colors[tone]}`}>{value}</div>
    </div>
  );
}

export function SentinelClient({ issuers, maxIssuers, plan }: Props) {
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const atLimit = issuers.length >= maxIssuers;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await addIssuerAction(address, label);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(res.success ?? 'Added.');
        setAddress('');
        setLabel('');
        window.location.reload();
      }
    });
  };

  const handleDelete = (addr: string) => {
    if (!confirm('Stop watching this issuer?')) return;
    startTransition(async () => {
      await deleteIssuerAction(addr);
      window.location.reload();
    });
  };

  const handleToggle = (addr: string, next: boolean) => {
    startTransition(async () => {
      await toggleIssuerActiveAction(addr, next);
      window.location.reload();
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-0 border-b border-solid border-ds-border/50">
        <div className="space-y-1 select-none">
          <h1 className="font-ds-sans text-2xl font-bold tracking-tight text-ds-text m-0">Sentinel</h1>
          <p className="font-ds-mono text-xs text-ds-text-3 m-0">
            {plan.toUpperCase()} Plan · Watching {issuers.length} / {maxIssuers} XRPL issuer{maxIssuers === 1 ? '' : 's'} for security &amp; health changes
          </p>
        </div>
      </header>

      {/* Add issuer */}
      <form onSubmit={handleAdd} className="bg-ds-panel border border-solid border-ds-border rounded-lg p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-2">
          <input
            value={address}
            onChange={(e) => { setAddress(e.target.value); if (error) setError(null); }}
            placeholder="r… issuer account"
            spellCheck={false}
            className="flex-1 bg-ds-shell border border-solid border-ds-border rounded px-3 py-2.5 font-ds-mono text-xs text-ds-text focus:border-ds-green outline-none placeholder:text-ds-text-3"
          />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional)"
            className="md:w-52 bg-ds-shell border border-solid border-ds-border rounded px-3 py-2.5 font-ds-mono text-xs text-ds-text focus:border-ds-green outline-none placeholder:text-ds-text-3"
          />
          <button
            type="submit"
            disabled={isPending || atLimit}
            className="px-5 py-2.5 bg-ds-green text-ds-shell rounded font-ds-mono text-xs uppercase font-bold tracking-wider cursor-pointer outline-none hover:opacity-90 transition-opacity disabled:opacity-50 select-none"
          >
            {isPending ? 'Working…' : 'Watch issuer'}
          </button>
        </div>
        {atLimit && (
          <p className="font-ds-mono text-[11px] text-ds-amber m-0">
            You’ve reached your plan’s issuer limit. <Link href="/pricing" className="underline">Upgrade to Pro</Link> to watch more.
          </p>
        )}
        {error && <p className="font-ds-mono text-[11px] text-ds-red m-0">{error}</p>}
        {success && <p className="font-ds-mono text-[11px] text-ds-green m-0">{success}</p>}
      </form>

      {/* List */}
      {issuers.length === 0 ? (
        <div className="p-10 text-center border border-dashed border-ds-border rounded-lg space-y-2">
          <p className="font-ds-sans text-sm text-ds-text-2 m-0">No issuers watched yet.</p>
          <p className="font-ds-mono text-xs text-ds-text-3 m-0">
            Add a token issuer account above, or try the public tool at{' '}
            <Link href="/sentinel" className="text-ds-green hover:underline">/sentinel</Link>.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {issuers.map((it) => {
            const v = verdictOf(it.snapshot);
            const f = it.snapshot?.flags;
            const supplyCount = it.snapshot?.obligations.length ?? 0;
            return (
              <div key={it.address} className="bg-ds-panel border border-solid border-ds-border rounded-lg p-5 space-y-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-ds-sans text-sm font-bold text-ds-text">{it.label}</span>
                      <span className={`px-2 py-0.5 border border-solid rounded font-ds-mono text-[9px] uppercase font-bold select-none ${PILL[v.tone]}`}>
                        {v.label}
                      </span>
                      {!it.active && (
                        <span className="px-2 py-0.5 border border-solid border-ds-border rounded font-ds-mono text-[9px] uppercase font-bold text-ds-text-3 select-none">
                          Paused
                        </span>
                      )}
                    </div>
                    <div className="font-ds-mono text-[11px] text-ds-text-3 break-all">{it.address}</div>
                  </div>
                  <div className="flex items-center gap-2 select-none shrink-0">
                    <Link
                      href={`/sentinel/${it.address}`}
                      className="px-3 py-1.5 text-[11px] text-ds-text-2 hover:text-ds-green border border-solid border-ds-border rounded no-underline font-ds-mono"
                    >
                      Full report →
                    </Link>
                    <button
                      onClick={() => handleToggle(it.address, !it.active)}
                      disabled={isPending}
                      className="px-3 py-1.5 text-[11px] text-ds-text-2 hover:text-ds-green border border-solid border-ds-border rounded cursor-pointer outline-none font-ds-mono disabled:opacity-50"
                    >
                      {it.active ? 'Pause' : 'Resume'}
                    </button>
                    <button
                      onClick={() => handleDelete(it.address)}
                      disabled={isPending}
                      className="px-3 py-1.5 text-[11px] text-ds-red hover:bg-ds-red/10 border border-solid border-ds-border rounded cursor-pointer outline-none font-ds-mono disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {it.snapshot && it.snapshot.exists ? (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-3 border-0 border-t border-solid border-ds-border/40 pt-4">
                    <Mini label="Master key" value={f?.disableMaster ? 'Disabled' : 'Enabled'} tone={f?.disableMaster ? 'green' : 'red'} />
                    <Mini label="Freeze" value={f?.globalFreeze ? 'Global ON' : f?.noFreeze ? 'No-Freeze' : 'Possible'} tone={f?.globalFreeze ? 'red' : f?.noFreeze ? 'green' : 'default'} />
                    <Mini label="Clawback" value={f?.allowClawback ? 'Enabled' : 'No'} tone={f?.allowClawback ? 'red' : 'default'} />
                    <Mini label="Trustlines" value={it.snapshot.trustlines != null ? `${it.snapshot.trustlines.toLocaleString('en-US')}${it.snapshot.trustlinesTruncated ? '+' : ''}` : '—'} />
                    <Mini label="Currencies" value={supplyCount ? String(supplyCount) : '—'} />
                  </div>
                ) : (
                  <div className="font-ds-mono text-[11px] text-ds-text-3 border-0 border-t border-solid border-ds-border/40 pt-4">
                    Snapshot unavailable right now — Sentinel will retry. Open the full report to refresh.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
