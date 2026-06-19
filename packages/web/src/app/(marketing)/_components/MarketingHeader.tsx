/**
 * MarketingHeader — sticky, blur, auth-aware.
 * Server Component: reads session from NextAuth, renders Dashboard or Sign-in buttons.
 */
import { auth } from '@/auth';

export default async function MarketingHeader() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <header className="mkt-header" role="banner">
      <div className="mkt-nav wrap">
        <a href="/" className="mkt-logo" aria-label="Kryndel home">
          kryndel<span>.dev</span>
        </a>

        <nav className="mkt-links" aria-label="Main navigation">
          <a href="/#features">Product</a>
          <a href="/#how">How it works</a>
          <a href="/pricing">Pricing</a>
          <a href="/explorer">Explorer</a>
          <a href="/docs">Docs</a>
        </nav>

        <div className="mkt-actions">
          {isLoggedIn ? (
            <a href="/dashboard" className="mkt-btn mkt-btn-primary">
              Dashboard →
            </a>
          ) : (
            <>
              <a href="/login" className="mkt-btn mkt-btn-ghost">
                Sign in
              </a>
              <a href="/login" className="mkt-btn mkt-btn-primary">
                Start free
              </a>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
