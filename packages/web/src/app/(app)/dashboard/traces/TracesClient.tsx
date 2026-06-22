'use client';

import * as React from 'react';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable, TxPill, StatusChip, EmptyWorkbench, Button } from '@/components/ds';

export interface TraceRow {
  id: string;
  txHash: string;
  contractAddress: string;
  method: string;
  status: 'success' | 'reverted';
  blockNumber: number | null;
  surface: 'evm' | 'native';
  durationMs: number;
  createdAt: string | null;
}

interface TracesClientProps {
  traces: TraceRow[];
  contractNames: Record<string, string>;
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function truncateAddr(addr: string): string {
  if (!addr || addr === '—') return '—';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function TracesClient({ traces, contractNames }: TracesClientProps) {
  const router = useRouter();
  const [tracing, setTracing] = useState(false);
  const [hashInput, setHashInput] = useState('');
  const [traceError, setTraceError] = useState<string | null>(null);

  const handleTrace = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const hash = hashInput.trim();
    if (!hash) return;
    setTracing(true);
    setTraceError(null);
    try {
      const res = await fetch('/api/traces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash: hash }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Trace failed');
      router.push(`/dashboard/traces/${hash}`);
    } catch (err) {
      setTraceError(err instanceof Error ? err.message : 'Trace failed');
      setTracing(false);
    }
  }, [hashInput, router]);

  const columns: ColumnDef<TraceRow, any>[] = [
    {
      id: 'txHash',
      accessorKey: 'txHash',
      header: 'Tx Hash',
      size: 200,
      cell: ({ row }) => (
        <TxPill
          hash={row.original.txHash}
          status={row.original.status}
          explorerUrl={`/dashboard/traces/${row.original.txHash}`}
        />
      ),
    },
    {
      id: 'contract',
      accessorFn: (row) => contractNames[row.contractAddress?.toLowerCase()] ?? row.contractAddress,
      header: 'Contract',
      size: 160,
      cell: ({ row }) => {
        const name = contractNames[row.original.contractAddress?.toLowerCase()];
        return (
          <span className="font-ds-mono text-xs text-ds-text-2 truncate" title={row.original.contractAddress}>
            {name ?? truncateAddr(row.original.contractAddress)}
          </span>
        );
      },
    },
    {
      id: 'method',
      accessorKey: 'method',
      header: 'Method',
      size: 150,
      cell: ({ getValue }) => (
        <span className="font-ds-mono text-xs text-ds-amber">
          {String(getValue())}
        </span>
      ),
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: 'Status',
      size: 100,
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return (
          <StatusChip
            status={v === 'success' ? 'ok' : 'fail'}
            label={v === 'success' ? 'Success' : 'Reverted'}
          />
        );
      },
    },
    {
      id: 'blockNumber',
      accessorKey: 'blockNumber',
      header: 'Block',
      size: 100,
      cell: ({ getValue }) => {
        const v = getValue();
        return (
          <span className="font-ds-mono text-xs text-ds-text-3 tabular-nums">
            {v != null ? `#${Number(v).toLocaleString()}` : '—'}
          </span>
        );
      },
    },
    {
      id: 'createdAt',
      accessorKey: 'createdAt',
      header: 'Time',
      size: 100,
      cell: ({ getValue }) => (
        <span className="font-ds-mono text-xs text-ds-text-3">
          {formatRelativeTime(getValue() as string | null)}
        </span>
      ),
    },
    {
      id: 'action',
      header: '',
      size: 72,
      cell: ({ row }) => (
        <a
          href={`/dashboard/traces/${row.original.txHash}`}
          className="font-ds-mono text-[10px] text-ds-green hover:underline no-underline uppercase tracking-wide"
          aria-label={`View trace for ${row.original.txHash}`}
        >
          View →
        </a>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5 w-full max-w-full overflow-x-hidden">
      {/* Page header */}
      <div>
        <h1 className="font-ds-mono text-lg font-bold text-ds-text tracking-tight">Tx Traces</h1>
        <p className="font-ds-mono text-xs text-ds-text-3 mt-1">
          Decode and inspect EVM transactions — call, events, state diff, related alerts.
        </p>
      </div>

      {/* Trace input form — always single row, input grows */}
      <form
        onSubmit={handleTrace}
        className="flex flex-row gap-2 items-center w-full"
        aria-label="Trace a transaction"
      >
        <input
          type="text"
          value={hashInput}
          onChange={(e) => setHashInput(e.target.value)}
          placeholder="0x… paste EVM tx hash"
          className="flex-1 min-w-0 bg-ds-shell border border-solid border-ds-border rounded-lg py-2 px-3 font-ds-mono text-xs text-ds-text placeholder:text-ds-text-3 outline-none focus:border-ds-green transition-all"
          aria-label="Transaction hash to trace"
          disabled={tracing}
        />
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={tracing || !hashInput.trim()}
          aria-busy={tracing}
          className="flex-shrink-0"
        >
          {tracing ? '…' : 'Trace Tx'}
        </Button>
      </form>

      {/* Error feedback */}
      {traceError && (
        <div
          role="alert"
          className="flex items-start gap-2 px-4 py-3 rounded-lg border border-solid border-ds-red/30 bg-ds-red/5 font-ds-mono text-xs text-ds-red"
        >
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="break-all">{traceError}</span>
        </div>
      )}

      {/* Content: empty state OR table */}
      {traces.length === 0 ? (
        /* Empty state — full width, centered, no overflow */
        <div className="w-full flex justify-center px-0">
          <EmptyWorkbench
            title="No traces yet"
            description="Paste an EVM transaction hash above to decode it. Kryndel will decode the call, events, and state diff into a readable timeline."
            codeExample={`# Trace a tx via CLI\nkryndel trace --tx 0xYOUR_TX_HASH`}
            className="w-full max-w-lg"
          />
        </div>
      ) : (
        /* Table — horizontal scroll only when needed */
        <div className="w-full overflow-x-auto">
          <DataTable<TraceRow, any>
            columns={columns}
            data={traces}
            filterParamKey="q"
          />
        </div>
      )}
    </div>
  );
}
