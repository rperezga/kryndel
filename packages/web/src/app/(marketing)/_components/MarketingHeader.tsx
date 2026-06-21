/**
 * MarketingHeader — Etapa 1: Chrome de marketing
 *
 * Server Component: reads session from NextAuth, renders auth-aware CTAs.
 * Desktop: sticky + blur, logo, nav links, Sign in + Start monitoring.
 * Mobile: logo + Sign in only (MobileMenu handles hamburger + bottom nav).
 *
 * Tokens: --ds-* (Etapa 0). Classes: Tailwind utility (no mkt-* legacy).
 */
import { auth } from '@/auth';
import { MobileMenuButton } from './MobileMenu';

const NAV_LINKS = [
  { label: 'Product',  href: '/#features' },
  { label: 'Explorer', href: '/explorer'   },
  { label: 'Docs',     href: '/docs'       },
  { label: 'Status',   href: '/status'     },
  { label: 'Pricing',  href: '/pricing'    },
] as const;

export default async function MarketingHeader() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <header
      role="banner"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        background: 'rgba(9, 13, 10, 0.88)',
        borderBottom: '1px solid var(--ds-border)',
      }}
    >
      <div
        style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}
        className="flex items-center h-[62px] gap-8"
      >
        {/* Logo */}
        <a
          href="/"
          aria-label="Kryndel home"
          className="font-ds-mono font-bold text-[18px] text-ds-green tracking-tight no-underline shrink-0"
          style={{ letterSpacing: '0.5px', textDecoration: 'none', color: 'var(--ds-green)' }}
        >
          kryndel<span style={{ color: 'var(--ds-text-3)', fontWeight: 400 }}>.dev</span>
        </a>

        {/* Desktop nav — hidden on mobile */}
        <nav
          aria-label="Main navigation"
          className="hidden md:flex items-center gap-[22px]"
        >
          {NAV_LINKS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="text-sm no-underline transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-green focus-visible:rounded"
              style={{
                color: 'var(--ds-text-3)',
                textDecoration: 'none',
                fontFamily: 'var(--font-inter, system-ui, sans-serif)',
              }}
              onMouseEnter={undefined}
            >
              {label}
            </a>
          ))}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          {isLoggedIn ? (
            <a
              href="/dashboard"
              className="inline-flex items-center gap-1 px-4 py-2 rounded-[10px] text-sm font-semibold no-underline transition-[filter] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-green focus-visible:ring-offset-2"
              style={{
                background: 'var(--ds-green)',
                color: 'var(--ds-shell)',
                border: '1px solid var(--ds-green)',
                textDecoration: 'none',
                fontFamily: 'var(--font-inter, system-ui, sans-serif)',
                boxShadow: '0 0 0 1px rgba(43,217,111,.25), 0 0 20px rgba(43,217,111,.12)',
              }}
            >
              Dashboard →
            </a>
          ) : (
            <>
              <a
                href="/login"
                className="inline-flex items-center px-4 py-2 rounded-[10px] text-sm font-semibold no-underline transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-green focus-visible:ring-offset-2"
                style={{
                  background: 'transparent',
                  color: 'var(--ds-text-2)',
                  border: '1px solid transparent',
                  textDecoration: 'none',
                  fontFamily: 'var(--font-inter, system-ui, sans-serif)',
                }}
              >
                Sign in
              </a>
              <a
                href="/login"
                className="inline-flex items-center px-4 py-2 rounded-[10px] text-sm font-semibold no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-green focus-visible:ring-offset-2"
                style={{
                  background: 'var(--ds-green)',
                  color: 'var(--ds-shell)',
                  border: '1px solid var(--ds-green)',
                  textDecoration: 'none',
                  fontFamily: 'var(--font-inter, system-ui, sans-serif)',
                  boxShadow: '0 0 0 1px rgba(43,217,111,.25), 0 0 20px rgba(43,217,111,.12)',
                }}
              >
                Start monitoring
              </a>
            </>
          )}
        </div>

        {/* Mobile: Sign in (text) + hamburger */}
        <div className="flex md:hidden items-center gap-3">
          {isLoggedIn ? (
            <a
              href="/dashboard"
              className="text-sm font-semibold no-underline"
              style={{ color: 'var(--ds-green)', textDecoration: 'none' }}
            >
              Dashboard
            </a>
          ) : (
            <a
              href="/login"
              className="text-sm font-medium no-underline"
              style={{ color: 'var(--ds-text-2)', textDecoration: 'none' }}
            >
              Sign in
            </a>
          )}
          {/* Hamburger — Client Component */}
          <MobileMenuButton />
        </div>
      </div>
    </header>
  );
}
