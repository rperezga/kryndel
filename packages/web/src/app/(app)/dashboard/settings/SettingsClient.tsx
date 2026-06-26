'use client';
/**
 * SettingsClient — Etapa 11
 * Tabs: Profile | API Keys | Webhooks | Notifications | Billing | Retention
 * Pattern: same role=tab/tabpanel a11y as TraceDetailClient.
 * Uses DS tokens (--ds-*) + Tailwind classes from KRYNDEL-DESIGN-SYSTEM.
 */
import * as React from 'react';
import { useState, useActionState, useTransition } from 'react';
import { StatusChip, Button }                       from '@/components/ds';
import { createApiKey, revokeApiKey, type CreateKeyState } from '../api-keys/actions';

// ── Tab definition ────────────────────────────────────────────────────────────

type TabKey = 'profile' | 'apikeys' | 'webhooks' | 'notifications' | 'billing' | 'retention';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'profile',       label: 'Profile'       },
  { key: 'apikeys',       label: 'API Keys'       },
  { key: 'webhooks',      label: 'Webhooks'       },
  { key: 'notifications', label: 'Notifications'  },
  { key: 'billing',       label: 'Billing'        },
  { key: 'retention',     label: 'Retention'      },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface ApiKeyRow {
  _id: string;
  name: string;
  keyPrefix: string;
  active: boolean;
  lastUsedAt?: string;
  createdAt: string;
}

interface WebhookEndpointRow {
  _id: string;
  url: string;
  secretPrefix: string;
  description?: string;
  active: boolean;
  contractAddresses?: string[];
  eventNames?: string[];
  createdAt: string;
}

interface PlanLimits {
  maxContracts:        number;
  maxRulesPerContract: number;
  historyDays:         number;
  channels:            string[];
}

interface Props {
  email:            string;
  plan:             'free' | 'pro';
  createdAt:        string;
  limits:           PlanLimits;
  hasStripe:        boolean;
  apiKeys:          Record<string, unknown>[];
  webhookEndpoints: Record<string, unknown>[];
}

// ── Helper: relative date ─────────────────────────────────────────────────────

function relDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return iso;
  }
}

// ── Copy-once helper ──────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="px-2 py-0.5 border border-solid border-ds-border hover:border-ds-green text-ds-text-3 hover:text-ds-green text-[9px] font-ds-mono uppercase rounded transition-all outline-none focus-visible:ring-1 focus-visible:ring-ds-green"
      aria-label="Copy to clipboard"
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}

// ── Plan badge ────────────────────────────────────────────────────────────────

