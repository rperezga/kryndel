/**
 * LiveIndicator — Etapa 0 Primitivas DS
 *
 * Dos variantes:
 *   LiveDot       — punto verde pulsante (LIVE)
 *   PhosphorPulse — borde animado "fósforo" sobre un elemento al recibir dato nuevo
 *
 * Animaciones desactivadas con prefers-reduced-motion (motion-reduce:* de Tailwind).
 */
'use client';

import * as React from 'react';
import { cn } from './cn';

/* ── LiveDot ── */
interface LiveDotProps {
  /** Texto accesible (sr-only) */
  label?: string;
  className?: string;
}

function LiveDot({ label = 'Live', className }: LiveDotProps) {
  return (
    <span
      className={cn('relative inline-flex items-center justify-center w-2.5 h-2.5', className)}
      role="status"
      aria-label={label}
    >
      {/* Ring pulsante — oculto con reduced motion */}
      <span
        className={cn(
          'absolute inline-flex h-full w-full rounded-full',
          'bg-ds-green opacity-60',
          'animate-ds-pulse motion-reduce:animate-none',
        )}
        aria-hidden="true"
      />
      {/* Punto sólido */}
      <span
        className="relative inline-flex w-2 h-2 rounded-full bg-ds-green shadow-[0_0_8px_rgba(43,217,111,0.7)]"
        aria-hidden="true"
      />
    </span>
  );
}

/* ── LivePill (dot + texto "LIVE") ── */
interface LivePillProps {
  className?: string;
}

function LivePill({ className }: LivePillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5',
        'font-ds-mono text-[0.68rem] font-bold uppercase tracking-[0.06em]',
        'px-2 py-0.5 rounded-full',
        'bg-[rgba(43,217,111,.1)] border border-[rgba(43,217,111,.25)] text-ds-green',
        className
      )}
      role="status"
      aria-label="Transmisión en vivo"
    >
      <LiveDot />
      LIVE
    </span>
  );
}

/* ── PhosphorPulse wrapper ── */
/**
 * Envuelve cualquier elemento. Cuando `active` cambia a true,
 * aplica el pulso de borde fósforo por ~600ms y luego lo quita.
 *
 * Uso: <PhosphorPulse active={newDataReceived}>...</PhosphorPulse>
 */
interface PhosphorPulseProps {
  active: boolean;
  className?: string;
  children: React.ReactNode;
}

function PhosphorPulse({ active, className, children }: PhosphorPulseProps) {
  const [pulsing, setPulsing] = React.useState(false);

  React.useEffect(() => {
    if (active) {
      setPulsing(true);
      const t = setTimeout(() => setPulsing(false), 700);
      return () => clearTimeout(t);
    }
  }, [active]);

  return (
    <div
      className={cn(
        'transition-[box-shadow] duration-300 motion-reduce:transition-none',
        pulsing && 'animate-ds-phosphor motion-reduce:animate-none',
        className
      )}
    >
      {children}
    </div>
  );
}

export { LiveDot, LivePill, PhosphorPulse };
