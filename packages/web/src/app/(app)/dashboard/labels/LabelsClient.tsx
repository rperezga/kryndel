'use client';

import * as React from 'react';
import { useState, useTransition } from 'react';
import { setAddressLabel, deleteAddressLabel } from './actions';

interface LabelRow {
  address: string;
  label: string;
  surface: 'evm' | 'native';
}

const inputCls =
  'w-full bg-ds-shell border border-solid border-ds-border rounded px-3 py-2.5 font-ds-mono text-sm text-ds-text placeholder:text-ds-text-3 outline-none focus:border-ds-green transition-colors';

function truncate(a: string): string {
  if (!a) return '';
  if (a.length <= 16) return a;
  return `${a.slice(0, 8)}…${a.slice(-6)}`;
}

export function LabelsClient({ initialLabels }: { initialLabels: LabelRow[] }) {
  const [rows, setRows] = useState<LabelRow[]>(initialLabels);
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const addr = address.trim();
    const lbl = label.trim();
    if (!addr || !lbl) {
      setError('Enter both an address and a label.');
      return;
    }
    startTransition(async () => {
      const res = await setAddressLabel(addr, lbl);
      if (res.error) {
        setError(res.error);
        return;
      }
      const key = addr.toLowerCase();
      setRows((prev) => [
        { address: key, label: lbl, surface: /^0x/.test(key) ? 'evm' : 'native' },
        ...prev.filter((r) => r.address.toLowerCase() !== key),
      ]);
      setAddress('');
      setLabel('');
    });
  };

  const handleDelete = (addr: string) => {
    const backup = rows;
    setRows((prev) => prev.filter((r) => r.address !== addr));
    startTransition(async () => {
      const res = await deleteAddressLabel(addr);
      if (res.error) {
        alert(res.error);
        setRows(backup);
      }
    });
  };

  return (
    <div className="max-w-3xl mx-auto w-full space-y-6">
      <div className="select-none">
        <h1 className="font-ds-sans text-2xl font-bold tracking-tight text-ds-text">Address Labels</h1>
        <p className="font-ds-mono text-xs text-ds-text-3 mt-1 leading-relaxed">
          Give addresses human names. They appear across events, alerts, traces and the explorer — so{' '}
          <span className="text-ds-text-2">0xDaC1b0…</span> reads as <span className="text-ds-green">Treasury</span>.
          The contracts you watch are labeled automatically.
        </p>
      </div>

      <form
        onSubmit={handleAdd}
        className="bg-ds-panel border border-solid border-ds-border rounded-lg p-5 flex flex-col sm:flex-row gap-3 sm:items-end"
      >
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <label htmlFor="addr" className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-widest font-bold">
            Address
          </label>
          <input
            id="addr"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x… or r…"
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <label htmlFor="lbl" className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-widest font-bold">
            Label
          </label>
          <input
            id="lbl"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={60}
            placeholder="e.g. Treasury"
            className={inputCls}
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2.5 bg-ds-green text-ds-shell font-ds-mono text-xs font-bold rounded hover:bg-ds-green/90 cursor-pointer border-0 transition-colors outline-none disabled:opacity-50 shrink-0"
        >
          {isPending ? 'Saving…' : 'Save label'}
        </button>
      </form>

      {error && (
        <div className="p-3 border border-solid border-ds-red/30 bg-ds-red/5 text-ds-red text-xs font-ds-mono rounded">
          {error}
        </div>
      )}

      <div className="bg-ds-panel border border-solid border-ds-border rounded-lg overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-8 text-center font-ds-mono text-xs text-ds-text-3 select-none">
            No address labels yet. Add one above.
          </div>
        ) : (
          <ul className="m-0 p-0 list-none">
            {rows.map((r) => (
              <li
                key={r.address}
                className="flex items-center gap-3 px-4 py-3 border-0 border-b border-solid border-ds-border/50 last:border-b-0"
              >
                <span className="font-ds-mono text-sm font-bold text-ds-green truncate min-w-0 flex-1">{r.label}</span>
                <span className="font-ds-mono text-xs text-ds-text-3 shrink-0" title={r.address}>
                  {truncate(r.address)}
                </span>
                <span className="bg-ds-panel-2 border border-solid border-ds-border px-2 py-0.5 font-ds-mono text-[10px] text-ds-text-2 rounded uppercase select-none shrink-0">
                  {r.surface === 'evm' ? 'EVM' : 'XLS-0101'}
                </span>
                <button
                  onClick={() => handleDelete(r.address)}
                  className="p-1 text-ds-text-3 hover:text-ds-red bg-transparent border-0 cursor-pointer transition-colors flex items-center outline-none shrink-0"
                  title="Remove label"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
