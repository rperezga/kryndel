/**
 * Root layout — html/body shell only.
 * Each route group supplies its own layout:
 *   (marketing)/ → MarketingLayout  (landing, pricing, docs)
 *   (app)/       → AppLayout        (explorer, contract, dashboard, login)
 */
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Kryndel — Observability & alerts for XRPL smart contracts', template: '%s · Kryndel' },
  description: 'The observability and alerts layer for XRPL programmable logic. Index, decode, trace and get real-time alerts on EVM Sidechain & native XLS-0101 contracts.',
  metadataBase: new URL('https://kryndel.dev'),
  openGraph: {
    siteName: 'Kryndel',
    type: 'website',
    locale: 'en_US',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
