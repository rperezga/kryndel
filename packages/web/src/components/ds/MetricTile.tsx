import * as React from 'react';
import { cn } from './cn';

export interface MetricTileProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  delta?: string | number;
  trend?: 'up' | 'down' | 'neutral';
  status?: 'ok' | 'warn' | 'fail' | 'neutral';
}

export function MetricTile({
  className,
  label,
  value,
  delta,
  trend,
  status = 'neutral',
  ...props
}: MetricTileProps) {
  // Map trend colors and indicators
  const statusColors = {
    ok: 'text-ds-green border-ds-green/20 bg-ds-green/5',
    warn: 'text-ds-amber border-ds-amber/20 bg-ds-amber/5',
    fail: 'text-ds-red border-ds-red/20 bg-ds-red/5',
    neutral: 'text-ds-text-3 border-ds-border bg-transparent',
  };

  const trendColors = {
    up: 'text-ds-green',
    down: 'text-ds-red',
    neutral: 'text-ds-text-3',
  };

  const trendSymbol = {
    up: '▲',
    down: '▼',
    neutral: '■',
  };

  return (
    <div
      className={cn(
        'bg-ds-panel border border-solid border-ds-border rounded-lg p-5 flex flex-col gap-2 relative overflow-hidden transition-all duration-150',
        'hover:border-ds-border-on shadow-[0_4px_12px_rgba(0,0,0,0.4)]',
        className
      )}
      {...props}
    >
      {/* Top section: Label + optional Status Dot */}
      <div className="flex justify-between items-center select-none">
        <span className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-widest">{label}</span>
        {status && status !== 'neutral' && (
          <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', {
            'bg-ds-green shadow-[0_0_6px_rgba(43,217,111,0.5)]': status === 'ok',
            'bg-ds-amber shadow-[0_0_6px_rgba(255,176,32,0.5)]': status === 'warn',
            'bg-ds-red shadow-[0_0_6px_rgba(255,77,79,0.5)]': status === 'fail',
          })} />
        )}
      </div>

      {/* Main section: Numeric/Text value */}
      <div className="flex items-baseline justify-between mt-1">
        <span className="font-ds-mono text-2xl font-bold text-ds-text tracking-tight tabular-nums select-all">
          {value}
        </span>

        {/* Delta change / trend */}
        {delta !== undefined && (
          <div className="flex items-center gap-1 font-ds-mono text-[10px] font-bold select-none">
            {trend && (
              <span className={cn(trendColors[trend])}>
                {trendSymbol[trend]}
              </span>
            )}
            <span className={cn(trend ? trendColors[trend] : 'text-ds-text-2')}>
              {delta}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
