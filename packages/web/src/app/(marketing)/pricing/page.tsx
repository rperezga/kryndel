/**
 * /pricing — Full pricing page with FAQ.
 * Server Component. Auth-aware CTA handled via href logic.
 * FAQPage JSON-LD for SEO.
 */
import type { Metadata } from 'next';
import { auth } from '@/auth';
import { Button } from '@/components/ds/Button';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Kryndel pricing: Free plan forever, Pro at $19/month. No card required to start.',
  openGraph: {
    title: 'Kryndel Pricing — Free & Pro plans',
    description:
      'Start free with 3 contracts. Upgrade to Pro for 20 contracts, all alert channels, 90-day history, REST API and SDK.',
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
    q: 'What alert channels does Pro include?',
    a: 'Telegram (Free + Pro) and signed outbound webhooks (Pro) for custom integrations are live today. SMS, email and push are on the roadmap.',
  },
  {
    q: 'What is the REST API and SDK?',
    a: 'Pro accounts get API keys, access to /api/v1/* endpoints (contracts, events, rules, webhooks, me), and the @kryndel/sdk TypeScript package for building your own integrations.',
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
    a: 'Yes. The core indexing and alerting engine is Apache-2.0 at github.com/rperezga/kryndel. The hosted cloud service adds the dashboard, worker, and API.',
  },
];

