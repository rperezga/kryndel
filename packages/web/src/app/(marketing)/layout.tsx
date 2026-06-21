/**
 * Marketing layout — wraps /, /pricing, /docs.
 * Etapa 1: añade MobileBottomNav (Client Component).
 * Padding-bottom en móvil para que el contenido no quede bajo el bottom nav.
 */
import MarketingHeader from './_components/MarketingHeader';
import MarketingFooter from './_components/MarketingFooter';
import { MobileBottomNav } from './_components/MobileMenu';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Scanline overlay — decorative, hidden from AT */}
      <div className="scan" aria-hidden="true" />
      <MarketingHeader />
      {/* pb-[60px] on mobile compensates for the fixed bottom nav bar */}
      <main id="main-content" className="md:pb-0 pb-[60px]">
        {children}
      </main>
      <MarketingFooter />
      <MobileBottomNav />
    </>
  );
}
