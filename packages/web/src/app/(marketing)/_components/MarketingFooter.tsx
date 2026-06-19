/**
 * MarketingFooter — shared across all marketing pages.
 * Server Component (static, no auth needed).
 */
export default function MarketingFooter() {
  return (
    <footer className="mkt-footer" role="contentinfo">
      <div className="wrap mkt-fcols">
        <a href="/" className="mkt-logo" aria-label="Kryndel home">
          kryndel<span>.dev</span>
        </a>

        <nav aria-label="Footer navigation">
          <a href="/#features">Product</a>
          <a href="/pricing">Pricing</a>
          <a href="/explorer">Explorer</a>
          <a href="/docs">Docs</a>
          <a href="https://github.com/rperezga/kryndel" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <a href="/login">Sign in</a>
        </nav>

        <p className="mkt-footer-copy">
          <span className="mono">support@kryndel.dev</span>
          {' · '}
          Apache-2.0
          {' · '}
          <a href="https://github.com/rperezga/kryndel/blob/main/LIMITATIONS.md" target="_blank" rel="noopener noreferrer">
            Limitations
          </a>
        </p>
      </div>
    </footer>
  );
}
