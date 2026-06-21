/**
 * Pill — Etapa 0 Primitivas DS
 *
 * Tag/etiqueta redondeada para datos secundarios:
 *   chain, network, version, fee tier, etc.
 *
 * Diferencia con Badge: más grande, no en mayúsculas, tipografía mixta.
 */
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

const pillVariants = cva(
  [
    'inline-flex items-center gap-1.5',
    'text-xs font-medium',
    'px-2.5 py-1 rounded-full border',
    'select-none whitespace-nowrap',
  ],
  {
    variants: {
      variant: {
        default: 'bg-ds-panel border-ds-border text-ds-text-2',
        green:   'bg-[rgba(43,217,111,.1)] border-[rgba(43,217,111,.2)] text-ds-green',
        amber:   'bg-[rgba(255,176,32,.1)]  border-[rgba(255,176,32,.2)]  text-ds-amber',
        red:     'bg-[rgba(255,77,79,.1)]   border-[rgba(255,77,79,.2)]   text-ds-red',
        mono:    'bg-ds-panel border-ds-border text-ds-text font-ds-mono text-[0.72rem]',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface PillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof pillVariants> {}

function Pill({ className, variant, ...props }: PillProps) {
  return (
    <span className={cn(pillVariants({ variant }), className)} {...props} />
  );
}

export { Pill, pillVariants };
