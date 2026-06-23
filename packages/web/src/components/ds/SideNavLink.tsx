'use client';
/**
 * SideNavLink — a11y-aware nav link that sets aria-current="page" when active.
 * Used in (app)/layout.tsx sidebar + bottom-nav.
 * Etapa 14 — WCAG 2.4.4 Link Purpose + 4.1.3 Status Messages.
 */
import { usePathname } from 'next/navigation';
import * as React from 'react';

interface Props {
  href: string;
  children: React.ReactNode;
  className?: string;
  /** If true, only exact match triggers aria-current (default: prefix match) */
  exact?: boolean;
}

export function SideNavLink({ href, children, className = '', exact = false }: Props) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/') || pathname.startsWith(href + '?');

  return (
    <a
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={`${className} ${isActive ? 'text-ds-green bg-ds-panel-2' : ''}`}
    >
      {children}
    </a>
  );
}
