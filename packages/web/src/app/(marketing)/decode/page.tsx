import type { Metadata } from 'next';
import Link from 'next/link';
import { DecodeForm } from './DecodeForm';

const TITLE = 'Decode any XRPL EVM transaction — free, no login';
const DESC =
  'Paste an XRPL EVM Sidechain transaction hash and instantly see the decoded contract call and events — Transfer, Approval, Mint/Burn and verified custom events. A free developer tool by Kryndel.';
const URL = 'https://kryndel.dev/decode';

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: [
    'XRPL EVM',
    'decode transaction',
    'XRPL EVM Sidechain',
    'transaction decoder',
    'smart contract events',
    'EVM tx trace',
  ],
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESC, url: URL, type: 'website', siteName: 'Kryndel' },
  twitter: { card: 'summary', title: TITLE, description: DESC },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Kryndel Transaction Decoder',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Web',
  url: URL,
  description: DESC,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  publisher: { '@type': 'Organization', name: 'Kryndel', url: 'https://kryndel.dev' },
};

const STEPS: { n: string; title: string; body: string }[] = [
  {
    n: '01',
    title: 'Paste a hash',
    body: 'Any transaction on the XRPL EVM Sidechain mainnet. No wallet, no account, no setup.',
  },
  {
    n: '02',
    title: 'We decode it',
    body: 'Kryndel pulls the receipt, decodes the contract call and every log — using the verified ABI when available, standard signatures otherwise.',
  },
  {
    n: '03',
    title: 'Read it like English',
    body: 'See the method, the events (Transfer, Approval, Mint/Burn, custom), their arguments, status and gas — instead of raw topic hashes.',
  },
];

export default function DecodePage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-16 md:py-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <section className="text-center space-y-6">
        <p className="font-ds-mono text-[11px] uppercase tracking-[0.2em] text-ds-green font-bold select-none">
          Free tool · XRPL EVM
        </p>
        <h1 className="font-ds-sans text-3xl md:text-5xl font-bold tracking-tight text-ds-text m-0">
          Decode any XRPL EVM transaction
        </h1>
        <p className="font-ds-sans text-base md:text-lg text-ds-text-2 max-w-2xl mx-auto m-0 leading-relaxed">
          Paste a transaction hash and read it in plain English — the contract call, the events and
          their decoded arguments. No login required.
        </p>

        <div className="pt-2">
          <DecodeForm autoFocus />
        </div>

        <p className="font-ds-mono text-xs text-ds-text-3 m-0">
          Don&apos;t have a hash handy?{' '}
          <Link href="/explorer" className="text-ds-green hover:underline">
            Browse recent transactions →
          </Link>
        </p>
      </section>

      {/* How it works */}
      <section className="mt-20 md:mt-28">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="bg-ds-panel border border-solid border-ds-border rounded-lg p-6 space-y-3"
            >
              <div className="font-ds-mono text-xs text-ds-green font-bold">{s.n}</div>
              <h3 className="font-ds-sans text-lg font-bold text-ds-text m-0">{s.title}</h3>
              <p className="font-ds-sans text-sm text-ds-text-2 leading-relaxed m-0">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mt-20 md:mt-28 text-center bg-ds-panel border border-solid border-ds-border rounded-xl p-10 space-y-4">
        <h2 className="font-ds-sans text-2xl md:text-3xl font-bold text-ds-text m-0">
          Want the alert, not just the decode?
        </h2>
        <p className="font-ds-sans text-base text-ds-text-2 max-w-xl mx-auto m-0 leading-relaxed">
          Kryndel watches your contracts 24/7 and pushes decoded events to Telegram, Discord and
          webhooks the moment they happen — large transfers, new approvals, mints and more.
        </p>
        <div className="pt-2 flex flex-wrap justify-center gap-3">
          <Link
            href="/login"
            className="px-6 py-3 bg-ds-green text-ds-shell rounded font-ds-mono text-sm uppercase font-bold tracking-wider no-underline hover:opacity-90 transition-opacity"
          >
            Start monitoring free
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
