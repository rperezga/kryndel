/**
 * /pricing — simplified to Free + Pro only, matching home page teaser.
 */
import type { Metadata } from 'next';
import { auth } from '@/auth';
import { Button } from '@/components/ds/Button';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Kryndel pricing: Free plan forever, Pro at $19.99/month. No card required to start.',
  openGraph: {
    title: 'Kryndel Pricing — Free & Pro plans',
    description: 'Start free with 3 contracts. Upgrade to Pro for 20 contracts, all alert channels, 90-day history, REST API and SDK — plus XRPL token-issuer security monitoring (Sentinel).',
    url: 'https://kryndel.dev/pricing',
    type: 'website',
  },
};

const faqItems = [
  {
    q: 'Do I need a credit card to start?',
    a: 'No. The Free plan is free forever — sign up with just your email.',
  },
  {
    q: 'What counts as a "contract watched"?',
    a: 'Each unique contract address you add to your dashboard counts as one slot. You can swap them out any time.',
  },
  {
    q: 'What is Sentinel?',
    a: 'Sentinel watches XRPL token-issuer accounts for critical security changes — regular-key or signer changes, freeze/clawback toggles, blackhole status and supply jumps — with instant alerts and a shareable weekly report. Free covers 1 issuer; Pro covers 25.',
  },
  {
    q: 'What alert channels does Pro include?',
    a: 'Telegram (Free + Pro) and signed outbound webhooks (Pro) for custom integrations are live today. SMS, email and push are on the roadmap.',
  },
  {
    q: 'How does the 90-day history work?',
    a: 'Kryndel stores every indexed event. Pro accounts can query events up to 90 days old via the dashboard and API. Free accounts see the last 7 days.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Cancel from your dashboard settings at any time. You keep Pro features until the end of your billing period.',
  },
  {
    q: 'Is Kryndel open-source?',
    a: 'Yes. The core indexing and alerting engine is Apache-2.0 at github.com/rperezga/kryndel.',
  },
];

export default async function PricingPage() {
  const session = await auth();
  const isLoggedIn = !!session?.user;
  const proCta = isLoggedIn ? '/api/billing/checkout' : '/login?next=/dashboard';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="wrap" style={{ paddingTop: '4rem', paddingBottom: '5rem' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: '3rem' }}>
          <p className="mkt-eyebrow" aria-hidden="true">Pricing</p>
          <h1 className="mkt-h1" style={{ fontSize: 'clamp(2rem,5vw,3rem)', marginBottom: '1rem' }}>
            Start free. Upgrade when you scale.
          </h1>
          <p className="mkt-lead">No card to start. Cancel anytime.</p>
        </div>

        {/* ── Plans — Free + Pro only ── */}
        <section aria-labelledby="plans-heading" style={{ marginBottom: '5rem' }}>
          <h2 id="plans-heading" className="sr-only">Plans</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-[18px] max-w-[760px]">

            {/* Free */}
            <article className="bg-ds-panel border border-solid border-ds-border rounded-[14px] p-6 flex flex-col hover:border-ds-border-on hover:translate-y-[-2px] transition-all duration-200">
              <div className="mb-8">
                <span className="font-ds-mono text-[10px] uppercase font-bold tracking-widest text-ds-text-3 block mb-2">FREE</span>
                <div className="flex items-baseline gap-1">
                  <span className="font-ds-mono text-3xl font-bold text-ds-text">$0</span>
                  <span className="font-ds-mono text-xs text-ds-text-3">/ forever</span>
                </div>
                <p className="text-xs text-ds-text-2 mt-4 leading-relaxed">For hobbyists and individual explorers.</p>
              </div>

              <ul className="flex-grow space-y-3 mb-8 list-none p-0">
                {[
                  '3 contracts watched',
                  '1 token issuer (Sentinel)',
                  'Telegram alerts',
                  '7-day event history',
                  'Public explorer',
                ].map(f => (
                  <li key={f} className="flex items-center gap-2 font-ds-mono text-[11px] text-ds-text-2">
                    <span className="text-ds-green">✓</span> {f}
                  </li>
                ))}
                <li className="flex items-center gap-2 font-ds-mono text-[11px] text-ds-text-3 line-through">
                  <span>✕</span> REST API + SDK
                </li>
              </ul>

              <Button variant="secondary" size="md" asChild className="w-full justify-center">
                <a href="/login">Start free</a>
              </Button>
            </article>

            {/* Pro */}
            <article className="bg-ds-panel-2 border-2 border-solid border-ds-green rounded-[14px] p-6 flex flex-col relative shadow-[0_0_25px_rgba(43,217,111,0.10)]">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-ds-green text-ds-shell px-3 py-0.5 font-ds-mono text-[9px] font-bold tracking-widest uppercase rounded-full">
                Most popular
              </div>

              <div className="mb-8">
                <span className="font-ds-mono text-[10px] uppercase font-bold tracking-widest text-ds-green block mb-2">PRO</span>
                <div className="flex items-baseline gap-1">
                  <span className="font-ds-mono text-3xl font-bold text-ds-text">$19.99</span>
                  <span className="font-ds-mono text-xs text-ds-text-3">/ month</span>
                </div>
                <p className="text-xs text-ds-text-2 mt-4 leading-relaxed">Perfect for serious dapp developers.</p>
              </div>

              <ul className="flex-grow space-y-3 mb-8 list-none p-0">
                {[
                  '20 contracts watched',
                  '25 token issuers (Sentinel)',
                  'Telegram & webhooks',
                  '90-day event history',
                  'REST API + SDK',
                  'Outbound webhooks (HMAC)',
                ].map(f => (
                  <li key={f} className="flex items-center gap-2 font-ds-mono text-[11px] text-ds-text">
                    <span className="text-ds-green">✓</span> {f}
                  </li>
                ))}
              </ul>

              <Button variant="primary" size="md" asChild className="w-full justify-center">
                <a href={proCta}>Get Pro</a>
              </Button>
            </article>

          </div>

          {/* XLS-0101 honest notice */}
          <div className="mt-4 max-w-[760px]">
            <p className="font-ds-mono text-[10px] text-ds-text-3 leading-relaxed">
              <span className="text-ds-amber">◈</span> native XLS-0101: watcher ready, AlphaNet indexing in progress. Pro includes early access.
            </p>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="max-w-3xl" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="mkt-h2" style={{ marginBottom: '2rem' }}>
            Frequently asked questions
          </h2>

          <div className="space-y-3">
            {faqItems.map(({ q, a }, idx) => (
              <details
                key={idx}
                className="group border border-solid border-ds-border bg-ds-panel rounded-[8px] p-4 cursor-pointer select-none transition-colors duration-150"
              >
                <summary className="font-bold text-ds-text flex items-center justify-between text-sm select-none outline-none focus-visible:text-ds-green">
                  <span>{q}</span>
                  <span className="text-ds-text-3 group-open:rotate-180 transition-transform font-ds-mono select-none ml-4 shrink-0">↓</span>
                </summary>
                <div className="mt-3 text-ds-text-2 text-sm leading-relaxed cursor-text select-text border-t border-solid border-ds-border/30 pt-3">
                  {a}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* ── Bottom CTA ── */}
        <div style={{ marginTop: '4rem' }}>
          <p className="mkt-lead" style={{ marginBottom: '1.5rem' }}>
            Questions?{' '}
            <a href="mailto:support@kryndel.dev" className="mkt-link">support@kryndel.dev</a>
          </p>
          <Button size="lg" asChild>
            <a href="/login">Start free →</a>
          </Button>
        </div>

      </div>
    </>
  );
}
