'use client';

import * as React from 'react';
import { cn } from './cn';
import type { TraceEvent } from '@kryndel/core';

// ── Icons inline ─────────────────────────────────────────────────────────────

function CallIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" />
    </svg>
  );
}
function EventIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" /><path d="M3 12h3M18 12h3M12 3v3M12 18v3" />
    </svg>
  );
}
function EmitIcon({ success }: { success: boolean }) {
  return success ? (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ) : (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}
function StateIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
function AlertMatchIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

// ── Node config ───────────────────────────────────────────────────────────────

interface NodeConfig {
  iconColor: string;
  borderColor: string;
  badgeClass: string;
  icon: React.ReactNode;
}

function getNodeConfig(kind: string, label: string): NodeConfig {
  const isSuccess = label === 'tx_success';
  switch (kind) {
    case 'call':
      return {
        iconColor: 'text-ds-green',
        borderColor: 'border-ds-green/30',
        badgeClass: 'bg-ds-green/10 text-ds-green border-ds-green/20',
        icon: <CallIcon />,
      };
    case 'event':
      return {
        iconColor: 'text-ds-amber',
        borderColor: 'border-ds-amber/30',
        badgeClass: 'bg-ds-amber/10 text-ds-amber border-ds-amber/20',
        icon: <EventIcon />,
      };
    case 'emit':
      return isSuccess
        ? {
            iconColor: 'text-ds-green',
            borderColor: 'border-ds-green/30',
            badgeClass: 'bg-ds-green/10 text-ds-green border-ds-green/20',
            icon: <EmitIcon success />,
          }
        : {
            iconColor: 'text-ds-red',
            borderColor: 'border-ds-red/30',
            badgeClass: 'bg-ds-red/10 text-ds-red border-ds-red/20',
            icon: <EmitIcon success={false} />,
          };
    case 'state':
      return {
        iconColor: 'text-ds-text-2',
        borderColor: 'border-ds-text-2/20',
        badgeClass: 'bg-ds-panel-2 text-ds-text-2 border-ds-border',
        icon: <StateIcon />,
      };
    case 'alert_match':
      return {
        iconColor: 'text-ds-red',
        borderColor: 'border-ds-red/30',
        badgeClass: 'bg-ds-red/10 text-ds-red border-ds-red/20',
        icon: <AlertMatchIcon />,
      };
    default:
      return {
        iconColor: 'text-ds-text-2',
        borderColor: 'border-ds-border',
        badgeClass: 'bg-ds-panel text-ds-text-2 border-ds-border',
        icon: <EventIcon />,
      };
  }
}

// ── AlertMatch extra node type ────────────────────────────────────────────────

export interface AlertMatch {
  ruleId: string;
  ruleName: string;
  event: string;
  channel: string;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface EventTimelineProps extends React.HTMLAttributes<HTMLDivElement> {
  events: TraceEvent[];
  alertMatches?: AlertMatch[];
}

// ── DataRows ──────────────────────────────────────────────────────────────────

function DataRows({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return null;
  return (
    <dl className="mt-2 grid grid-cols-[minmax(80px,auto)_1fr] gap-x-4 gap-y-1">
      {entries.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-wide leading-5 whitespace-nowrap">{k}</dt>
          <dd className="font-ds-mono text-[11px] text-ds-text break-all leading-5">
            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
          </dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

// ── Combined event node ───────────────────────────────────────────────────────

interface TimelineNode {
  kind: string;
  label: string;
  t: number;
  data?: Record<string, unknown>;
}

// ── Main component ────────────────────────────────────────────────────────────

export function EventTimeline({ events, alertMatches = [], className, ...props }: EventTimelineProps) {
  const [expandedIdx, setExpandedIdx] = React.useState<number | null>(0);

  const nodes: TimelineNode[] = [
    ...events.map((e) => ({ kind: e.kind, label: e.label, t: e.t, data: e.data as Record<string, unknown> | undefined })),
    ...alertMatches.map((a, i) => ({
      kind: 'alert_match',
      label: a.ruleName,
      t: events.length + i,
      data: { event: a.event, channel: a.channel, ruleId: a.ruleId },
    })),
  ];

  return (
    <div className={cn('flex flex-col', className)} role="list" aria-label="Transaction trace timeline" {...props}>
      {nodes.map((node, idx) => {
        const cfg = getNodeConfig(node.kind, node.label);
        const isLast = idx === nodes.length - 1;
        const isExpanded = expandedIdx === idx;
        const hasData = node.data && Object.keys(node.data).length > 0;

        return (
          <div key={idx} className="relative flex gap-3" role="listitem">
            {/* Vertical connector line */}
            {!isLast && (
              <div
                className="absolute bg-ds-border"
                style={{ left: 15, top: 36, width: 1, bottom: -4 }}
                aria-hidden="true"
              />
            )}

            {/* Node icon */}
            <div className="flex-shrink-0" style={{ width: 32 }}>
              <button
                type="button"
                onClick={() => hasData && setExpandedIdx(isExpanded ? null : idx)}
                className={cn(
                  'w-8 h-8 rounded-full border-2 flex items-center justify-center z-10 mt-2 bg-ds-panel transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-green focus-visible:ring-offset-1 focus-visible:ring-offset-ds-shell',
                  cfg.borderColor, cfg.iconColor,
                  hasData ? 'cursor-pointer hover:bg-ds-panel-2' : 'cursor-default'
                )}
                aria-label={`${node.kind}: ${node.label}${hasData ? (isExpanded ? '. Click to collapse' : '. Click to expand') : ''}`}
                aria-expanded={hasData ? isExpanded : undefined}
                disabled={!hasData}
              >
                {cfg.icon}
              </button>
            </div>

            {/* Content card */}
            <div className="flex-1 min-w-0 py-2 pb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded border font-ds-mono text-[9px] uppercase tracking-widest font-bold leading-tight', cfg.badgeClass)}>
                  {node.kind === 'alert_match' ? 'alert' : node.kind}
                </span>
                <span className="font-ds-mono text-sm text-ds-text font-semibold truncate">
                  {node.label}
                </span>
                {hasData && (
                  <span className="ml-auto font-ds-mono text-[10px] text-ds-text-3 select-none" aria-hidden="true">
                    {isExpanded ? '▾' : '▸'}
                  </span>
                )}
              </div>

              {/* Expanded args */}
              {isExpanded && hasData && node.data && (
                <div className={cn('mt-2 rounded border p-3 bg-ds-shell', cfg.borderColor)}>
                  <DataRows data={node.data} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
