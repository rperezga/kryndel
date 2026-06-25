'use client';
/**
 * MobileBottomNav — 5-item bottom navigation (mobile only) with active-tab awareness.
 * Highlights the current tab in green (incl. the elevated Explorer center) based on the
 * current route, instead of hardcoding Explorer as always-active.
 */
import { usePathname } from 'next/navigation';
import * as React from 'react';

export function MobileBottomNav() {
  const pathname = usePathname() || '';

  const homeActive = pathname === '/dashboard';
  const alertsActive = pathname.startsWith('/dashboard/rules');
  const explorerActive = pathname.startsWith('/explorer') || pathname.startsWith('/contract');
  const contractsActive = pathname.startsWith('/dashboard/contracts');
  const moreActive = pathname.startsWith('/dashboard/settings');

  const base =
    'flex flex-col items-center justify-center py-2.5 px-2 min-w-0 flex-1 active:scale-95 transition-all no-underline gap-1';
  const color = (active: boolean) => (active ? 'text-ds-green' : 'text-ds-text-3 hover:text-ds-green');

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 left-0 w-full bg-ds-panel border-t border-solid border-ds-border flex justify-around items-stretch px-1 z-50 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Home */}
      <a href="/dashboard" aria-current={homeActive ? 'page' : undefined} className={`${base} ${color(homeActive)}`}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M3 9.5L10 3l7 6.5V17a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
          <path d="M7.5 18V13h5v5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
        <span className="font-ds-mono text-[8px] uppercase tracking-wider font-bold">Home</span>
      </a>

      {/* Alerts */}
      <a href="/dashboard/rules" aria-current={alertsActive ? 'page' : undefined} className={`${base} ${color(alertsActive)}`}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M10 2a6 6 0 016 6c0 3.3.9 5.5 1.7 6.5H2.3C3.1 13.5 4 11.3 4 8a6 6 0 016-6z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
          <path d="M8.3 16.5a1.7 1.7 0 003.4 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span className="font-ds-mono text-[8px] uppercase tracking-wider font-bold">Alerts</span>
      </a>

      {/* Explorer — center, elevated; green only when active */}
      <a
        href="/explorer"
        aria-current={explorerActive ? 'page' : undefined}
        className={`flex flex-col items-center justify-center py-2 px-3 min-w-0 flex-1 active:scale-95 transition-all no-underline gap-1 relative ${explorerActive ? 'text-ds-green' : 'text-ds-text-3 hover:text-ds-green'}`}
      >
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center -mt-4 border border-solid transition-colors ${
            explorerActive ? 'bg-ds-green/10 border-ds-green/30' : 'bg-ds-panel-2 border-ds-border'
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <span className="font-ds-mono text-[8px] uppercase tracking-wider font-bold">Explorer</span>
      </a>

      {/* Contracts */}
      <a href="/dashboard/contracts" aria-current={contractsActive ? 'page' : undefined} className={`${base} ${color(contractsActive)}`}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <path d="M6.5 7h7M6.5 10h7M6.5 13h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        <span className="font-ds-mono text-[8px] uppercase tracking-wider font-bold">Contracts</span>
      </a>

      {/* More — settings */}
      <a href="/dashboard/settings" aria-current={moreActive ? 'page' : undefined} className={`${base} ${color(moreActive)}`}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="5" cy="10" r="1.5" fill="currentColor" />
          <circle cx="10" cy="10" r="1.5" fill="currentColor" />
          <circle cx="15" cy="10" r="1.5" fill="currentColor" />
        </svg>
        <span className="font-ds-mono text-[8px] uppercase tracking-wider font-bold">More</span>
      </a>
    </nav>
  );
}
