/**
 * / — Marketing landing page.
 * Server Component (SEO-first, no JS needed for content).
 * Ported from kryndel-landing-v3.html (approved design reference).
 */
import type { Metadata } from 'next';
import { Button } from '@/components/ds/Button';
import LiveConsole from './_components/LiveConsole';

export const metadata: Metadata = {
  title: 'Kryndel — Observability & alerts for XRPL smart contracts',
  description:
    'Detect, decode, alert and replay on XRPL smart contracts. Observability and real-time alerts for EVM Sidechain & native XLS-0101.',
  openGraph: {
    title: 'Kryndel — Live ops for XRPL smart contracts',
    description:
      'Detect, decode, alert and replay on XRPL smart contracts. Observability and real-time alerts for EVM Sidechain & native XLS-0101.',
    url: 'https://kryndel.dev',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kryndel — Live ops for XRPL smart contracts',
    description: 'Observability & alerts for XRPL smart contracts. Live on mainnet.',
  },
};

export default function LandingPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': 'https://kryndel.dev/#website',
        name: 'Kryndel',
        url: 'https://kryndel.dev',
      },
      {
        '@type': 'SoftwareApplication',
        '@id': 'https://kryndel.dev/#app',
        name: 'Kryndel',
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Web',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        description:
          'Observability and alerts layer for XRPL smart contracts. Index, decode, trace and alert on EVM Sidechain & native XLS-0101 contracts.',
        url: 'https://kryndel.dev',
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── HERO ──────────────────────────────────── */}
      <div className="wrap">
        <section className="mkt-hero" aria-labelledby="hero-heading">
          <div>
            <div className="mkt-pill" role="status" aria-label="Live on XRPL EVM Sidechain mainnet">
              <span className="mkt-dot" aria-hidden="true" />
              Live on XRPL EVM Sidechain mainnet
            </div>

            <h1 id="hero-heading" className="mkt-h1">
              Live ops for your <em className="not-italic text-ds-green">XRPL contracts.</em>
            </h1>

            <p className="mkt-sub">
              Detect, decode, alert and replay — the observability layer for XRPL smart contracts.
              Know what your contracts do the moment they do it.
            </p>

            <div className="mkt-cta">
              <Button size="lg" asChild>
                <a href="/login">Start monitoring →</a>
              </Button>
              <Button variant="ghost" size="lg" asChild>
                <a href="/explorer">Open live explorer</a>
              </Button>
            </div>

            {/* Stats section */}
            <div className="flex gap-[26px] flex-wrap mt-[34px]" aria-label="Key statistics">
              <div className="flex flex-col">
                <div className="font-ds-mono text-[19px] font-semibold text-ds-text">EVM + XLS-0101</div>
                <div className="text-[11.5px] text-ds-text-3 font-medium">surfaces watched</div>
              </div>
              <div className="flex flex-col">
                <div className="font-ds-mono text-[19px] font-semibold text-ds-text">&lt;4s</div>
                <div className="text-[11.5px] text-ds-text-3 font-medium">event-to-alert</div>
              </div>
              <div className="flex flex-col">
                <div className="font-ds-mono text-[19px] font-semibold text-ds-text">Apache-2.0</div>
                <div className="text-[11.5px] text-ds-text-3 font-medium">open-source</div>
              </div>
            </div>
          </div>

          {/* Right Column: Live Console */}
          <LiveConsole />
        </section>
      </div>

      <div className="wrap">
        {/* ── WORKFLOW ────────────────────────────── */}
        <section id="workflow" className="mkt-section" aria-labelledby="workflow-heading">
          <p className="mkt-eyebrow" aria-hidden="true">How it works</p>
          <h2 id="workflow-heading" className="mkt-h2">Detect &rarr; Decode &rarr; Alert &rarr; Replay.</h2>
          <p className="mkt-lead">
            One signal path. Kryndel watches your contracts 24/7, turns raw logs into named events,
            routes alerts where your team works, and lets you replay what happened.
          </p>

          <ol className="grid grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-4 gap-3.5 list-none p-0" aria-label="Four steps workflow">
            <li className="bg-ds-panel border border-solid border-ds-border rounded-[13px] p-5">
              <div className="font-ds-mono text-[11px] text-ds-green mb-2.5">01</div>
              <h3 className="text-base font-bold mb-1.5 text-ds-text">Detect</h3>
              <p className="text-ds-text-2 text-[13.5px] leading-relaxed">
                Watch any EVM Sidechain or XLS-0101 contract in real time — no scripts, no cron.
              </p>
            </li>
            <li className="bg-ds-panel border border-solid border-ds-border rounded-[13px] p-5">
              <div className="font-ds-mono text-[11px] text-ds-green mb-2.5">02</div>
              <h3 className="text-base font-bold mb-1.5 text-ds-text">Decode</h3>
              <p className="text-ds-text-2 text-[13.5px] leading-relaxed">
                Named events (Transfer, Approval, Swap…) and decoded args — not raw topics.
              </p>
            </li>
            <li className="bg-ds-panel border border-solid border-ds-border rounded-[13px] p-5">
              <div className="font-ds-mono text-[11px] text-ds-green mb-2.5">03</div>
              <h3 className="text-base font-bold mb-1.5 text-ds-text">Alert</h3>
              <p className="text-ds-text-2 text-[13.5px] leading-relaxed">
                Rule fires &rarr; Telegram, webhook or API (SMS, email &amp; push coming soon). Filter by decoded args.
              </p>
            </li>
            <li className="bg-ds-panel border border-solid border-ds-border rounded-[13px] p-5">
              <div className="font-ds-mono text-[11px] text-ds-green mb-2.5">04</div>
              <h3 className="text-base font-bold mb-1.5 text-ds-text">Replay</h3>
              <p className="text-ds-text-2 text-[13.5px] leading-relaxed">
                Trace any tx into a readable timeline: call &rarr; event &rarr; state &rarr; alert.
              </p>
            </li>
          </ol>
        </section>

        {/* ── FEATURES GRID ───────────────────────── */}
        <section id="features" className="mkt-section" aria-labelledby="features-heading">
          <p className="mkt-eyebrow" aria-hidden="true">What it does</p>
          <h2 id="features-heading" className="mkt-h2">
            The command center the XRPL contract layer is missing.
          </h2>
          <p className="mkt-lead">
            Explorers track payments and tokens. They don&apos;t decode your contracts, trace
            transactions, or alert when something fires. Kryndel does.
          </p>

          <ul className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-4 gap-3.5 list-none p-0">
            <li className="bg-ds-panel border border-solid border-ds-border rounded-[14px] p-6 transition-all duration-200 hover:-translate-y-[3px] hover:border-ds-border-on hover:shadow-[0_18px_40px_rgba(0,0,0,0.4)]">
              <div className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center bg-[rgba(43,217,111,0.09)] text-ds-green font-ds-mono text-lg mb-3.5" aria-hidden="true">
                {'{}'}
              </div>
              <h3 className="text-[17px] font-bold mb-1.75 text-ds-text">Decode</h3>
              <p className="text-ds-text-2 text-sm leading-relaxed">
                Raw calls & event topics &rarr; human-readable, named, decoded data.
              </p>
            </li>
            <li className="bg-ds-panel border border-solid border-ds-border rounded-[14px] p-6 transition-all duration-200 hover:-translate-y-[3px] hover:border-ds-border-on hover:shadow-[0_18px_40px_rgba(0,0,0,0.4)]">
              <div className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center bg-[rgba(43,217,111,0.09)] text-ds-green font-ds-mono text-lg mb-3.5" aria-hidden="true">
                ⌁
              </div>
              <h3 className="text-[17px] font-bold mb-1.75 text-ds-text">Trace</h3>
              <p className="text-ds-text-2 text-sm leading-relaxed">
                Full x-ray of any tx — calls, events, status, failure reason.
              </p>
            </li>
            <li className="bg-ds-panel border border-solid border-ds-border rounded-[14px] p-6 transition-all duration-200 hover:-translate-y-[3px] hover:border-ds-border-on hover:shadow-[0_18px_40px_rgba(0,0,0,0.4)]">
              <div className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center bg-[rgba(43,217,111,0.09)] text-ds-green font-ds-mono text-lg mb-3.5" aria-hidden="true">
                !
              </div>
              <h3 className="text-[17px] font-bold mb-1.75 text-ds-text">Alert</h3>
              <p className="text-ds-text-2 text-sm leading-relaxed">
                Real-time alerts with arg filters &rarr; Telegram &amp; webhook (SMS, email &amp; push soon).
              </p>
            </li>
            <li className="bg-ds-panel border border-solid border-ds-border rounded-[14px] p-6 transition-all duration-200 hover:-translate-y-[3px] hover:border-ds-border-on hover:shadow-[0_18px_40px_rgba(0,0,0,0.4)]">
              <div className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center bg-[rgba(43,217,111,0.09)] text-ds-green font-ds-mono text-lg mb-3.5" aria-hidden="true">
                &lt;/&gt;
              </div>
              <h3 className="text-[17px] font-bold mb-1.75 text-ds-text">API</h3>
              <p className="text-ds-text-2 text-sm leading-relaxed">
                REST API v1, signed webhooks & TypeScript SDK. Build it into your stack.
              </p>
            </li>
          </ul>
        </section>

        {/* ── EXPLORER PREVIEW ────────────────────── */}
        <section id="explorer" className="mkt-section" aria-labelledby="explorer-heading">
          <p className="mkt-eyebrow" aria-hidden="true">Explorer</p>
          <h2 id="explorer-heading" className="mkt-h2">Etherscan-readable, Tenderly-decoded.</h2>
          <p className="mkt-lead">
            Search any contract, tx, event or selector. Decoded events, traces and one-click &ldquo;create alert&rdquo; — right where you find the problem.
          </p>

          <div className="bg-ds-panel border border-solid border-ds-border rounded-[13px] overflow-hidden font-ds-mono text-[12.5px]">
            <div className="grid grid-cols-[1.4fr_1.5fr_1fr] md:grid-cols-[1.4fr_1.5fr_1fr_1fr_1fr] gap-2.5 p-3 px-4 items-center text-ds-text-3 text-[11px] uppercase tracking-[0.5px] border-b border-solid border-ds-border bg-ds-panel-2 font-medium">
              <span>tx / event</span>
              <span>contract</span>
              <span>method</span>
              <span className="hidden md:block">block</span>
              <span className="hidden md:block">status</span>
            </div>

            <div className="grid grid-cols-[1.4fr_1.5fr_1fr] md:grid-cols-[1.4fr_1.5fr_1fr_1fr_1fr] gap-2.5 p-3 px-4 items-center border-b border-solid border-ds-border hover:bg-ds-panel-2 transition-colors">
              <span className="text-ds-text-2">0xac75…13e4e</span>
              <span className="text-ds-text-2">USDCVault</span>
              <span className="text-ds-text">Transfer</span>
              <span className="hidden md:block text-ds-text-2">6,317,492</span>
              <span className="hidden md:block text-ds-green font-semibold">success</span>
            </div>

            <div className="grid grid-cols-[1.4fr_1.5fr_1fr] md:grid-cols-[1.4fr_1.5fr_1fr_1fr_1fr] gap-2.5 p-3 px-4 items-center border-b border-solid border-ds-border hover:bg-ds-panel-2 transition-colors">
              <span className="text-ds-text-2">0x91a2…77f0</span>
              <span className="text-ds-text-2">AMM·XRP/USDC</span>
              <span className="text-ds-text">Swap</span>
              <span className="hidden md:block text-ds-text-2">6,317,491</span>
              <span className="hidden md:block text-ds-green font-semibold">success</span>
            </div>

            <div className="grid grid-cols-[1.4fr_1.5fr_1fr] md:grid-cols-[1.4fr_1.5fr_1fr_1fr_1fr] gap-2.5 p-3 px-4 items-center border-b border-solid border-ds-border hover:bg-ds-panel-2 transition-colors">
              <span className="text-ds-text-2">0x7fcf…2b3c</span>
              <span className="text-ds-text-2">USDCVault</span>
              <span className="text-ds-red font-medium">Withdraw</span>
              <span className="hidden md:block text-ds-text-2">6,317,489</span>
              <span className="hidden md:block text-ds-red font-semibold">reverted</span>
            </div>

            <div className="grid grid-cols-[1.4fr_1.5fr_1fr] md:grid-cols-[1.4fr_1.5fr_1fr_1fr_1fr] gap-2.5 p-3 px-4 items-center border-b-0 hover:bg-ds-panel-2 transition-colors">
              <span className="text-ds-text-2">0xddf2…b3ef</span>
              <span className="text-ds-text-2">LOOSH</span>
              <span className="text-ds-text">Approval</span>
              <span className="hidden md:block text-ds-text-2">6,317,488</span>
              <span className="hidden md:block text-ds-green font-semibold">success</span>
            </div>
          </div>
        </section>

        {/* ── PRICING TEASER ──────────────────────── */}
        <section id="pricing" className="mkt-section" aria-labelledby="pricing-heading">
          <p className="mkt-eyebrow" aria-hidden="true">Pricing</p>
          <h2 id="pricing-heading" className="mkt-h2">Start free. Upgrade when you scale.</h2>
          <p className="mkt-lead">No card to start. Cancel anytime.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-[18px] max-w-[760px] mx-auto w-full list-none p-0">
            {/* Free tier */}
            <article className="bg-ds-panel border border-solid border-ds-border rounded-[16px] p-7 flex flex-col" aria-label="Free plan">
              <p className="font-ds-mono text-ds-text-2 text-[13px] mb-1.5">Free</p>
              <p className="text-[38px] font-extrabold text-ds-text mb-4">
                $0<span className="text-base text-ds-text-3 font-normal"> / forever</span>
              </p>
              <ul className="list-none m-0 mb-6 p-0 flex-1 flex flex-col gap-1.5" aria-label="Free plan features">
                <li className="py-1.5 text-ds-text-2 text-sm flex gap-2.25 items-center border-b border-solid border-[rgba(255,255,255,0.03)] last:border-b-0">
                  <span className="text-ds-green select-none">▸</span> 3 contracts
                </li>
                <li className="py-1.5 text-ds-text-2 text-sm flex gap-2.25 items-center border-b border-solid border-[rgba(255,255,255,0.03)] last:border-b-0">
                  <span className="text-ds-green select-none">▸</span> Telegram alerts
                </li>
                <li className="py-1.5 text-ds-text-2 text-sm flex gap-2.25 items-center border-b border-solid border-[rgba(255,255,255,0.03)] last:border-b-0">
                  <span className="text-ds-green select-none">▸</span> 7-day history
                </li>
                <li className="py-1.5 text-ds-text-2 text-sm flex gap-2.25 items-center border-b border-solid border-[rgba(255,255,255,0.03)] last:border-b-0">
                  <span className="text-ds-green select-none">▸</span> Public explorer
                </li>
              </ul>
              <Button variant="secondary" size="lg" asChild className="w-full justify-center">
                <a href="/login">Start free</a>
              </Button>
            </article>

            {/* Pro tier ($19) */}
            <article className="bg-ds-panel border border-solid border-ds-green shadow-[0_0_30px_rgba(43,217,111,0.12)] rounded-[16px] p-7 flex flex-col relative" aria-label="Pro plan">
              <div className="absolute -top-[11px] right-[22px] bg-ds-green text-[#04140a] text-[11px] font-bold px-[11px] py-[3px] rounded-full font-ds-mono select-none" aria-label="Most popular">
                Most popular
              </div>
              <p className="font-ds-mono text-ds-text-2 text-[13px] mb-1.5">Pro</p>
              <p className="text-[38px] font-extrabold text-ds-text mb-4">
                $19.99<span className="text-base text-ds-text-3 font-normal"> / month</span>
              </p>
              <ul className="list-none m-0 mb-6 p-0 flex-1 flex flex-col gap-1.5" aria-label="Pro plan features">
                <li className="py-1.5 text-ds-text-2 text-sm flex gap-2.25 items-center border-b border-solid border-[rgba(255,255,255,0.03)] last:border-b-0">
                  <span className="text-ds-green select-none">▸</span> 20 contracts
                </li>
                <li className="py-1.5 text-ds-text-2 text-sm flex gap-2.25 items-center border-b border-solid border-[rgba(255,255,255,0.03)] last:border-b-0">
                  <span className="text-ds-green select-none">▸</span> Telegram &amp; webhooks today — SMS, email &amp; push soon
                </li>
                <li className="py-1.5 text-ds-text-2 text-sm flex gap-2.25 items-center border-b border-solid border-[rgba(255,255,255,0.03)] last:border-b-0">
                  <span className="text-ds-green select-none">▸</span> 90-day history
                </li>
                <li className="py-1.5 text-ds-text-2 text-sm flex gap-2.25 items-center border-b border-solid border-[rgba(255,255,255,0.03)] last:border-b-0">
                  <span className="text-ds-green select-none">▸</span> REST API + SDK + signed webhooks
                </li>
              </ul>
              <Button variant="primary" size="lg" asChild className="w-full justify-center">
                <a href="/login">Go Pro</a>
              </Button>
            </article>
          </div>

          {/* XLS-0101 Honest Notice */}
          <div className="text-ds-amber bg-[rgba(255,176,32,0.05)] border border-solid border-[#4a3a14] rounded-[11px] px-4 py-3.25 mt-[30px] inline-block font-ds-mono text-[12.5px] leading-relaxed">
            native XLS-0101: watcher ready · full decode pending AlphaNet — shown honestly, never faked.
          </div>
        </section>

        {/* ── FINAL CTA ───────────────────────────── */}
        <section className="mkt-final" aria-labelledby="cta-heading">
          <p className="mkt-eyebrow" aria-hidden="true">Ship with confidence</p>
          <h2 id="cta-heading" className="mkt-h2 mkt-h2-xl">Stop flying blind on-chain.</h2>
          <p className="mkt-lead mkt-lead-center" style={{ margin: '0 auto 28px' }}>
            Deploy faster, catch failures early, and know exactly what your contracts are doing —
            the moment they do it.
          </p>
          <Button size="lg" asChild style={{ padding: '14px 32px', fontSize: '15.5px' }}>
            <a href="/login">Start monitoring &rarr;</a>
          </Button>
        </section>
      </div>
    </>
  );
}
