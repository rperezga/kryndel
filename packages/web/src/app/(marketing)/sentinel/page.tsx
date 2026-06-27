import type { Metadata } from 'next';
import Link from 'next/link';
import { SentinelForm } from './SentinelForm';

const TITLE = 'XRPL token security check — issuer flags, supply & freeze | Kryndel Sentinel';
const DESC =
  'Check any XRPL token issuer in seconds: is it blackholed, can it freeze or claw back balances, is a regular key in control, what is the issued supply? Free, no login — Kryndel Sentinel.';
const URL = 'https://kryndel.dev/sentinel';

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: [
    'XRPL token security',
    'issuer blackholed',
    'XRPL freeze',
    'gateway balances',
    'token supply XRPL',
    'XRPL issuer flags',
    'clawback',
  ],
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESC, url: URL, type: 'website', siteName: 'Kryndel' },
  twitter: { card: 'summary', title: TITLE, description: DESC },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Kryndel Sentinel — XRPL token security check',
  applicationCategory: 'SecurityApplication',
  operatingSystem: 'Web',
  url: URL,
  description: DESC,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  publisher: { '@type': 'Organization', name: 'Kryndel', url: 'https://kryndel.dev' },
};

const CHECKS: { title: string; body: string }[] = [
  {
    title: 'Is it blackholed?',
    body: 'See whether the master key is disabled and no regular key remains — i.e. whether supply is provably fixed or the issuer can still mint.',
  },
  {
    title: 'Can it freeze or claw back?',
    body: 'Global Freeze, No-Freeze and Clawback status — whether the issuer can freeze balances or pull tokens back from holders.',
  },
  {
    title: 'Supply & holders',
    body: 'Issued supply per currency (gateway balances) and the number of trustlines holding the token.',
  },
];

export default function SentinelPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-16 md:py-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="text-center space-y-6">
        <p className="font-ds-mono text-[11px] uppercase tracking-[0.2em] text-ds-green font-bold select-none">
          Free tool · XRPL Sentinel
        </p>
        <h1 className="font-ds-sans text-3xl md:text-5xl font-bold tracking-tight text-ds-text m-0">
          Is this XRPL token safe?
        </h1>
        <p className="font-ds-sans text-base md:text-lg text-ds-text-2 max-w-2xl mx-auto m-0 leading-relaxed">
          Paste a token issuer account and see its security posture — blackholed or not, freeze and
          clawback powers, regular-key control, issued supply and holders. No login required.
        </p>

        <div className="pt-2">
          <SentinelForm autoFocus />
        </div>

        <p className="font-ds-mono text-xs text-ds-text-3 m-0">
          Issuer accounts start with <span className="text-ds-text-2">r</span> — find one on{' '}
          <a
            href="https://xrpl.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-ds-green hover:underline"
          >
            any XRPL explorer
          </a>
          .
        </p>
      </section>

      <section className="mt-20 md:mt-28">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {CHECKS.map((c) => (
            <div key={c.title} className="bg-ds-panel border border-solid border-ds-border rounded-lg p-6 space-y-3">
              <h3 className="font-ds-sans text-lg font-bold text-ds-text m-0">{c.title}</h3>
              <p className="font-ds-sans text-sm text-ds-text-2 leading-relaxed m-0">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-20 md:mt-28 text-center bg-ds-panel border border-solid border-ds-border rounded-xl p-10 space-y-4">
        <h2 className="font-ds-sans text-2xl md:text-3xl font-bold text-ds-text m-0">
          Get told the moment it changes
        </h2>
        <p className="font-ds-sans text-base text-ds-text-2 max-w-xl mx-auto m-0 leading-relaxed">
          Kryndel Sentinel watches your issuer 24/7 and alerts you instantly if the master key is
          re-enabled, a regular key is set, freeze or clawback is toggled, or supply jumps — straight
          to Telegram, Discord or a webhook.
        </p>
        <div className="pt-2 flex flex-wrap justify-center gap-3">
          <Link
            href="/login"
            className="px-6 py-3 bg-ds-green text-ds-shell rounded font-ds-mono text-sm uppercase font-bold tracking-wider no-underline hover:opacity-90 transition-opacity"
          >
            Watch this issuer
          </Link>
          <Link
            href="/pricing"
            className="px-6 py-3 border border-solid border-ds-border text-ds-text-2 rounded font-ds-mono text-sm uppercase font-bold tracking-wider no-underline hover:border-ds-green hover:text-ds-green transition-colors"
          >
            See pricing
          </Link>
        </div>
      </section>
    </div>
  );
}
