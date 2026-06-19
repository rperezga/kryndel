/**
 * / — Marketing landing page.
 * Server Component (SEO-first, no JS needed for content).
 * Ported from kryndel-landing-v2.html (approved design reference).
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kryndel — Observability & alerts for XRPL smart contracts',
  description:
    'The observability and alerts layer for XRPL programmable logic. Index, decode, trace and get real-time alerts on your smart contracts — before something breaks.',
  openGraph: {
    title: 'Kryndel — X-ray your XRPL contracts',
    description:
      'Index, decode, trace and alert on XRPL smart contracts. Live on mainnet. Open-source.',
    url: 'https://kryndel.dev',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kryndel — X-ray your XRPL contracts',
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
      <section className="mkt-hero wrap" aria-labelledby="hero-heading">
        <div className="mkt-hero-text">
          <div className="mkt-pill" role="status" aria-label="Live on XRPL EVM Sidechain mainnet">
            <span className="mkt-dot" aria-hidden="true" />
            Live on XRPL EVM Sidechain mainnet
          </div>

          <h1 id="hero-heading" className="mkt-h1">
            X-ray your{' '}
            <span className="mkt-gradient">XRPL contracts.</span>
          </h1>

          <p className="mkt-sub">
            The observability and alerts layer for XRPL programmable logic. Index, decode, trace
            and get real-time alerts on your smart contracts — before something breaks.
          </p>

          <div className="mkt-cta">
            <a href="/login" className="mkt-btn mkt-btn-primary mkt-btn-lg">
              Start free →
            </a>
            <a
              href="https://youtu.be/nbY1uYgFMuw"
              className="mkt-btn mkt-btn-ghost mkt-btn-lg"
              target="_blank"
              rel="noopener noreferrer"
            >
              Watch 34 s demo
            </a>
            <a href="/explorer" className="mkt-btn mkt-btn-lg">
              Try the explorer
            </a>
          </div>

          <ul className="mkt-trust" aria-label="Trust signals">
            <li><strong>Open-source</strong> · Apache-2.0</li>
            <li><strong>263</strong> tests green</li>
            <li><strong>EVM + XLS-0101</strong></li>
          </ul>
        </div>

        {/* Console demo — decorative, screen readers get the aria-label on the outer div */}
        <div className="mkt-console" aria-label="Live trace and alert example" role="img">
          <div className="mkt-console-bar" aria-hidden="true">
            <i /><i /><i />
            <span className="mono">kryndel trace — mainnet</span>
          </div>
          <div className="mkt-console-body" aria-hidden="true">
            <div className="cl cl-1">
              <span className="c-prompt">$</span>{' '}
              kryndel trace{' '}
              <span className="c-mut">0xac75…13e4e</span>{' '}
              --net evm
            </div>
            <div className="cl cl-2 c-mut">→ contract 0xe4c3…1ea67</div>
            <div className="cl cl-3">
              <span className="c-key">event</span>{' '}
              Transfer{' '}
              <span className="c-mut">from 0x36e1… to 0xe4c3… value 1,250</span>
            </div>
            <div className="cl cl-4">
              <span className="c-key">event</span>{' '}
              Approval{' '}
              <span className="c-mut">spender 0x91a2… amount 5,000</span>
            </div>
            <div className="cl cl-5">
              <span className="c-ok">✓ tx_success</span>{' '}
              <span className="c-mut">block 6317490 · 240ms</span>
            </div>
            <div className="cl cl-6 mkt-alert-line">
              <span className="c-ok" aria-hidden="true">●</span>
              <div>
                <strong>Kryndel Alert</strong>
                &nbsp;
                <span className="c-mut">rule matched · Transfer &gt; 1,000</span>
                <br />
                <span className="c-mut">delivered → Telegram · Slack · webhook</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────── */}
      <section id="features" className="mkt-section wrap" aria-labelledby="features-heading">
        <p className="mkt-eyebrow" aria-hidden="true">What it does</p>
        <h2 id="features-heading" className="mkt-h2">
          The &ldquo;Etherscan + PagerDuty&rdquo; the XRPL contract layer is missing.
        </h2>
        <p className="mkt-lead">
          Existing explorers track payments and tokens. They don&apos;t decode your contract calls,
          trace transactions, or alert when something fires. Kryndel does.
        </p>

        <ul className="mkt-grid" role="list">
          <li className="mkt-card">
            <div className="mkt-card-ic" aria-hidden="true">{'{}'}</div>
            <h3>Decode</h3>
            <p>
              Turn raw calls and event topics into human-readable data — function names, args,
              decoded events.
            </p>
          </li>
          <li className="mkt-card">
            <div className="mkt-card-ic" aria-hidden="true">⌁</div>
            <h3>Trace</h3>
            <p>
              A full x-ray of any transaction: calls, emitted events, status — across EVM Sidechain
              and native XLS-0101.
            </p>
          </li>
          <li className="mkt-card">
            <div className="mkt-card-ic" aria-hidden="true">!</div>
            <h3>Alert</h3>
            <p>
              Real-time alerts the moment a watched event fires — Telegram, Slack, Discord, email or
              signed webhook.
            </p>
          </li>
          <li className="mkt-card">
            <div className="mkt-card-ic" aria-hidden="true">{'</>'}</div>
            <h3>API</h3>
            <p>
              REST API v1, signed outbound webhooks and a TypeScript SDK. Build Kryndel into your
              own stack.
            </p>
          </li>
        </ul>

        <p className="mkt-honest" role="note">
          native XLS-0101: watcher ready · full decode pending AlphaNet — shown honestly, never
          faked.
        </p>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────── */}
      <section id="how" className="mkt-section wrap" aria-labelledby="how-heading">
        <p className="mkt-eyebrow" aria-hidden="true">How it works</p>
        <h2 id="how-heading" className="mkt-h2">One signal path, chain to alert.</h2>
        <p className="mkt-lead">
          Kryndel watches your contracts 24/7, decodes what they emit, indexes it, and routes alerts
          where your team already works.
        </p>

        <ol className="mkt-flow" aria-label="Signal path: watcher to alerts" role="list">
          <li className="mkt-node">watcher</li>
          <li className="mkt-arrow" aria-hidden="true">→</li>
          <li className="mkt-node">decoder</li>
          <li className="mkt-arrow" aria-hidden="true">→</li>
          <li className="mkt-node">indexer</li>
          <li className="mkt-arrow" aria-hidden="true">→</li>
          <li className="mkt-node">alerts</li>
        </ol>
      </section>

      {/* ── PRICING TEASER ────────────────────────── */}
      <section id="pricing" className="mkt-section wrap" aria-labelledby="pricing-heading">
        <p className="mkt-eyebrow" aria-hidden="true">Pricing</p>
        <h2 id="pricing-heading" className="mkt-h2">Start free. Upgrade when you scale.</h2>
        <p className="mkt-lead">No card required to start. Cancel anytime.</p>

        <div className="mkt-prices" role="list">
          <article className="mkt-price" role="listitem" aria-label="Free plan">
            <p className="mkt-price-name">Free</p>
            <p className="mkt-price-amt">
              $0<span> / forever</span>
            </p>
            <ul aria-label="Free plan features">
              <li>3 contracts watched</li>
              <li>Telegram alerts</li>
              <li>7-day event history</li>
              <li>Public explorer</li>
            </ul>
            <a href="/login" className="mkt-btn mkt-btn-ghost">
              Start free
            </a>
          </article>

          <article className="mkt-price mkt-price-pro" role="listitem" aria-label="Pro plan">
            <p className="mkt-price-tag" aria-label="Most popular">Most popular</p>
            <p className="mkt-price-name">Pro</p>
            <p className="mkt-price-amt">
              $19<span> / month</span>
            </p>
            <ul aria-label="Pro plan features">
              <li>20 contracts watched</li>
              <li>All channels — Slack, Discord, webhook, email</li>
              <li>90-day history</li>
              <li>Full REST API + SDK + webhooks</li>
            </ul>
            <a href="/login" className="mkt-btn mkt-btn-primary">
              Go Pro
            </a>
          </article>
        </div>

        <p style={{ marginTop: '1.5rem' }}>
          <a href="/pricing" className="mkt-link">
            See full pricing details →
          </a>
        </p>
      </section>

      {/* ── FINAL CTA ─────────────────────────────── */}
      <section className="mkt-final wrap" aria-labelledby="cta-heading">
        <p className="mkt-eyebrow" aria-hidden="true">Ship with confidence</p>
        <h2 id="cta-heading" className="mkt-h2 mkt-h2-xl">Stop flying blind on-chain.</h2>
        <p className="mkt-lead mkt-lead-center">
          Deploy faster, catch failures early, and know exactly what your contracts are doing —
          the moment they do it.
        </p>
        <a href="/login" className="mkt-btn mkt-btn-primary mkt-btn-xl">
          Start free →
        </a>
      </section>
    </>
  );
}