function PlanBadge({ plan }: { plan: 'free' | 'pro' }) {
  return (
    <span className={`px-2 py-0.5 border border-solid rounded-full font-ds-mono text-[9px] uppercase tracking-wider font-bold ${
      plan === 'pro'
        ? 'border-ds-green/40 text-ds-green bg-ds-green/5'
        : 'border-ds-text-3/40 text-ds-text-3 bg-ds-text-3/5'
    }`}>
      {plan}
    </span>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, description, children }: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-ds-panel border border-solid border-ds-border rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-0 border-b border-solid border-ds-border/50">
        <h3 className="font-ds-sans text-sm font-bold text-ds-text m-0">{title}</h3>
        {description && (
          <p className="font-ds-mono text-[10px] text-ds-text-3 mt-1 m-0">{description}</p>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Coming-soon chip ─────────────────────────────────────────────────────────

function ComingSoon() {
  return (
    <span className="px-2 py-0.5 border border-solid border-ds-text-3/30 text-ds-text-3 font-ds-mono text-[9px] uppercase rounded-full tracking-wider">
      Coming soon
    </span>
  );
}

// ── Field row ─────────────────────────────────────────────────────────────────

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-3 border-0 border-b border-solid border-ds-border/30 last:border-0">
      <span className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-wider font-bold w-40 shrink-0">
        {label}
      </span>
      <div className="flex-1 font-ds-mono text-xs text-ds-text flex items-center gap-2 flex-wrap">
        {children}
      </div>
    </div>
  );
}

// ── Tab: Profile ─────────────────────────────────────────────────────────────

function ProfileTab({ email, plan, createdAt }: { email: string; plan: 'free' | 'pro'; createdAt: string }) {
  return (
    <div className="space-y-4">
      <Section title="Account" description="Your Kryndel workspace identity">
        <FieldRow label="Email">
          <span className="text-ds-text">{email}</span>
          <CopyButton text={email} />
        </FieldRow>
        <FieldRow label="Plan">
          <PlanBadge plan={plan} />
          {plan === 'free' && (
            <a
              href="/pricing"
              className="text-ds-green font-ds-mono text-[10px] no-underline hover:underline"
            >
              Upgrade to Pro · $19.99/mo →
            </a>
          )}
        </FieldRow>
        <FieldRow label="Member since">
          <span className="text-ds-text-2">{relDate(createdAt)}</span>
        </FieldRow>
      </Section>

      <Section title="Workspace" description="Single-user workspace — team RBAC coming in a future release">
        <div className="flex items-center gap-3 py-2">
          <div className="w-8 h-8 bg-ds-green/10 border border-solid border-ds-green/40 flex items-center justify-center rounded font-ds-mono text-xs text-ds-green font-bold select-none">
            {email[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <div className="font-ds-mono text-xs text-ds-text">{email}</div>
            <div className="font-ds-mono text-[9px] text-ds-text-3 uppercase tracking-wider">Owner</div>
          </div>
          <PlanBadge plan={plan} />
        </div>
        <p className="font-ds-mono text-[10px] text-ds-text-3 mt-3 m-0">
          Multi-member workspaces with RBAC roles are planned for a future release.
        </p>
      </Section>
    </div>
  );
}

// ── Tab: API Keys ─────────────────────────────────────────────────────────────

function ApiKeysTab({ plan, apiKeys }: { plan: 'free' | 'pro'; apiKeys: Record<string, unknown>[] }) {
  const keys = apiKeys as unknown as ApiKeyRow[];
  const isPro = plan === 'pro';
  const initialState: CreateKeyState = {};
  const [state, formAction, isPending] = useActionState(createApiKey, initialState);

  return (
    <div className="space-y-4">
      <Section
        title="API Keys"
        description="Authenticate REST API v1 calls. Pro plan only."
      >
        {!isPro && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border border-solid border-ds-amber/30 bg-ds-amber/5 rounded-lg">
            <div>
              <div className="font-ds-mono text-[10px] text-ds-amber uppercase tracking-wider font-bold mb-1">Pro feature</div>
              <p className="font-ds-sans text-xs text-ds-text-2 m-0">
                Create API keys and access the REST API with a Pro plan.
              </p>
            </div>
            <a
              href="/pricing"
              className="border border-solid border-ds-amber text-ds-amber font-ds-mono text-[10px] px-4 py-2 hover:bg-ds-amber/10 rounded no-underline transition-colors font-bold uppercase shrink-0"
            >
              Upgrade · $19.99/mo
            </a>
          </div>
        )}

        {isPro && (
          <>
            {/* Show new key once */}
            {state.rawKey && (
              <div className="p-4 border border-solid border-ds-green/40 bg-ds-green/5 rounded-lg mb-4 space-y-2">
                <div className="font-ds-mono text-[10px] text-ds-green font-bold uppercase tracking-wider">
                  Key created — copy now, you won't see it again
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 font-ds-mono text-xs text-ds-text bg-ds-shell border border-solid border-ds-border rounded px-3 py-2 break-all select-all">
                    {state.rawKey}
                  </code>
                  <CopyButton text={state.rawKey} />
                </div>
              </div>
            )}

            {state.error && (
              <div className="p-3 border border-solid border-ds-red/30 bg-ds-red/5 text-ds-red font-ds-mono text-xs rounded mb-4">
                {state.error}
              </div>
            )}

            {/* Create form */}
            <form action={formAction} className="flex gap-2 mb-4">
              <input
                name="name"
                placeholder="Key name (e.g. production, ci-bot)"
                required
                disabled={isPending}
                className="flex-1 min-w-0 bg-ds-shell border border-solid border-ds-border rounded px-3 py-2 text-xs font-ds-mono text-ds-text focus:border-ds-green outline-none focus-visible:ring-1 focus-visible:ring-ds-green disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isPending}
                className="shrink-0 px-4 py-2 bg-ds-green text-ds-shell font-ds-mono text-xs font-bold rounded hover:bg-ds-green/90 disabled:opacity-50 cursor-pointer border-0 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ds-green"
              >
                {isPending ? 'Creating…' : 'Create'}
              </button>
            </form>

            {/* Keys table */}
            {keys.length === 0 ? (
              <p className="font-ds-mono text-[10px] text-ds-text-3">No API keys yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-ds-mono border-collapse">
                  <thead>
                    <tr className="border-0 border-b border-solid border-ds-border">
                      <th className="text-left py-2 px-3 text-ds-text-3 text-[10px] uppercase tracking-wider font-bold">Name</th>
                      <th className="text-left py-2 px-3 text-ds-text-3 text-[10px] uppercase tracking-wider font-bold">Prefix</th>
                      <th className="text-left py-2 px-3 text-ds-text-3 text-[10px] uppercase tracking-wider font-bold hidden sm:table-cell">Last used</th>
                      <th className="text-left py-2 px-3 text-ds-text-3 text-[10px] uppercase tracking-wider font-bold">Status</th>
                      <th className="py-2 px-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {keys.map(k => (
                      <tr key={k._id} className="border-0 border-b border-solid border-ds-border/30 hover:bg-ds-panel-2/50 transition-colors">
                        <td className="py-2.5 px-3 text-ds-text">{k.name}</td>
                        <td className="py-2.5 px-3 text-ds-green bg-ds-shell/30 rounded-sm">{k.keyPrefix}…</td>
                        <td className="py-2.5 px-3 text-ds-text-3 hidden sm:table-cell">
                          {k.lastUsedAt ? relDate(k.lastUsedAt) : 'Never'}
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusChip status={k.active ? 'ok' : 'neutral'} label={k.active ? 'ACTIVE' : 'REVOKED'} />
                        </td>
                        <td className="py-2.5 px-3">
                          {k.active && (
                            <form action={revokeApiKey} style={{ display: 'inline' }}>
                              <input type="hidden" name="id" value={k._id} />
                              <button
                                type="submit"
                                className="px-2.5 py-1 border border-solid border-ds-border hover:border-ds-red/50 hover:text-ds-red text-ds-text-3 font-ds-mono text-[9px] uppercase rounded cursor-pointer bg-transparent transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ds-red"
                              >
                                Revoke
                              </button>
                            </form>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="font-ds-mono text-[9px] text-ds-text-3 mt-3 m-0">
              Max 5 active keys per account. Include your key as{' '}
              <code className="text-ds-green bg-ds-shell px-1 rounded">Authorization: Bearer {'<key>'}</code>.{' '}
              <a href="/api/v1/openapi.json" target="_blank" rel="noreferrer" className="text-ds-green hover:underline">API spec →</a>
            </p>
          </>
        )}
      </Section>
    </div>
  );
}

// ── Tab: Webhooks ─────────────────────────────────────────────────────────────

function WebhooksTab({ plan, webhookEndpoints }: { plan: 'free' | 'pro'; webhookEndpoints: Record<string, unknown>[] }) {
  const endpoints = webhookEndpoints as unknown as WebhookEndpointRow[];
  const isPro = plan === 'pro';

  return (
    <div className="space-y-4">
      <Section
        title="Webhook Endpoints"
        description="HMAC-SHA256 signed outbound hooks. Pro plan only."
      >
        {!isPro ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border border-solid border-ds-amber/30 bg-ds-amber/5 rounded-lg">
            <div>
              <div className="font-ds-mono text-[10px] text-ds-amber uppercase tracking-wider font-bold mb-1">Pro feature</div>
              <p className="font-ds-sans text-xs text-ds-text-2 m-0">
                Register HTTPS endpoints and receive signed event payloads in real-time.
              </p>
            </div>
            <a
              href="/pricing"
              className="border border-solid border-ds-amber text-ds-amber font-ds-mono text-[10px] px-4 py-2 hover:bg-ds-amber/10 rounded no-underline transition-colors font-bold uppercase shrink-0"
            >
              Upgrade · $19.99/mo
            </a>
          </div>
        ) : endpoints.length === 0 ? (
          <div className="space-y-3">
            <p className="font-ds-mono text-[10px] text-ds-text-3">No webhook endpoints registered.</p>
            <a
              href="/dashboard/webhooks"
              className="inline-block border border-solid border-ds-green text-ds-green font-ds-mono text-[10px] px-4 py-2 hover:bg-ds-green/10 rounded no-underline transition-colors font-bold uppercase"
            >
              Go to Webhooks →
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {endpoints.map(ep => (
              <div key={ep._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-ds-shell border border-solid border-ds-border rounded-lg">
                <div className="space-y-1 min-w-0">
                  <div className="font-ds-mono text-xs text-ds-green font-semibold break-all">{ep.url}</div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-ds-mono text-[9px] text-ds-text-3">
                      Secret: <code className="text-ds-text-2 bg-ds-panel px-1 rounded">whsec_{ep.secretPrefix}…</code>
                    </span>
                    <StatusChip status={ep.active ? 'ok' : 'neutral'} label={ep.active ? 'ACTIVE' : 'PAUSED'} />
                  </div>
                </div>
              </div>
            ))}
            <a
              href="/dashboard/webhooks"
              className="inline-block border border-solid border-ds-border text-ds-text-2 font-ds-mono text-[10px] px-4 py-2 hover:border-ds-green hover:text-ds-green rounded no-underline transition-colors"
            >
              Manage webhooks →
            </a>
          </div>
        )}
      </Section>

      <Section title="Signature Verification" description="How to verify X-Kryndel-Signature on your server">
        <p className="font-ds-sans text-xs text-ds-text-2 leading-relaxed m-0">
          Every POST includes <code className="font-ds-mono text-ds-green bg-ds-shell px-1 rounded text-[10px]">X-Kryndel-Signature</code> (HMAC-SHA256 of body)
          and <code className="font-ds-mono text-ds-green bg-ds-shell px-1 rounded text-[10px]">X-Kryndel-Timestamp</code> (Unix ms).
          Verify within a 5-minute drift window to block replay attacks.
        </p>
      </Section>
    </div>
  );
}

// ── Tab: Notifications ────────────────────────────────────────────────────────

function NotificationsTab({ plan }: { plan: 'free' | 'pro' }) {
  const channels = [
    {
      id: 'telegram',
      label: 'Telegram',
      icon: '✈',
      available: true,
      description: 'Alert delivery via Telegram bot. Configure TELEGRAM_CHAT_ID in your deployment.',
    },
    {
      id: 'slack',
      label: 'Slack',
      icon: '#',
      available: false,
      description: 'Incoming webhook to a Slack channel.',
    },
    {
      id: 'discord',
      label: 'Discord',
      icon: '⬡',
      available: false,
      description: 'Discord channel webhook delivery.',
    },
    {
      id: 'email',
      label: 'Email',
      icon: '@',
      available: false,
      description: 'Direct email delivery via Resend.',
    },
  ];

  return (
    <div className="space-y-4">
      <Section
        title="Alert Channels"
        description="Destinations where Kryndel dispatches rule match notifications"
      >
        <div className="space-y-3">
          {channels.map(ch => (
            <div
              key={ch.id}
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border border-solid rounded-lg ${
                ch.available
                  ? 'border-ds-green/30 bg-ds-green/5'
                  : 'border-ds-border bg-ds-shell/30'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className={`w-7 h-7 flex items-center justify-center rounded border border-solid font-ds-mono text-sm shrink-0 ${
                  ch.available ? 'border-ds-green/40 text-ds-green' : 'border-ds-border text-ds-text-3'
                }`}>
                  {ch.icon}
                </span>
                <div>
                  <div className="font-ds-mono text-xs font-bold text-ds-text flex items-center gap-2">
                    {ch.label}
                    {ch.available
                      ? <StatusChip status="ok" label="ACTIVE" />
                      : <ComingSoon />
                    }
                  </div>
                  <p className="font-ds-sans text-[11px] text-ds-text-3 m-0 mt-1 leading-relaxed">
                    {ch.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="font-ds-mono text-[9px] text-ds-text-3 mt-4 m-0">
          Free plan: Telegram only. Pro plan: Telegram + webhook + Discord + email (when available).
        </p>
      </Section>
    </div>
  );
}

// ── Tab: Billing ──────────────────────────────────────────────────────────────

function BillingTab({ plan, hasStripe }: { plan: 'free' | 'pro'; hasStripe: boolean }) {
  const [pending, setPending] = useState<'checkout' | 'portal' | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  async function click(kind: 'checkout' | 'portal') {
    setPending(kind); setError(null);
    const endpoint = kind === 'checkout' ? '/api/billing/checkout' : '/api/billing/portal';
    const res  = await fetch(endpoint, { method: 'POST' }).catch(() => null);
    if (!res) { setError('Network error.'); setPending(null); return; }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error ?? 'Could not start billing flow.'); setPending(null); return; }
    if (data.url) window.location.assign(data.url);
    setPending(null);
  }

  return (
    <div className="space-y-4">
      <Section title="Subscription" description="Manage your Kryndel plan">
        <FieldRow label="Current plan">
          <PlanBadge plan={plan} />
          <span className="font-ds-mono text-xs text-ds-text-2">
            {plan === 'pro' ? '$19.99 / month' : '$0 / month'}
          </span>
        </FieldRow>
        <FieldRow label="Features">
          <span className="font-ds-mono text-xs text-ds-text-2">
            {plan === 'pro'
              ? '20 contracts · 10 rules/contract · 90-day history · webhooks · API keys'
              : '3 contracts · 1 rule/contract · 7-day history · Telegram alerts'}
          </span>
        </FieldRow>

        {error && (
          <div className="mt-3 p-3 border border-solid border-ds-red/30 bg-ds-red/5 text-ds-red font-ds-mono text-xs rounded">
            {error}
          </div>
        )}

        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          {plan === 'free' ? (
            <button
              onClick={() => click('checkout')}
              disabled={pending !== null}
              className="px-5 py-2.5 bg-ds-green text-ds-shell font-ds-mono text-xs font-bold rounded hover:bg-ds-green/90 disabled:opacity-50 cursor-pointer border-0 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ds-green"
            >
              {pending === 'checkout' ? 'Loading…' : 'Upgrade to Pro · $19.99/mo'}
            </button>
          ) : (
            <button
              onClick={() => click('portal')}
              disabled={pending !== null}
              className="px-5 py-2.5 border border-solid border-ds-border hover:border-ds-green text-ds-text-2 hover:text-ds-green font-ds-mono text-xs rounded disabled:opacity-50 cursor-pointer bg-transparent transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ds-green"
            >
              {pending === 'portal' ? 'Loading…' : 'Manage subscription →'}
            </button>
          )}
        </div>
      </Section>

      <Section title="Pricing" description="Honest, flat pricing — no hidden fees">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Free */}
          <div className={`p-4 border border-solid rounded-lg space-y-3 ${plan === 'free' ? 'border-ds-green/40 bg-ds-green/5' : 'border-ds-border'}`}>
            <div className="flex items-center justify-between">
              <span className="font-ds-mono text-sm font-bold text-ds-text">Free</span>
              <span className="font-ds-mono text-lg font-bold text-ds-text">$0<span className="text-[10px] text-ds-text-3 font-normal">/mo</span></span>
            </div>
            <ul className="font-ds-mono text-[10px] text-ds-text-2 space-y-1.5 m-0 p-0 list-none">
              <li>✓ 3 contracts</li>
              <li>✓ 1 alert rule / contract</li>
              <li>✓ 7-day event history</li>
              <li>✓ Telegram alerts</li>
              <li className="text-ds-text-3">✗ API keys</li>
              <li className="text-ds-text-3">✗ Webhooks</li>
            </ul>
            {plan === 'free' && (
              <div className="font-ds-mono text-[9px] text-ds-green font-bold uppercase tracking-wider">Current plan</div>
            )}
          </div>

          {/* Pro */}
          <div className={`p-4 border border-solid rounded-lg space-y-3 ${plan === 'pro' ? 'border-ds-green/40 bg-ds-green/5' : 'border-ds-border'}`}>
            <div className="flex items-center justify-between">
              <span className="font-ds-mono text-sm font-bold text-ds-text">Pro</span>
              <span className="font-ds-mono text-lg font-bold text-ds-green">$19.99<span className="text-[10px] text-ds-text-3 font-normal">/mo</span></span>
            </div>
            <ul className="font-ds-mono text-[10px] text-ds-text-2 space-y-1.5 m-0 p-0 list-none">
              <li>✓ 20 contracts</li>
              <li>✓ 10 alert rules / contract</li>
              <li>✓ 90-day event history</li>
              <li>✓ Telegram + webhook + more</li>
              <li>✓ API keys (REST v1)</li>
              <li>✓ HMAC-signed webhooks</li>
            </ul>
            {plan === 'pro' && (
              <div className="font-ds-mono text-[9px] text-ds-green font-bold uppercase tracking-wider">Current plan</div>
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}

// ── Tab: Retention ────────────────────────────────────────────────────────────

function RetentionTab({ plan, limits }: { plan: 'free' | 'pro'; limits: PlanLimits }) {
  const rows = [
    { label: 'Event history',     value: `${limits.historyDays} days`,                  note: 'Events older than this are hidden from queries.' },
    { label: 'Max contracts',     value: `${limits.maxContracts}`,                      note: 'Simultaneous monitored contracts.' },
    { label: 'Alert rules',       value: `${limits.maxRulesPerContract} / contract`,    note: 'Alert rules per monitored contract.' },
    { label: 'Alert channels',    value: limits.channels.join(', '),                    note: 'Active dispatch destinations.' },
    { label: 'Tx traces',         value: 'Unlimited',                                   note: 'Trace count is not rate-limited.' },
    { label: 'API rate limit',    value: plan === 'pro' ? '300 req/min' : 'N/A',        note: 'REST API v1 (Pro only).' },
  ];

  return (
    <div className="space-y-4">
      <Section
        title="Plan Limits"
        description={`Limits for your current ${plan.toUpperCase()} plan`}
      >
        <div className="space-y-0">
          {rows.map(row => (
            <div
              key={row.label}
              className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-3 border-0 border-b border-solid border-ds-border/30 last:border-0"
            >
              <span className="font-ds-mono text-[10px] text-ds-text-3 uppercase tracking-wider font-bold w-36 shrink-0">
                {row.label}
              </span>
              <span className="font-ds-mono text-xs text-ds-green font-bold w-32 shrink-0">
                {row.value}
              </span>
              <span className="font-ds-sans text-[11px] text-ds-text-3 leading-relaxed">
                {row.note}
              </span>
            </div>
          ))}
        </div>

        {plan === 'free' && (
          <div className="mt-4 p-4 border border-solid border-ds-amber/30 bg-ds-amber/5 rounded-lg flex items-start gap-3">
            <span className="font-ds-mono text-ds-amber text-lg shrink-0">⚡</span>
            <div>
              <div className="font-ds-mono text-[10px] text-ds-amber font-bold uppercase tracking-wider mb-1">
                Unlock higher limits
              </div>
              <p className="font-ds-sans text-xs text-ds-text-2 m-0">
                Upgrade to Pro for 20 contracts, 10 rules/contract, 90-day history, and REST API access.{' '}
                <a href="/pricing" className="text-ds-green hover:underline">See pricing →</a>
              </p>
            </div>
          </div>
        )}
      </Section>

      <Section title="Data Retention Notes" description="Honest information about your data">
        <ul className="font-ds-sans text-xs text-ds-text-2 space-y-2 m-0 pl-4 leading-relaxed">
          <li>Raw events are stored in MongoDB Atlas with your plan retention window.</li>
          <li>Tx traces are stored per-hash; you can re-run a trace at any time.</li>
          <li>Webhook delivery logs are retained for 30 days regardless of plan.</li>
          <li>Deleting a contract removes its alert rules but NOT its historical events.</li>
        </ul>
      </Section>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function SettingsClient({
  email,
  plan,
  createdAt,
  limits,
  hasStripe,
  apiKeys,
  webhookEndpoints,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('profile');

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-2">
      {/* Page header */}
      <div>
        <h1 className="font-ds-sans text-xl font-bold text-ds-text m-0">Settings</h1>
        <p className="font-ds-mono text-[10px] text-ds-text-3 mt-1 m-0">
          {email} · <PlanBadge plan={plan} />
        </p>
      </div>

      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Settings sections"
        className="flex gap-1 overflow-x-auto pb-1 scrollbar-none border-0 border-b border-solid border-ds-border"
      >
        {TABS.map(tab => (
          <button
            key={tab.key}
            role="tab"
            id={`settings-tab-${tab.key}`}
            aria-selected={activeTab === tab.key}
            aria-controls={`settings-panel-${tab.key}`}
            onClick={() => setActiveTab(tab.key)}
            className={[
              'shrink-0 px-3 py-2 font-ds-mono text-[11px] uppercase tracking-wider font-bold rounded-t transition-colors border-0 cursor-pointer outline-none',
              'focus-visible:ring-1 focus-visible:ring-ds-green',
              activeTab === tab.key
                ? 'text-ds-green bg-ds-panel border-b-2 border-solid border-ds-green mb-[-1px]'
                : 'text-ds-text-3 hover:text-ds-text bg-transparent',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {TABS.map(tab => (
        <div
          key={tab.key}
          role="tabpanel"
          id={`settings-panel-${tab.key}`}
          aria-labelledby={`settings-tab-${tab.key}`}
          hidden={activeTab !== tab.key}
        >
          {activeTab === tab.key && (
            <>
              {tab.key === 'profile'       && <ProfileTab email={email} plan={plan} createdAt={createdAt} />}
              {tab.key === 'apikeys'       && <ApiKeysTab plan={plan} apiKeys={apiKeys} />}
              {tab.key === 'webhooks'      && <WebhooksTab plan={plan} webhookEndpoints={webhookEndpoints} />}
              {tab.key === 'notifications' && <NotificationsTab plan={plan} />}
              {tab.key === 'billing'       && <BillingTab plan={plan} hasStripe={hasStripe} />}
              {tab.key === 'retention'     && <RetentionTab plan={plan} limits={limits} />}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
