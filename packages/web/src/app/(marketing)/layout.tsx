/**
 * Marketing layout — wraps /, /pricing, /docs.
 * Uses the kryndel-landing-v2 aesthetic with marketing-specific styles.
 */
import MarketingHeader from './_components/MarketingHeader';
import MarketingFooter from './_components/MarketingFooter';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Scanline overlay — decorative, hidden from AT */}
      <div className="scan" aria-hidden="true" />
      <MarketingHeader />
      <main id="main-content">{children}</main>
      <MarketingFooter />
    </>
  );
}