export default async function PricingPage() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  // Pro CTA: logged-in → billing checkout (GET redirect), logged-out → login with next=/dashboard
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
        <header style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <p className="mkt-eyebrow" aria-hidden="true">Pricing</p>
          <h1 className="mkt-h1" style={{ fontSize: 'clamp(2rem,5vw,3rem)' }}>
            Scalable Observability Pricing
          </h1>
          <p className="mkt-lead" style={{ margin: '1rem auto 0', maxWidth: 640 }}>
            Real-time XRPL stream ingestion and debugging tools. Select a plan that fits your developer workflow or enterprise-grade requirements.
          </p>
          
          {/* Note explaining monthly-only billing configuration */}
          <div className="inline-block mt-6 px-3 py-1 bg-ds-panel border border-solid border-ds-border rounded-[6px] text-xs font-ds-mono text-ds-text-3">
            STRIPE_BILLING: monthly_only (no annual plan configured in system)
          </div>
        </header>

        {/* ── Pricing Grid ── */}
        <section aria-labelledby="plans-heading" className="mb-20">
          <h2 id="plans-heading" className="sr-only">Plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[18px]">

            {/* Free Plan */}
            <div className="bg-ds-panel border border-solid border-ds-border p-6 rounded-[14px] flex flex-col hover:border-ds-border-on hover:translate-y-[-2px] transition-all duration-200">
              <div className="mb-8">
                <span className="font-ds-mono text-[10px] uppercase font-bold tracking-widest text-ds-text-3 block mb-2">FREE</span>
                <div className="flex items-baseline gap-1">
                  <span className="font-ds-mono text-3xl font-bold text-ds-text">$0</span>
                  <span className="font-ds-mono text-xs text-ds-text-3">/mo</span>
                </div>
                <p className="text-xs text-ds-text-2 mt-4 leading-relaxed">For hobbyists and individual explorers.</p>
              </div>

              <ul className="flex-grow space-y-3 mb-8 list-none p-0">
                <li className="flex items-center gap-2 font-ds-mono text-[11px] text-ds-text-2">
                  <span className="text-ds-green">✓</span> 3 contracts watched
                </li>
                <li className="flex items-center gap-2 font-ds-mono text-[11px] text-ds-text-2">
                  <span className="text-ds-green">✓</span> Telegram alerts
                </li>
                <li className="flex items-center gap-2 font-ds-mono text-[11px] text-ds-text-2">
                  <span className="text-ds-green">✓</span> 7-day event history
                </li>
                <li className="flex items-center gap-2 font-ds-mono text-[11px] text-ds-text-2">
                  <span className="text-ds-green">✓</span> Public explorer
                </li>
                <li className="flex items-center gap-2 font-ds-mono text-[11px] text-ds-text-3 line-through">
                  <span>✕</span> REST API + SDK
                </li>
              </ul>

              <Button variant="secondary" size="md" asChild className="w-full justify-center">
                <a href="/login">Start free</a>
              </Button>
            </div>

            {/* Pro Plan ($19) */}
            <div className="bg-ds-panel-2 border-2 border-solid border-ds-green p-6 rounded-[14px] flex flex-col relative scale-105 shadow-[0_0_25px_rgba(43,217,111,0.12)]">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-ds-green text-ds-shell px-3 py-0.5 font-ds-mono text-[9px] font-bold tracking-widest uppercase">
                RECOMMENDED
              </div>
              
              <div className="mb-8">
                <span className="font-ds-mono text-[10px] uppercase font-bold tracking-widest text-ds-green block mb-2">PRO</span>
                <div className="flex items-baseline gap-1">
                  <span className="font-ds-mono text-3xl font-bold text-ds-text">$19</span>
                  <span className="font-ds-mono text-xs text-ds-text-3">/mo</span>
                </div>
                <p className="text-xs text-ds-text-2 mt-4 leading-relaxed">Perfect for serious dapp developers.</p>
              </div>

              <ul className="flex-grow space-y-3 mb-8 list-none p-0">
                <li className="flex items-center gap-2 font-ds-mono text-[11px] text-ds-text">
                  <span className="text-ds-green">✓</span> 20 contracts watched
                </li>
                <li className="flex items-center gap-2 font-ds-mono text-[11px] text-ds-text">
                  <span className="text-ds-green">✓</span> Telegram &amp; webhooks (SMS, email, push soon)
                </li>
                <li className="flex items-center gap-2 font-ds-mono text-[11px] text-ds-text">
                  <span className="text-ds-green">✓</span> 90-day event history
                </li>
                <li className="flex items-center gap-2 font-ds-mono text-[11px] text-ds-text">
                  <span className="text-ds-green">✓</span> REST API + SDK
                </li>
                <li className="flex items-center gap-2 font-ds-mono text-[11px] text-ds-text">
                  <span className="text-ds-green">✓</span> Outbound webhooks (HMAC)
                </li>
              </ul>

              <Button variant="primary" size="md" asChild className="w-full justify-center">
                <a href={proCta}>Select Pro</a>
              </Button>
            </div>

            {/* Team Plan (Contact Support) */}
            <div className="bg-ds-panel border border-solid border-ds-border p-6 rounded-[14px] flex flex-col hover:border-ds-border-on hover:translate-y-[-2px] transition-all duration-200">
              <div className="mb-8">
                <span className="font-ds-mono text-[10px] uppercase font-bold tracking-widest text-ds-text-3 block mb-2">TEAM</span>
                <div className="flex items-baseline gap-1">
                  <span className="font-ds-mono text-3xl font-bold text-ds-text">Contact</span>
                </div>
                <p className="text-xs text-ds-text-2 mt-4 leading-relaxed">Collaborative tools for small studios.</p>
              </div>

              <ul className="flex-grow space-y-3 mb-8 list-none p-0">
                <li className="flex items-center gap-2 font-ds-mono text-[11px] text-ds-text-2">
                  <span className="text-ds-green">✓</span> Up to 5 Team Members
                </li>
                <li className="flex items-center gap-2 font-ds-mono text-[11px] text-ds-text-2">
                  <span className="text-ds-green">✓</span> Shared Dashboards
                </li>
                <li className="flex items-center gap-2 font-ds-mono text-[11px] text-ds-text-2">
                  <span className="text-ds-green">✓</span> API Key Management
                </li>
                <li className="flex items-center gap-2 font-ds-mono text-[11px] text-ds-text-2">
                  <span className="text-ds-green">✓</span> Advanced Alerts
                </li>
              </ul>

              <Button variant="secondary" size="md" asChild className="w-full justify-center">
                <a href="mailto:support@kryndel.dev?subject=Kryndel%20Team%20Plan%20Inquiry">Contact support</a>
              </Button>
            </div>

            {/* Enterprise Plan (Contact Support) */}
            <div className="bg-ds-panel border border-solid border-ds-border p-6 rounded-[14px] flex flex-col hover:border-ds-border-on hover:translate-y-[-2px] transition-all duration-200">
              <div className="mb-8">
                <span className="font-ds-mono text-[10px] uppercase font-bold tracking-widest text-ds-text-3 block mb-2">ENTERPRISE</span>
                <div className="flex items-baseline gap-1">
                  <span className="font-ds-mono text-3xl font-bold text-ds-text">Custom</span>
                </div>
                <p className="text-xs text-ds-text-2 mt-4 leading-relaxed">Unrestricted access for large scale ops.</p>
              </div>

              <ul className="flex-grow space-y-3 mb-8 list-none p-0">
                <li className="flex items-center gap-2 font-ds-mono text-[11px] text-ds-text-2">
                  <span className="text-ds-green">✓</span> Unlimited req/min
                </li>
                <li className="flex items-center gap-2 font-ds-mono text-[11px] text-ds-text-2">
                  <span className="text-ds-green">✓</span> Full Ledger History
                </li>
                <li className="flex items-center gap-2 font-ds-mono text-[11px] text-ds-text-2">
                  <span className="text-ds-green">✓</span> Dedicated Node Access
                </li>
                <li className="flex items-center gap-2 font-ds-mono text-[11px] text-ds-text-2">
                  <span className="text-ds-green">✓</span> 24/7 SLA Support
                </li>
              </ul>

              <Button variant="secondary" size="md" asChild className="w-full justify-center">
                <a href="mailto:support@kryndel.dev?subject=Kryndel%20Enterprise%20Plan%20Inquiry">Contact support</a>
              </Button>
            </div>

          </div>
        </section>

        {/* ── FAQ Section ── */}
        <section className="max-w-3xl mx-auto" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="mkt-h2 text-center" style={{ marginBottom: '2.5rem' }}>
            Frequently Asked Questions
          </h2>

          <div className="space-y-4">
            {faqItems.map(({ q, a }, idx) => (
              <details
                key={idx}
                className="faq-item group border border-solid border-ds-border bg-ds-panel rounded-[8px] p-4 transition-colors duration-150 select-none cursor-pointer"
              >
                <summary className="font-bold text-ds-text flex items-center justify-between text-base select-none outline-none focus-visible:text-ds-green">
                  <span>{q}</span>
                  <span className="text-ds-text-3 group-open:rotate-180 transition-transform font-ds-mono select-none">
                    ↓
                  </span>
                </summary>
                <div className="mt-3 text-ds-text-2 text-sm leading-relaxed cursor-text select-text border-t border-solid border-ds-border/30 pt-3">
                  {a}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* ── Bottom CTA ── */}
        <section style={{ textAlign: 'center', marginTop: '5rem' }} aria-label="Sign up call to action">
          <p className="mkt-lead" style={{ marginBottom: '1.5rem', marginLeft: 'auto', marginRight: 'auto' }}>
            Questions? Email us at{' '}
            <a href="mailto:support@kryndel.dev" className="mkt-link">
              support@kryndel.dev
            </a>
          </p>
          <Button size="lg" asChild>
            <a href="/login">Start free &rarr;</a>
          </Button>
        </section>
      </div>
    </>
  );
}
