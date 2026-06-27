'use client';

import * as React from 'react';
import { cn } from './cn';
import { LivePill, PhosphorPulse } from './LiveIndicator';
import { Button } from './Button';
import { AddressPill } from './AddressPill';
import { TxPill } from './TxPill';
import { useAddressLabel } from './AddressLabelProvider';

export interface StreamEvent {
  id: string;
  timestamp: string;
  type: string;
  description: string;
  address?: string;
  from?: string;
  to?: string;
  value?: string;
  hash?: string;
  status?: 'success' | 'reverted' | 'pending';
  isNew?: boolean; // triggers phosphor pulse
}

export interface EventStreamProps extends React.HTMLAttributes<HTMLDivElement> {
  events: StreamEvent[];
  maxHeight?: string;
}

// Compact magnitude for big uint values: 400000000000000000000 → 4e20
function fmtValue(v?: string): string {
  if (!v) return '';
  if (!/^\d+$/.test(v)) return v;
  if (v.length <= 9) return v;
  const exp = v.length - 1;
  const mant = (v[0] + '.' + v.slice(1, 3)).replace(/\.?0+$/, '');
  return `${mant}e${exp}`;
}

function shortAddr(a?: string): string {
  if (!a) return '';
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

/** A transfer party: shows its label (green) when known, else the short address. */
function PartyChip({ address }: { address?: string }) {
  const label = useAddressLabel(address ?? '');
  if (!address) return null;
  return (
    <span
      className="inline-flex items-center font-ds-mono text-[11px] max-w-[150px] truncate"
      title={address}
    >
      {label ? (
        <span className="text-ds-green font-semibold truncate">{label}</span>
      ) : (
        <span className="text-ds-text-2">{shortAddr(address)}</span>
      )}
    </span>
  );
}

/** One event row — uses the full card width across two balanced rows. */
function EventCard({ event }: { event: StreamEvent }) {
  const hasParties = !!(event.from && event.to);

  return (
    <PhosphorPulse active={!!event.isNew}>
      <div
        className={cn(
          'flex flex-col gap-2.5 bg-ds-shell border border-solid border-ds-border/60 rounded-md px-3.5 py-3 transition-colors duration-150 hover:bg-ds-panel-2/20',
          event.isNew ? 'border-ds-green/40' : ''
        )}
      >
        {/* Row 1 — type + contract (left) · timestamp (right) */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="font-ds-mono text-[10px] font-bold text-ds-green uppercase tracking-wide bg-ds-green/10 border border-solid border-ds-green/20 rounded px-1.5 py-0.5 shrink-0 select-none">
              {event.type}
            </span>
            {event.address && <AddressPill address={event.address} />}
          </div>
          <span className="font-ds-mono text-[10px] text-ds-text-3 shrink-0 select-none">
            {event.timestamp}
          </span>
        </div>

        {/* Row 2 — from → to + value (left) · tx (right) */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {hasParties ? (
              <>
                <span className="font-ds-mono text-[8px] uppercase tracking-widest text-ds-text-3 select-none shrink-0">from</span>
                <PartyChip address={event.from} />
                <span className="text-ds-text-3 shrink-0 px-0.5">→</span>
                <span className="font-ds-mono text-[8px] uppercase tracking-widest text-ds-text-3 select-none shrink-0">to</span>
                <PartyChip address={event.to} />
                {event.value && (
                  <span
                    className="font-ds-mono text-[11px] text-ds-text-3 ml-1.5 shrink-0"
                    title={event.value}
                  >
                    · {fmtValue(event.value)}
                  </span>
                )}
              </>
            ) : (
              event.description && (
                <p className="font-ds-sans text-xs text-ds-text-2 leading-relaxed truncate min-w-0">
                  {event.description}
                </p>
              )
            )}
          </div>
          {event.hash && <TxPill hash={event.hash} status={event.status} />}
        </div>
      </div>
    </PhosphorPulse>
  );
}

export function EventStream({
  className,
  events,
  maxHeight = '400px',
  ...props
}: EventStreamProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isAutoScrolling, setIsAutoScrolling] = React.useState(true);
  const [showResumeButton, setShowResumeButton] = React.useState(false);

  // Monitor scroll positioning to determine autoscroll freeze state
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;

    // In EventStream, newest items are prepended at the top (index 0).
    // If the user scrolls down (scrollTop > 10px), they are scrolling away from the latest live feed.
    const isAtTop = el.scrollTop <= 10;

    if (isAtTop) {
      setIsAutoScrolling(true);
      setShowResumeButton(false);
    } else {
      setIsAutoScrolling(false);
      setShowResumeButton(true);
    }
  };

  // Autoscroll to top (latest events) on updates if autoscroll is enabled
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || !isAutoScrolling) return;

    // Smoothly scroll back to top of the event stream list
    el.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }, [events, isAutoScrolling]);

  const handleResumeLive = () => {
    const el = containerRef.current;
    if (!el) return;

    el.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
    setIsAutoScrolling(true);
    setShowResumeButton(false);
  };

  return (
    <div
      className={cn(
        'relative bg-ds-panel border border-solid border-ds-border rounded-lg flex flex-col overflow-hidden font-ds-sans w-full',
        className
      )}
      {...props}
    >
      {/* Top Header: Title + Live Status Indicator */}
      <div className="flex justify-between items-center border-0 border-b border-solid border-ds-border px-5 py-3.5 select-none bg-ds-panel-2/10">
        <div className="flex items-center gap-2">
          <span className="font-ds-mono text-[10px] text-ds-text-3 font-bold uppercase tracking-widest">
            Event Stream
          </span>
          <span className="text-[10px] text-ds-text-3 font-ds-mono font-bold">({events.length})</span>
        </div>
        <LivePill />
      </div>

      {/* Scrolling Content viewport */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-2"
        style={{ maxHeight }}
      >
        {events.length === 0 && (
          <div className="text-center py-8 font-ds-mono text-[11px] text-ds-text-3 select-none">
            — no events yet —
          </div>
        )}

        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>

      {/* Floating "Resume live" button panel */}
      {showResumeButton && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 animate-fade-in select-none">
          <Button
            variant="primary"
            size="sm"
            onClick={handleResumeLive}
            className="flex items-center gap-2 px-4 shadow-[0_4px_16px_rgba(43,217,111,0.25)] border border-solid border-ds-green/30"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ds-shell opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-ds-shell"></span>
            </span>
            <span className="font-ds-mono text-[9px] font-bold uppercase tracking-wider">
              Resume live
            </span>
          </Button>
        </div>
      )}
    </div>
  );
}
