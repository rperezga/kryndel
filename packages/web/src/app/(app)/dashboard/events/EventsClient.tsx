'use client';

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  EventStream,
  type StreamEvent,
  BottomFilterSheet,
  EmptyWorkbench,
  Button
} from '@/components/ds';
import { resolveEventName } from '@/lib/event-display';

interface MappedContract {
  _id: string;
  address: string;
  name: string;
  surface: 'evm' | 'native';
  knownEvents: string[];
  hasAbi: boolean;
}

interface EventsClientProps {
  initialEvents: any[];
  contracts: MappedContract[];
  knownEventNames: string[];
}

function formatDbEvent(e: any): StreamEvent {
  const date = e.indexedAt ? new Date(e.indexedAt) : (e.createdAt ? new Date(e.createdAt) : new Date());
  // Let's include date if not today for a more descriptive timestamp
  const isToday = new Date().toDateString() === date.toDateString();
  const timeStr = date.toTimeString().split(' ')[0];
  const timestamp = isToday ? timeStr : `${date.toLocaleDateString()} ${timeStr}`;

  // Resolve raw topic0 hashes (legacy/undecoded rows) to a readable name.
  const evName = resolveEventName(e.name);

  let description = '';
  if (evName === 'Transfer' && e.args && (e.args.from || e.args.to)) {
    description = `Transfer of ${e.args.value || e.args.amount || 'units'} from ${String(e.args.from).slice(0, 8)}… to ${String(e.args.to).slice(0, 8)}…`;
  } else if (evName === 'Approval' && e.args) {
    description = `Approved spender ${String(e.args.spender).slice(0, 8)}… for ${e.args.value || e.args.amount || 'units'}`;
  } else if (e.args && Object.keys(e.args).length > 0) {
    description = `${evName} with args: ${Object.entries(e.args)
      .slice(0, 3)
      .map(([k, v]) => `${k}=${String(v).slice(0, 15)}`)
      .join(', ')}`;
  } else {
    description = `Event logs successfully processed on-chain.`;
  }

  // Map status
  let status: 'success' | 'reverted' | 'pending' = 'success';
  if (e.status === 'fail' || e.status === 'failed' || e.status === 'reverted') {
    status = 'reverted';
  } else if (e.status === 'pending') {
    status = 'pending';
  }

  return {
    id: e._id?.toString() || Math.random().toString(),
    timestamp,
    type: evName.toUpperCase(),
    description,
    address: e.contractAddress || e.contract,
    hash: e.txHash,
    status,
  };
}

