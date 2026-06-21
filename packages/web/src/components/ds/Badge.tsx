/**
 * Badge / StatusChip — Etapa 0 Primitivas DS
 *
 * StatusChip semáforo:
 *   ok      → verde  (#2bd96f)  — live, success, active
 *   warn    → amber  (#ffb020)  — drift, lag, pending
 *   fail    → rojo   (#ff4d4f)  — failed, down, error
 *   neutral → muted  (--ds-text-3) — unknown, inactive
 *
 * Badge genérico con variantes de color.
 */
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

/* ── Badge genérico ── */
const badgeVariants = cva(
  [
    'inline-flex items-center gap-1.5',
    'font-ds-mono text-[0.68rem] font-bold uppercase tracking-[0.06em]',
    'px-2 py-0.5 rounded-full border',
    'select-none whitespace-nowrap',
  ],
  {
    variants: {
      variant: {
        default:  'bg-ds-panel border-ds-border text-ds-text-2',
        green:    'bg-[rgba(43,217,111,.12)] border-[rgba(43,217,111,.25)] text-ds-green',
        amber:    'bg-[rgba(255,176,32,.12)]  border-[rgba(255,176,32,.25)]  text-ds-amber',
        red:      'bg-[rgba(255,77,79,.12)]   border-[rgba(255,77,79,.25)]   text-ds-red',
        outline:  'bg-transparent border-ds-border text-ds-text-3',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

/* ── StatusChip — semáforo operacional ── */
type StatusChipStatus = 'ok' | 'warn' | 'fail' | 'neutral';

const STATUS_CONFIG: Record<StatusChipStatus, { variant: BadgeProps['variant']; dot: string }> = {
  ok:      { variant: 'green',  dot: 'bg-ds-green' },
  warn:    { variant: 'amber',  dot: 'bg-ds-amber' },
  fail:    { variant: 'red',    dot: 'bg-ds-red'   },
  neutral: { variant: 'default', dot: 'bg-ds-text-3' },
};

interface StatusChipProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  status: StatusChipStatus;
  label?: string;
  /** Ocultar el punto indicador */
  noDot?: boolean;
}

function StatusChip({ status, label, noDot, className, ...props }: StatusChipProps) {
  const config = STATUS_CONFIG[status];
  const text = label ?? status.toUpperCase();
  return (
    <Badge variant={config.variant} className={className} {...props}>
      {!noDot && (
        <span
          className={cn('inline-block w-1.5 h-1.5 rounded-full shrink-0', config.dot)}
          aria-hidden="true"
        />
      )}
      {text}
    </Badge>
  );
}

export { Badge, badgeVariants, StatusChip };
export type { StatusChipStatus };
