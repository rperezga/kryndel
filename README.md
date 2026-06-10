# Kryndel

> **Observability & alerts for XRPL programmable logic.**
> Index, decode, trace and alert on deployed contracts — XRPL EVM Sidechain (mainnet) and Hooks (Xahau testnet).

[![CI](https://github.com/rperezga/kryndel/actions/workflows/ci.yml/badge.svg)](https://github.com/rperezga/kryndel/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

---

## What it does

The XRPL now has a contract layer — the **EVM Sidechain** (mainnet, chain ID 1440002) and **native Hooks** (Xahau testnet). But there's no "Etherscan + monitor" for it: existing explorers don't decode contracts or alert.

Kryndel fills that gap:

- **Watch** a contract → stream decoded calls and events to MongoDB.
- **Trace** a tx → get a structured timeline of the call, events fired, and result.
- **Alert** → send a Telegram message the moment a specific event fires.

## Quickstart

**Requirements:** Node ≥ 20, pnpm ≥ 11, MongoDB (Atlas M0 free tier works).

```bash
git clone https://github.com/rperezga/kryndel.git
cd kryndel
pnpm install
cp .env.example .env   # fill in EVM_RPC_URL, MONGODB_URI, TELEGRAM_*
```

Build:

```bash
pnpm exec tsc --project packages/core/tsconfig.json
pnpm exec tsc --project packages/cli/tsconfig.json
```

Run (from repo root):

```bash
# Watch a contract and index to MongoDB
node --env-file=.env packages/cli/dist/index.js watch 0x7C21a90E3eCD3215d16c3BBe76a491f8f792d4Bf

# Decode a transaction into a structured trace
node --env-file=.env packages/cli/dist/index.js trace 0x5c62e522... --net evm

# Trace a native Hooks transaction
node --env-file=.env packages/cli/dist/index.js trace 1254E600... --net alphanet

# Alert when a Transfer fires on a contract
node --env-file=.env packages/cli/dist/index.js alert 0x7ddb2d... --event Transfer --to telegram

# Watch all contracts without indexing (live event stream)
node --env-file=.env packages/cli/dist/index.js watch --no-index
```

## Architecture

```
EVM RPC ──┐
           ├─▶  watcher  ─▶  decoder  ─▶  indexer (MongoDB)
Hooks WS ─┘                      │
                                  └─▶  subscriber  ─▶  alert (Telegram / webhook)
                                  └─▶  tracer  ─▶  trace timeline
```

- **`packages/core`** — watcher, decoder, indexer, subscriber, alerts, tracer.
- **`packages/cli`** — `kryndel` CLI (watch / trace / alert / web).
- **`packages/web`** — Next.js explorer (Phase 1 M3, in progress).

## Networks

| Network | Status | RPC |
|---|---|---|
| XRPL EVM Sidechain (mainnet) | ✅ Live | `https://rpc.xrplevm.org` (chain ID 1440002) |
| Xahau Hooks testnet | ✅ Live | `https://hooks-testnet-v3.xrpl-labs.com` |

## Tests

```bash
cd packages/core
pnpm exec vitest run
# 7 test files, 43 tests — all offline (fixtures in test/fixtures/)
```

## Honest limitations

See [LIMITATIONS.md](LIMITATIONS.md) for the full list. Short version: no real-time filter subscriptions on the EVM RPC (we poll), no state diff, no REST API, no web explorer yet, native decoder returns Hook return strings only (no ABI on-chain for Hooks).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[Apache-2.0](LICENSE)