export function EventsClient({ initialEvents, contracts, knownEventNames }: EventsClientProps) {
  const router = useRouter();

  // Filter States
  const [selectedContract, setSelectedContract] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedRange, setSelectedRange] = useState('all');

  // Stream States
  const [events, setEvents] = useState<StreamEvent[]>(() =>
    initialEvents.map(formatDbEvent)
  );

  const seenIds = useRef<Set<string>>(
    new Set(initialEvents.map((e) => e._id?.toString()).filter(Boolean))
  );

  // Poll for new events based on currently selected filters
  useEffect(() => {
    let active = true;

    const fetchFilteredEvents = async () => {
      try {
        const params = new URLSearchParams();
        if (selectedContract !== 'all') params.append('contract', selectedContract);
        if (selectedEvent !== 'all') params.append('event', selectedEvent);
        if (selectedStatus !== 'all') params.append('status', selectedStatus);
        if (selectedRange !== 'all') params.append('range', selectedRange);

        const res = await fetch(`/api/dashboard/events?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!active || !data.events) return;

        setEvents((prev) => {
          const incoming: StreamEvent[] = [];

          for (const raw of data.events) {
            const id = raw._id?.toString();
            if (!id) continue;

            const isNew = !seenIds.current.has(id);
            const formatted = formatDbEvent(raw);
            if (isNew) {
              formatted.isNew = true;
              seenIds.current.add(id);
            }
            incoming.push(formatted);
          }

          // If no events matched and we got nothing from DB, clear or keep prev
          if (incoming.length === 0 && data.events.length === 0) {
            return [];
          }

          // Merge keeping isNew state for new arrivals
          const mergedMap = new Map<string, StreamEvent>();
          for (const ev of incoming) {
            mergedMap.set(ev.id, ev);
          }
          for (const ev of prev) {
            if (!mergedMap.has(ev.id)) {
              mergedMap.set(ev.id, { ...ev, isNew: false });
            }
          }

          // Sort merged items by timestamp/ID descending to keep newest at the top
          return Array.from(mergedMap.values())
            .sort((a, b) => b.id.localeCompare(a.id))
            .slice(0, 100);
        });
      } catch (err) {
        console.error('Error fetching filtered events:', err);
      }
    };

    // Trigger immediate fetch when filters change
    void fetchFilteredEvents();

    const interval = setInterval(fetchFilteredEvents, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [selectedContract, selectedEvent, selectedStatus, selectedRange]);

  // Sync state if filters change (resetting seen IDs to allow highlighting on new filters)
  const handleClearFilters = () => {
    setSelectedContract('all');
    setSelectedEvent('all');
    setSelectedStatus('all');
    setSelectedRange('all');
  };

  const renderFiltersContent = () => (
    <div className="flex flex-col md:flex-row gap-4 w-full md:items-end select-none">
      {/* Contract Filter */}
      <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
        <label className="font-ds-mono text-[10px] text-ds-text-3 font-bold uppercase tracking-wider">
          Contract
        </label>
        <select
          value={selectedContract}
          onChange={(e) => setSelectedContract(e.target.value)}
          className="bg-ds-panel border border-solid border-ds-border rounded px-3 py-2 text-xs font-ds-mono text-ds-text outline-none focus:border-ds-green cursor-pointer h-9 w-full"
        >
          <option value="all">All Contracts</option>
          {contracts.map((c) => (
            <option key={c._id} value={c.address}>
              {c.name || 'Unnamed'} ({c.address.slice(0, 6)}…{c.address.slice(-4)}) [{c.surface.toUpperCase()}]
            </option>
          ))}
        </select>
      </div>

      {/* Event Name Filter */}
      <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
        <label className="font-ds-mono text-[10px] text-ds-text-3 font-bold uppercase tracking-wider">
          Event Name
        </label>
        <select
          value={selectedEvent}
          onChange={(e) => setSelectedEvent(e.target.value)}
          className="bg-ds-panel border border-solid border-ds-border rounded px-3 py-2 text-xs font-ds-mono text-ds-text outline-none focus:border-ds-green cursor-pointer h-9 w-full"
        >
          <option value="all">All Events</option>
          {knownEventNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {/* Status Filter */}
      <div className="flex flex-col gap-1.5 flex-1 min-w-[120px]">
        <label className="font-ds-mono text-[10px] text-ds-text-3 font-bold uppercase tracking-wider">
          Status
        </label>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="bg-ds-panel border border-solid border-ds-border rounded px-3 py-2 text-xs font-ds-mono text-ds-text outline-none focus:border-ds-green cursor-pointer h-9 w-full"
        >
          <option value="all">All Statuses</option>
          <option value="success">Success</option>
          <option value="reverted">Reverted</option>
        </select>
      </div>

      {/* Time Range Filter */}
      <div className="flex flex-col gap-1.5 flex-1 min-w-[120px]">
        <label className="font-ds-mono text-[10px] text-ds-text-3 font-bold uppercase tracking-wider">
          Time Range
        </label>
        <select
          value={selectedRange}
          onChange={(e) => setSelectedRange(e.target.value)}
          className="bg-ds-panel border border-solid border-ds-border rounded px-3 py-2 text-xs font-ds-mono text-ds-text outline-none focus:border-ds-green cursor-pointer h-9 w-full"
        >
          <option value="all">All Time</option>
          <option value="1h">Last Hour</option>
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
        </select>
      </div>

      {/* Clear Button */}
      {(selectedContract !== 'all' ||
        selectedEvent !== 'all' ||
        selectedStatus !== 'all' ||
        selectedRange !== 'all') && (
        <Button
          variant="secondary"
          size="sm"
          onClick={handleClearFilters}
          className="h-9 px-4 font-ds-mono text-[10px] uppercase tracking-wider"
        >
          Clear
        </Button>
      )}
    </div>
  );

  const activeFiltersCount =
    (selectedContract !== 'all' ? 1 : 0) +
    (selectedEvent !== 'all' ? 1 : 0) +
    (selectedStatus !== 'all' ? 1 : 0) +
    (selectedRange !== 'all' ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* ── Filters Section (Desktop vs Mobile) ── */}
      <div className="hidden md:block bg-ds-panel border border-solid border-ds-border rounded-lg p-5">
        {renderFiltersContent()}
      </div>

      <div className="md:hidden flex items-center justify-between bg-ds-panel border border-solid border-ds-border rounded-lg p-4 select-none">
        <div className="flex flex-col gap-0.5">
          <span className="font-ds-sans text-xs font-bold text-ds-text">Filter Stream</span>
          <span className="font-ds-mono text-[9px] text-ds-text-3 uppercase tracking-wider">
            {activeFiltersCount > 0
              ? `${activeFiltersCount} filter(s) active`
              : 'Streaming all activity'}
          </span>
        </div>
        <BottomFilterSheet
          title="Filter Events"
          description="Refine events stream by contract, name, status, or time boundaries."
          trigger={
            <Button
              variant="secondary"
              size="sm"
              className="flex items-center gap-1.5 px-3 font-ds-mono text-[10px] uppercase tracking-wider"
            >
              <span className="material-symbols-outlined text-[14px]">tune</span>
              Filters
            </Button>
          }
          onClear={handleClearFilters}
        >
          <div className="space-y-4 pt-2">
            {renderFiltersContent()}
          </div>
        </BottomFilterSheet>
      </div>

      {/* ── Stream Render ── */}
      {events.length === 0 ? (
        <div className="pt-8">
          <EmptyWorkbench
            title="No events found"
            description={
              activeFiltersCount > 0
                ? "No live database events match your selected filters. Try broadening your filter parameters."
                : "No events have been processed for your monitored contracts. Start the CLI watcher or verify contracts activity."
            }
            actionLabel="Go to Contracts"
            onActionClick={() => router.push('/dashboard/contracts')}
            codeExample="kryndel watch 0xe4c3ee653d7861cf236b2bea4bdb2a261231ea67"
          />
        </div>
      ) : (
        <EventStream events={events} maxHeight="620px" />
      )}
    </div>
  );
}
