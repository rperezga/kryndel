/**
 * MarketingFooter — Etapa 1: Chrome de marketing
 *
 * Server Component (static, no auth needed).
 * DS tokens --ds-* + Tailwind. Responsive.
 * Referencia: group 1/landing_page_desktop footer (minimal bar).
 */

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

const FOOTER_LINKS: FooterLink[] = [
  { label: 'Product',  href: '/#features'                                           },
  { label: 'Pricing',  href: '/pricing'                                              },
  { label: 'Explorer', href: '/explorer'                                             },
  { label: 'Docs',     href: '/docs'                                                 },
  { label: 'GitHub',   href: 'https://github.com/rperezga/kryndel', external: true  },
  { label: 'Sign in',  href: '/login'                                                },
];

export default function MarketingFooter() {
  return (
    <footer
      role="contentinfo"
      style={{
        borderTop: '1px solid var(--ds-border)',
        background: 'var(--ds-panel)',
      }}
    >
      {/* Main footer row */}
      <div
        style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 28px' }}
        className="flex flex-col md:flex-row md:items-center gap-6"
      >
        {/* Logo */}
        <a
          href="/"
          aria-label="Kryndel home"
          className="font-ds-mono font-bold text-[16px] shrink-0 no-underline"
          style={{ color: 'var(--ds-green)', textDecoration: 'none' }}
        >
          kryndel<span style={{ color: 'var(--ds-text-3)', fontWeight: 400 }}>.dev</span>
        </a>

        {/* Nav links */}
        <nav
          aria-label="Footer navigation"
          className="flex flex-wrap gap-x-5 gap-y-2"
        >
          {FOOTER_LINKS.map(({ label, href, external }) => (
            <a
              key={label}
              href={href}
              {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="text-sm no-underline transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-green focus-visible:rounded"
              style={{
                color: 'var(--ds-text-3)',
                textDecoration: 'none',
                fontFamily: 'var(--font-inter, system-ui, sans-serif)',
              }}
            >
              {label}
              {external && (
                <span aria-hidden="true" style={{ marginLeft: 2, fontSize: 10, opacity: 0.6 }}>↗</span>
              )}
            </a>
          ))}
        </nav>

        {/* Spacer */}
        <div className="flex-1 hidden md:block" />

        {/* Copy + links */}
        <p
          className="text-xs shrink-0 flex flex-wrap gap-x-2 gap-y-1 items-center"
          style={{
            color: 'var(--ds-text-3)',
            fontFamily: 'var(--font-inter, system-ui, sans-serif)',
          }}
        >
          <a
            href="mailto:support@kryndel.dev"
            className="no-underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ds-green focus-visible:rounded"
            style={{ color: 'var(--ds-text-2)', textDecoration: 'none' }}
          >
            support@kryndel.dev
          </a>
          <span aria-hidden="true">·</span>
          <span>Apache-2.0</span>
          <span aria-hidden="true">·</span>
          <a
            href="https://github.com/rperezga/kryndel/blob/main/LIMITATIONS.md"
            target="_blank"
            rel="noopener noreferrer"
            className="no-underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ds-green focus-visible:rounded"
            style={{ color: 'var(--ds-text-3)', textDecoration: 'none' }}
          >
            Limitations
          </a>
        </p>
      </div>

      {/* Bottom rule + copyright */}
      <div
        style={{
          borderTop: '1px solid var(--ds-border)',
          padding: '12px 24px',
          maxWidth: 1100,
          margin: '0 auto',
        }}
        className="flex items-center justify-between"
      >
        <p
          className="text-xs"
          style={{
            color: 'var(--ds-text-3)',
            fontFamily: 'var(--font-inter, system-ui, sans-serif)',
          }}
        >
          © {new Date().getFullYear()} Kryndel · XRPL observability layer
        </p>
        <p
          className="text-xs font-ds-mono"
          style={{ color: 'var(--ds-text-3)' }}
        >
          XLS-0101 + EVM Sidechain
        </p>
      </div>

      {/* Mobile bottom nav spacer — keeps content above fixed bar */}
      <div className="md:hidden" style={{ height: 60 }} aria-hidden="true" />
    </footer>
  );
}
