'use client';
/**
 * MobileEventCard — Etapa 13
 * Compact event row for mobile feed (colored left-bar accent, event name, args preview).
 * Used in Explorer home + dashboard event lists on narrow viewports.
 * Reference: group 3/mobile_ui_patterns/code.html — event cards section.
 */
import * as React from 'react';

export type EventSeverity = 'ok' | 'warn' | 'error' | 'info';

export interface MobileEventCardProps {
  eventName:       string;
  contractAddress: string;
  txHash?:         string;
  timestamp?:      string;
  /** Primary display value — e.g. decoded amount, from/to address */
  primaryValue?:   string;
  /** Secondary detail — e.g. "from → to" */
  secondaryValue?: string;
  severity?:       EventSeverity;
  /** If true, renders a pulsing green dot (live data) */
  isLive?:         boolean;
}

const SEVERITY_COLORS: Record<EventSeverity, { bar: string; dot: string; name: string }> = {
  ok:    { bar: 'bg-ds-green',  dot: 'bg-ds-green',  name: 'text-ds-green'  },
  warn:  { bar: 'bg-ds-amber',  dot: 'bg-ds-amber',  name: 'text-ds-amber'  },
  error: { bar: 'bg-ds-red',    dot: 'bg-ds-red',    name: 'text-ds-red'    },
  info:  { bar: 'bg-ds-text-3', dot: 'bg-ds-text-3', name: 'text-ds-text-2' },
};

function truncate(s: string, n = 8): string {
  if (!s) return '—';
  if (s.length <= n * 2 + 3) return s;
  return `${s.slice(0, n)}…${s.slice(-4)}`;
}

function relTime(iso?: string): string {
  if (!iso) return '';
  const d = Date.now() - new Date(iso).getTime();
  if (d < 60_000) return `${Math.floor(d / 1000)}s ago`;
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  return `${Math.floor(d / 3_600_000)}h ago`;
}

export function MobileEventCard({
  eventName,
  contractAddress,
  txHash,
  timestamp,
  primaryValue,
  secondaryValue,
  severity = 'ok',
  isLive   = false,
}: MobileEventCardProps) {
  const c = SEVERITY_COLORS[severity];
  const href = txHash ? `/explorer/tx/${txHash}` : `/contract/${contractAddress}`;

  return (
    <a
      href={href}
      className="flex items-stretch gap-0 rounded-lg overflow-hidden border border-solid border-ds-border bg-ds-panel hover:bg-ds-panel-2 active:scale-[0.98] transition-all no-underline"
      aria-label={`${eventName} event — ${primaryValue ?? ''}`}
    >
      {/* Colored left accent bar */}
      <div className={`w-1 shrink-0 ${c.bar}`} aria-hidden />

      {/* Content */}
      <div className="flex-1 min-w-0 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2 mb-1">
          {/* Event name + live dot */}
          <div className="flex items-center gap-1.5 min-w-0">
            {isLive && (
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 animate-ds-pulse ${c.dot}`} aria-hidden />
            )}
            <span className={`font-ds-mono text-[11px] font-bold truncate ${c.name}`}>{eventName}</span>
          </div>
          {timestamp && (
            <span className="font-ds-mono text-[9px] text-ds-text-3 shrink-0 whitespace-nowrap">
              {relTime(timestamp)}
            </span>
          )}
        </div>

        {/* Primary value — e.g. amount */}
        {primaryValue && (
          <p className="font-ds-mono text-xs text-ds-text font-bold truncate leading-tight">
            {primaryValue}
          </p>
        )}

        {/* Secondary — e.g. from/to */}
        {secondaryValue && (
          <p className="font-ds-mono text-[10px] text-ds-text-3 truncate mt-0.5">{secondaryValue}</p>
        )}

        {/* Contract link */}
        <p className="font-ds-mono text-[9px] text-ds-text-3 mt-1">
          {truncate(contractAddress, 6)}
        </p>
      </div>

      {/* Arrow indicator */}
      <div className="flex items-center pr-3 text-ds-text-3" aria-hidden>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M4.5 2.5L8.5 6l-4 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </a>
  );
}

// ── Push Notification Banner (mobile alert example) ───────────────────────────

export interface PushNotificationProps {
  title:    string;
  body:     string;
  severity?: EventSeverity;
  onAck?:   () => void;
  onView?:  () => void;
  onClose?: () => void;
}

/**
 * PushNotificationBanner — Example push-style overlay for mobile alerts.
 * Renders at top of screen. Caller is responsible for showing/hiding.
 * Reference: group 3/mobile_ui_patterns/code.html — push notification section.
 */
export function PushNotificationBanner({
  title,
  body,
  severity = 'warn',
  onAck,
  onView,
  onClose,
}: PushNotificationProps) {
  const c = SEVERITY_COLORS[severity];
  const borderColor =
    severity === 'error' ? 'border-ds-red/40' :
    severity === 'warn'  ? 'border-ds-amber/40' :
    severity === 'ok'    ? 'border-ds-green/40' :
    'border-ds-border';

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`fixed top-[calc(56px+8px)] left-3 right-3 z-[100] bg-ds-panel border border-solid ${borderColor} rounded-xl shadow-lg overflow-hidden`}
      style={{ boxShadow: '0 4px 32px rgba(0,0,0,0.6)' }}
    >
      {/* Top accent line */}
      <div className={`h-0.5 w-full ${c.bar}`} aria-hidden />

      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          {/* Severity dot */}
          <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${c.dot}`} aria-hidden />
          <div className="flex-1 min-w-0">
            <p className={`font-ds-mono text-xs font-bold ${c.name}`}>{title}</p>
            <p className="font-ds-mono text-[11px] text-ds-text-2 mt-0.5 line-clamp-2">{body}</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-ds-text-3 hover:text-ds-text-2 bg-transparent border-0 cursor-pointer text-sm leading-none p-0.5"
              aria-label="Dismiss notification"
            >
              ×
            </button>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 justify-end">
          {onAck && (
            <button
              onClick={onAck}
              className="font-ds-mono text-[10px] text-ds-text-3 border border-solid border-ds-border bg-transparent px-3 py-1.5 rounded cursor-pointer hover:border-ds-text-2 transition-colors"
            >
              ACK
            </button>
          )}
          {onView && (
            <button
              onClick={onView}
              className={`font-ds-mono text-[10px] font-bold ${c.name} border border-solid ${borderColor} bg-transparent px-3 py-1.5 rounded cursor-pointer hover:opacity-80 transition-opacity`}
            >
              VIEW TRACE
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
