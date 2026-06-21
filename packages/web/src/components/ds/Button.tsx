/**
 * Button — Etapa 0 Primitivas DS
 *
 * Variantes: primary | secondary | ghost
 * Tamaños: sm | md | lg
 * a11y: :focus-visible nativo, prefers-reduced-motion via CSS
 */
'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

const buttonVariants = cva(
  // Base — aplica a todas las variantes
  [
    'inline-flex items-center justify-center gap-2',
    'font-ds-sans font-semibold text-sm',
    'rounded-[10px] border transition-[filter,opacity,border-color,box-shadow]',
    'duration-150 cursor-pointer select-none whitespace-nowrap',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-green focus-visible:ring-offset-2 focus-visible:ring-offset-ds-shell',
    'disabled:opacity-40 disabled:pointer-events-none',
    // prefers-reduced-motion: sin transiciones
    'motion-reduce:transition-none',
  ],
  {
    variants: {
      variant: {
        primary: [
          'bg-ds-green text-ds-shell border-ds-green',
          'shadow-[0_0_0_1px_rgba(43,217,111,.25),0_0_20px_rgba(43,217,111,.15)]',
          'hover:brightness-110',
          'active:brightness-95',
        ],
        secondary: [
          'bg-ds-panel text-ds-text border-ds-border',
          'hover:border-[rgba(43,217,111,.3)] hover:text-white',
          'active:bg-ds-panel-2',
        ],
        ghost: [
          'bg-transparent text-ds-text-2 border-transparent',
          'hover:text-ds-text hover:bg-ds-panel',
          'active:bg-ds-panel-2',
        ],
      },
      size: {
        sm: 'h-7 px-3 text-xs',
        md: 'h-9 px-4 text-sm',
        lg: 'h-11 px-6 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Renderiza el hijo directamente en lugar de un <button> (composición) */
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
