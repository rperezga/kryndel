# Kryndel

> **Observability & alerts for XRPL smart contracts.**
> Detect, decode, trace and alert on deployed contracts — **XRPL EVM Sidechain** (mainnet) and native **XLS-0101** (AlphaNet).

[![CI](https://github.com/rperezga/kryndel/actions/workflows/ci.yml/badge.svg)](https://github.com/rperezga/kryndel/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

**🌐 Live & free — [kryndel.dev](https://kryndel.dev)**  ·  **▶ [34s demo](https://youtu.be/nbY1uYgFMuw)** — trace · explorer · alerts on XRPL EVM Sidechain mainnet

---

## What it does

The XRPL has a contract layer now — the **EVM Sidechain** (mainnet, chain ID 1440000) and native **XLS-0101** WASM contracts. But explorers like XRPScan and Bithomp track payments and tokens; they don't decode your contracts or alert when something fires. Kryndel does:

- **Detect** — watch any contract in real time (no scripts, no cron).
- **Decode** — events by name (`Transfer`, `Approval`, `Swap`…) with decoded args, not raw topics.
- **Alert** — the moment a watched event fires → **Telegram** or a **signed webhook** (filter by decoded args). SMS, email & push coming soon.
- **Replay** — trace any tx into a readable timeline: **call → event → state → alert**.

Build on top of it: public **REST API v1** + **TypeScript SDK** + **signed webhooks**.

## Try it

**Hosted (easiest)** — [kryndel.dev](https://kryndel.dev). Search and decode any EVM contract in the public explorer, then use **Watch this contract** to sign in, start watching it if needed and continue directly to a prefilled alert rule. Mint, burn and admin-activity templates are available in the builder.

| Plan | Price | Includes |
|---|---|---|
| Free | $0 | 3 contracts · Telegram alerts · 7-day history · public explorer |
| Pro | $19.99/mo | 20 contracts · signed webhooks · 90-day history · REST API + SDK |

**Self-host (open-source)** — clone this repo and run the CLI/worker yourself (see [Quickstart](#quickstart-self-host)). Apache-2.0, no strings.

## Networks

| Network | Status | Endpoint |
|---|---|---|
| XRPL EVM Sidechain (mainnet) | ✅ **Live** end to end | Ordered `EVM_RPC_URLS` fallback (chain ID 1440000) |
| XRPL native — XLS-0101 (AlphaNet) | 🔧 Watcher ready; full decode **pending AlphaNet** | see [LIMITATIONS.md](LIMITATIONS.md) |

> Honest status: EVM Sidechain mainnet is fully live. The native XLS-0101 watcher and decoder are built and unit-tested offline; live decode is blocked by AlphaNet endpoint availability — stated openly across the product, never faked.

## Monorepo

```
@kryndel/core    — watcher · decoder · indexer · tracer · alerts (the engine)
@kryndel/cli     — kryndel CLI: watch / trace / alert
@kryndel/web     — hosted app: public explorer + dashboard (Next.js)
@kryndel/worker  — 24/7 watcher + alert dispatcher
@kryndel/sdk     — TypeScript SDK for the public REST API
```

**Signal path:**

```
EVM RPCs ─────┐
               ├─▶  watcher ─▶ decoder ─▶ indexer (MongoDB)
AlphaNet WS ──┘  (XLS-0101)        │
                                    ├─▶ subscriber ─▶ alert (Telegram / signed webhook)
                                    └─▶ tracer ─▶ trace timeline (call → event → state → alert)
```

## Quickstart (self-host)

**Requirements:** Node ≥ 20, pnpm ≥ 11, MongoDB (Atlas M0 free tier works).

```bash
git clone https://github.com/rperezga/kryndel.git
cd kryndel
pnpm install
cp .env.example .env   # fill in EVM_RPC_URLS, MONGODB_URI, TELEGRAM_*
pnpm build
```

Run the CLI (from repo root):

```bash
# Watch a contract and index its calls/events to MongoDB
node --env-file=.env packages/cli/dist/index.js watch 0x7C21a90E3eCD3215d16c3BBe76a491f8f792d4Bf

# Decode a transaction into a structured trace
node --env-file=.env packages/cli/dist/index.js trace 0x5c62e522... --net evm

# Alert when a Transfer fires on a contract
node --env-file=.env packages/cli/dist/index.js alert 0x7ddb2d... --event Transfer --to telegram
```

## Tests

```bash
pnpm test   # full vitest suite — green in CI (Apache-2.0, GitHub Actions)
```

## Honest limitations

See [LIMITATIONS.md](LIMITATIONS.md) for the full, no-spin list. Short version: the EVM worker uses an ordered multi-RPC fallback and polls `eth_getLogs` about every 10 s, but all configured providers can still fail and `debug_traceTransaction` remains unavailable; native XLS-0101 live decode is pending AlphaNet endpoint availability.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security policy in [SECURITY.md](SECURITY.md).

## License

[Apache-2.0](LICENSE) · [kryndel.dev](https://kryndel.dev) · built for the XRPL contract layer.
