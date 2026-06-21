/**
 * MobileMenu — Etapa 1: Chrome de marketing (móvil)
 *
 * MobileMenuButton: Client Component exportado al Server Component del Header.
 * MobileDrawer: menú deslizable lateral.
 * MobileBottomNav: barra de navegación fija en la parte inferior (mobile-only).
 *
 * Patrón de la referencia visual (group 1/landing_page_mobile):
 * - Header simplificado (logo + Sign in)
 * - Bottom nav persistente: Home | Explorer | Docs | Status
 * prefers-reduced-motion: sin animaciones de apertura.
 */
'use client';

import React, { useState, useEffect } from 'react';

const NAV_LINKS = [
  { label: 'Product',  href: '/#features' },
  { label: 'Explorer', href: '/explorer'   },
  { label: 'Docs',     href: '/docs'       },
  { label: 'Status',   href: '/status'     },
  { label: 'Pricing',  href: '/pricing'    },
] as const;

const BOTTOM_NAV = [
  {
    label: 'Home',
    href: '/',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
        <path d="M9 21V12h6v9"/>
      </svg>
    ),
  },
  {
    label: 'Explorer',
    href: '/explorer',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.35-4.35"/>
      </svg>
    ),
  },
  {
    label: 'Docs',
    href: '/docs',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <line x1="10" y1="9" x2="8" y2="9"/>
      </svg>
    ),
  },
  {
    label: 'Status',
    href: '/status',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
      </svg>
    ),
  },
] as const;

/* ── Hamburger button (rendered in Server Component header) ── */
export function MobileMenuButton() {
  const [open, setOpen] = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      {/* Hamburger button */}
      <button
        type="button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls="mobile-drawer"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center w-9 h-9 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-green"
        style={{ background: 'transparent', border: '1px solid var(--ds-border)', color: 'var(--ds-text-2)' }}
      >
        {open ? (
          /* X icon */
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          /* Hamburger */
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        )}
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(5,7,6,0.6)', backdropFilter: 'blur(4px)' }}
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <nav
        id="mobile-drawer"
        role="dialog"
        aria-label="Mobile navigation"
        aria-modal={open}
        className="fixed top-0 right-0 z-50 h-full w-72 flex flex-col motion-reduce:transition-none"
        style={{
          background: 'var(--ds-panel-2)',
          borderLeft: '1px solid var(--ds-border)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Drawer header */}
        <div
          className="flex items-center justify-between px-6 h-[62px] shrink-0"
          style={{ borderBottom: '1px solid var(--ds-border)' }}
        >
          <span
            className="font-ds-mono font-bold text-[18px]"
            style={{ color: 'var(--ds-green)' }}
          >
            kryndel<span style={{ color: 'var(--ds-text-3)', fontWeight: 400 }}>.dev</span>
          </span>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center w-8 h-8 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-green"
            style={{ color: 'var(--ds-text-3)', background: 'transparent', border: 'none' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Nav links */}
        <div className="flex-1 overflow-y-auto py-4">
          {NAV_LINKS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center px-6 py-3.5 text-sm font-medium no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-green focus-visible:rounded"
              style={{
                color: 'var(--ds-text-2)',
                textDecoration: 'none',
                fontFamily: 'var(--font-inter, system-ui, sans-serif)',
                borderBottom: '1px solid var(--ds-border)',
              }}
            >
              {label}
            </a>
          ))}
        </div>

        {/* CTAs */}
        <div className="px-6 pb-8 pt-4 flex flex-col gap-3 shrink-0">
          <a
            href="/login"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center h-10 rounded-[10px] text-sm font-semibold no-underline"
            style={{
              background: 'transparent',
              border: '1px solid var(--ds-border)',
              color: 'var(--ds-text-2)',
              textDecoration: 'none',
            }}
          >
            Sign in
          </a>
          <a
            href="/login"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center h-10 rounded-[10px] text-sm font-semibold no-underline"
            style={{
              background: 'var(--ds-green)',
              border: '1px solid var(--ds-green)',
              color: 'var(--ds-shell)',
              textDecoration: 'none',
              boxShadow: '0 0 0 1px rgba(43,217,111,.25)',
            }}
          >
            Start monitoring
          </a>
        </div>
      </nav>
    </>
  );
}

/* ── Bottom nav (mobile-only, rendered in marketing layout) ── */
export function MobileBottomNav() {
  // Only show on mobile via CSS
  return (
    <nav
      aria-label="Mobile bottom navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-20 flex items-stretch"
      style={{
        background: 'rgba(9, 13, 10, 0.95)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid var(--ds-border)',
        height: 60,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {BOTTOM_NAV.map(({ label, href, icon }) => (
        <a
          key={label}
          href={href}
          className="flex-1 flex flex-col items-center justify-center gap-1 no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-green focus-visible:ring-inset"
          style={{
            color: 'var(--ds-text-3)',
            textDecoration: 'none',
          }}
        >
          {icon}
          <span
            style={{
              fontSize: 10,
              fontFamily: 'var(--font-inter, system-ui, sans-serif)',
              fontWeight: 500,
              letterSpacing: '0.03em',
            }}
          >
            {label}
          </span>
        </a>
      ))}
    </nav>
  );
}
