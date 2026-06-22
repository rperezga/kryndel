/**
 * Root layout — html/body shell only.
 * Each route group supplies its own layout:
 *   (marketing)/ → MarketingLayout  (landing, pricing, docs)
 *   (app)/       → AppLayout        (explorer, contract, dashboard, login)
 *
 * Etapa 0: Inter (UI) + JetBrains Mono (datos/hashes) via next/font.
 * Las vars --font-inter y --font-jetbrains se usan en tailwind.config.ts
 * como font-ds-sans / font-ds-mono. Números tabulares activos via CSS.
 */
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
  // weight: 'variable' carga la fuente como variable font (incluye ital)
  weight: 'variable',
});

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
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
