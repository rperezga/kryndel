import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Kryndel Explorer', template: '%s · Kryndel' },
  description: 'Observability & alerts for XRP Ledger smart contracts',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <header className="site-header">
          <a href="/" className="logo">
            kryndel<span>.explorer</span>
          </a>
          <nav>
            <a href="https://github.com/rperezga/kryndel" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            <a href="https://github.com/rperezga/kryndel/blob/main/LIMITATIONS.md" target="_blank" rel="noopener noreferrer">
              Limitations
            </a>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
