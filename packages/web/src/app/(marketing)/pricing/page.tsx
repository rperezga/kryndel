/**
 * /pricing — Full pricing page with FAQ.
 * Server Component. Auth-aware CTA handled via href logic.
 * FAQPage JSON-LD for SEO.
 */
import type { Metadata } from 'next';
import { auth } from '@/auth';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Kryndel pricing: Free plan forever, Pro at $19/month. No card required to start.',
  openGraph: {
    title: 'Kryndel Pricing — Free & Pro plans',
    description: 'Start free with 3 contracts. Upgrade to Pro for 20 contracts, all alert channels, 90-day history, REST API and SDK.',
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
    a: 'Telegram (Free + Pro), Slack (Pro), Discord (Pro), email (Pro), and signed outbound webhooks (Pro) for custom integrations.',
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

  // Pro CTA: logged-in → billing checkout, logged-out → login with next=/dashboard
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
        <header style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <p className="mkt-eyebrow" aria-hidden="true">Pricing</p>
          <h1 className="mkt-h1" style={{ fontSize: 'clamp(2rem,5vw,3rem)' }}>
            Start free. Upgrade when you scale.
          </h1>
          <p className="mkt-lead" style={{ margin: '1rem auto 0', maxWidth: 520 }}>
            No card required. Cancel anytime. Two plans, zero surprise fees.
          </p>
        </header>

        {/* ── Plans ── */}
        <section aria-labelledby="plans-heading">
          <h2 id="plans-heading" className="sr-only">Plans</h2>
          <div className="mkt-prices mkt-prices-wide" role="list">

            {/* Free */}
            <article className="mkt-price" role="listitem" aria-label="Free plan">
              <p className="mkt-price-name">Free</p>
              <p className="mkt-price-amt">$0<span> / forever</span></p>

              <table className="pricing-table" aria-label="Free plan feature details">
                <tbody>
                  <tr><td>Contracts watched</td><td><strong>3</strong></td></tr>
                  <tr><td>Alert channels</td><td>Telegram</td></tr>
                  <tr><td>Event history</td><td>7 days</td></tr>
                  <tr><td>Explorer access</td><td>✓</td></tr>
                  <tr><td>REST API + SDK</td><td>—</td></tr>
                  <tr><td>Outbound webhooks</td><td>—</td></tr>
                  <tr><td>API rate limit</td><td>—</td></tr>
                </tbody>
              </table>

              <a href="/login" className="mkt-btn mkt-btn-ghost" style={{ display: 'block', textAlign: 'center' }}>
                Start free
              </a>
            </article>

            {/* Pro */}
            <article className="mkt-price mkt-price-pro" role="listitem" aria-label="Pro plan">
              <p className="mkt-price-tag" aria-label="Most popular">Most popular</p>
              <p className="mkt-price-name">Pro</p>
              <p className="mkt-price-amt">$19<span> / month</span></p>

              <table className="pricing-table" aria-label="Pro plan feature details">
                <tbody>
                  <tr><td>Contracts watched</td><td><strong>20</strong></td></tr>
                  <tr><td>Alert channels</td><td>Telegram + Slack + Discord + email + webhook</td></tr>
                  <tr><td>Event history</td><td>90 days</td></tr>
                  <tr><td>Explorer access</td><td>✓</td></tr>
                  <tr><td>REST API + SDK</td><td>✓ Full access</td></tr>
                  <tr><td>Outbound webhooks</td><td>✓ HMAC-signed</td></tr>
                  <tr><td>API rate limit</td><td>120 req / min</td></tr>
                </tbody>
              </table>

              <a
                href={proCta}
                className="mkt-btn mkt-btn-primary"
                style={{ display: 'block', textAlign: 'center' }}
              >
                Go Pro →
              </a>
            </article>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="pricing-faq" aria-labelledby="faq-heading" style={{ marginTop: '4rem' }}>
          <h2 id="faq-heading" className="mkt-h2" style={{ marginBottom: '2rem' }}>
            Frequently asked questions
          </h2>

          <dl className="faq-list">
            {faqItems.map(({ q, a }) => (
              <div key={q} className="faq-item">
                <dt>{q}</dt>
                <dd>{a}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── Bottom CTA ── */}
        <section style={{ textAlign: 'center', marginTop: '4rem' }} aria-label="Sign up call to action">
          <p className="mkt-lead" style={{ marginBottom: '1.5rem' }}>
            Questions? Email us at{' '}
            <a href="mailto:support@kryndel.dev" className="mkt-link">
              support@kryndel.dev
            </a>
          </p>
          <a href="/login" className="mkt-btn mkt-btn-primary mkt-btn-lg">
            Start free →
          </a>
        </section>
      </div>
    </>
  );
}
