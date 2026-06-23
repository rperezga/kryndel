# Kryndel v0.4.0 — "Live console" redesign + public Explorer

This release rebuilds Kryndel's entire interface around a single design language — a
live, console/oscilloscope aesthetic (phosphor green, JetBrains Mono for data, honest
metrics) — and ships a redesigned public explorer. The backend (named-event decoding,
ABI handling, tx tracing, signed webhooks, billing, REST API) is unchanged; this is a
UI + surface restructure, validated stage by stage against Vercel preview builds.

## Highlights

- **Redesigned landing** — live-console hero with real streaming metrics (block height,
  events/min, p95, uptime), honest XLS-0101 status note, and a clear Detect → Decode →
  Alert → Replay narrative.
- **New public Explorer** — universal search (EVM address / native r-address / X-address /
  tx hash / selector / event name), latest blocks/tx/events, contract pages with 8 tabs
  (Overview · Events · Calls · State · Alerts · ABI · Source · Raw), and dedicated
  tx / event / address pages.
- **Tx Traces in-app** — paste a hash to get a readable timeline (call → event → emit →
  alert match), decoded logs, and raw JSON.
- **Settings** — 6 tabs (Profile · API Keys · Webhooks · Notifications · Billing ·
  Retention), reusing the existing API-key, webhook and Stripe billing flows.
- **Full mobile pass** — 5-item bottom navigation with safe-area insets, scrollable tabs,
  cards instead of wide tables, and a no-horizontal-bleed clamp at small widths.
- **Admin activity panel** (`/admin`, gated by `ADMIN_EMAIL`) — users, signups, logins,
  product usage and webhook delivery health, plus **Vercel Web Analytics** for traffic.

## Fixes

- **Sign-out** now uses a NextAuth v5 Server Action (`signOut`) instead of a plain form
  POST that silently failed on CSRF.
- **Login tracking** — a `signIn` event records logins (JWT sessions aren't stored in the
  DB), so the admin panel can show real activity.
- **Honest channel copy** — landing and pricing now reflect what's actually live today
  (Telegram + signed webhooks) and mark Slack, Discord and email as coming soon.

## Notes

- **Live:** XRPL EVM Sidechain mainnet — index, decode, trace and alert end to end.
- **Pending:** native XLS-0101 full decode awaits AlphaNet availability (the watcher is
  ready and this is stated honestly across the product).
- **Stack:** Next.js App Router, Tailwind design tokens (`--ds-*`), shadcn/ui, cmdk
  (⌘K command palette), vaul, TanStack Table + Virtual.

Apache-2.0 · https://kryndel.dev · https://github.com/rperezga/kryndel
