'use client';

import * as React from 'react';
import { DataTable, cn } from '@/components/ds';
import { type ColumnDef } from '@tanstack/react-table';

interface WebhookDeliveriesTableProps {
  initialDeliveries: any[];
  endpointMap: Record<string, string>;
}

export function WebhookDeliveriesTable({
  initialDeliveries,
  endpointMap,
}: WebhookDeliveriesTableProps) {
  const columns = React.useMemo<ColumnDef<any>[]>(
    () => [
      {
        accessorKey: 'createdAt',
        header: 'Timestamp',
        size: 150,
        cell: (info) => {
          const val = info.getValue();
          if (!val) return '—';
          const date = new Date(val as string);
          // Format as HH:MM:SS.mmm
          const hrs = String(date.getHours()).padStart(2, '0');
          const mins = String(date.getMinutes()).padStart(2, '0');
          const secs = String(date.getSeconds()).padStart(2, '0');
          const ms = String(date.getMilliseconds()).padStart(3, '0');
          return <span className="font-ds-mono text-xs">{`${hrs}:${mins}:${secs}.${ms}`}</span>;
        },
      },
      {
        accessorKey: 'endpointId',
        header: 'Endpoint',
        size: 280,
        cell: (info) => {
          const id = info.getValue()?.toString();
          const url = id ? (endpointMap[id] ?? '—') : '—';
          return (
            <span className="truncate max-w-[260px] block font-ds-mono text-xs text-ds-text-2" title={url}>
              {url}
            </span>
          );
        },
      },
      {
        accessorKey: 'eventName',
        header: 'Event Type',
        size: 140,
        cell: (info) => (
          <span className="px-2 py-0.5 border border-solid border-ds-border bg-ds-panel-2 font-ds-mono text-[10px] rounded uppercase text-ds-text-2 select-all">
            {String(info.getValue() ?? '—')}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        size: 140,
        cell: (info) => {
          const row = info.row.original;
          const isSuccess = info.getValue() === 'success';
          const isRetrying = info.getValue() === 'retrying';
          const statusText = row.httpStatus
            ? `${row.httpStatus} ${isSuccess ? 'OK' : 'ERROR'}`
            : String(info.getValue()).toUpperCase();
          return (
            <span className="flex items-center gap-1.5 font-ds-mono text-xs">
              <span
                className={cn('w-1.5 h-1.5 rounded-full', {
                  'bg-ds-green shadow-[0_0_6px_rgba(43,217,111,0.5)]': isSuccess,
                  'bg-ds-amber shadow-[0_0_6px_rgba(255,176,32,0.5)]': isRetrying,
                  'bg-ds-red shadow-[0_0_6px_rgba(255,77,79,0.5)]': !isSuccess && !isRetrying,
                })}
              />
              <span
                className={cn({
                  'text-ds-green': isSuccess,
                  'text-ds-amber': isRetrying,
                  'text-ds-red': !isSuccess && !isRetrying,
                })}
              >
                {statusText}
              </span>
            </span>
          );
        },
      },
      {
        id: 'latency',
        header: 'Latency',
        size: 90,
        cell: () => <span className="font-ds-mono text-xs text-ds-text-3">—</span>,
      },
      {
        accessorKey: 'attempt',
        header: 'Retry',
        size: 80,
        cell: (info) => (
          <span className="font-ds-mono text-xs text-ds-text-2">
            {String(info.getValue() ?? 1)}/6
          </span>
        ),
      },
    ],
    [endpointMap]
  );

  return (
    <div className="bg-ds-panel border border-solid border-ds-border rounded-lg flex flex-col overflow-hidden h-full">
      <div className="flex justify-between items-center border-0 border-b border-solid border-ds-border px-5 py-3.5 select-none bg-ds-panel-2/10">
        <div className="flex items-center gap-2">
          <span className="font-ds-mono text-[10px] text-ds-text-3 font-bold uppercase tracking-widest">
            Recent Webhook Deliveries
          </span>
          <span className="text-[10px] text-ds-text-3 font-ds-mono">({initialDeliveries.length})</span>
        </div>
        <span className="text-[10px] text-ds-text-3 font-ds-mono">Avg: —</span>
      </div>
      <div className="p-4 overflow-y-auto max-h-[360px] custom-scrollbar flex-1">
        <DataTable
          columns={columns}
          data={initialDeliveries}
          loading={false}
          filterParamKey="w_q"
          emptyTitle="No webhook deliveries found"
          emptyDescription="Send some test events on-chain to trigger active webhook alert deliveries."
        />
      </div>
    </div>
  );
}
