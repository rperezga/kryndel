/**
 * Card / Panel — Etapa 0 Primitivas DS
 *
 * Card: contenedor base con borde y fondo --ds-panel
 * Panel: variante elevada (--ds-panel-2) para diálogos / overlays
 * CardHeader, CardContent, CardFooter: semántica interna
 */
import * as React from 'react';
import { cn } from './cn';

/* ── Card ── */
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl border border-ds-border bg-ds-panel',
        'transition-[border-color,box-shadow] duration-200',
        'motion-reduce:transition-none',
        className
      )}
      {...props}
    />
  )
);
Card.displayName = 'Card';

/* ── Panel (elevado) ── */
const Panel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl border border-ds-border bg-ds-panel-2',
        'transition-[border-color,box-shadow] duration-200',
        'motion-reduce:transition-none',
        className
      )}
      {...props}
    />
  )
);
Panel.displayName = 'Panel';

/* ── Sub-componentes ── */
const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col gap-1.5 p-6 border-b border-ds-border', className)}
      {...props}
    />
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-ds-text font-semibold text-base leading-snug', className)}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('text-ds-text-2 text-sm', className)}
      {...props}
    />
  )
);
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center p-6 pt-0 border-t border-ds-border', className)}
      {...props}
    />
  )
);
CardFooter.displayName = 'CardFooter';

export {
  Card,
  Panel,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
};
