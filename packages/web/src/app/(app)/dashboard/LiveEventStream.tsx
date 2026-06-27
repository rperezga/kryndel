'use client';

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { EventStream, type StreamEvent } from '@/components/ds';
import { resolveEventName } from '@/lib/event-display';

interface LiveEventStreamProps {
  initialEvents: any[];
}

function formatDbEvent(e: any): StreamEvent {
  const date = e.indexedAt ? new Date(e.indexedAt) : new Date();
  const timestamp = date.toTimeString().split(' ')[0];

  // Resolve raw topic0 hashes (legacy/undecoded rows) to a readable name.
  const evName = resolveEventName(e.name);

  // Structured transfer parties (Transfer: from/to/value · Approval: owner/spender)
  const args = e.args || {};
  const fromRaw = args.from ?? args.owner;
  const toRaw = args.to ?? args.spender;
  const valueRaw = args.value ?? args.amount;
  const fromStr = fromRaw != null ? String(fromRaw) : undefined;
  const toStr = toRaw != null ? String(toRaw) : undefined;
  const valueStr = valueRaw != null ? String(valueRaw) : undefined;

  let description = '';
  if (fromStr && toStr) {
    description = ''; // from → to rendered structurally by the card
  } else if (e.args && Object.keys(e.args).length > 0) {
    description = `${evName} with args: ${Object.entries(e.args)
      .slice(0, 3)
      .map(([k, v]) => `${k}=${String(v).slice(0, 15)}`)
      .join(', ')}`;
  } else {
    description = '';
  }

  return {
    id: e._id?.toString() || Math.random().toString(),
    timestamp,
    type: evName.toUpperCase(),
    description,
    address: e.contractAddress || e.contract,
    from: fromStr,
    to: toStr,
    value: valueStr,
    hash: e.txHash,
    status: 'success',
  };
}

export function LiveEventStream({ initialEvents }: LiveEventStreamProps) {
  const [events, setEvents] = useState<StreamEvent[]>(() =>
    initialEvents.map(formatDbEvent)
  );

  const seenIds = useRef<Set<string>>(
    new Set(initialEvents.map((e) => e._id?.toString()).filter(Boolean))
  );

  useEffect(() => {
    let active = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/dashboard/events');
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

          if (incoming.length === 0) return prev;

          const mergedMap = new Map<string, StreamEvent>();
          for (const ev of incoming) {
            mergedMap.set(ev.id, ev);
          }
          for (const ev of prev) {
            if (!mergedMap.has(ev.id)) {
              mergedMap.set(ev.id, { ...ev, isNew: false });
            }
          }

          return Array.from(mergedMap.values()).slice(0, 100);
        });
      } catch (err) {
        console.error('Error polling dashboard events:', err);
      }
    }, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return <EventStream events={events} maxHeight="360px" dense />;
}
