# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this project?

**Kryndel** is an open-source **observability & alerts layer for XRPL programmable logic**. Think "Etherscan + a monitor" for the XRPL contract layer. It indexes, decodes, traces and **alerts** on deployed contracts across two surfaces: the **XRPL EVM Sidechain** (mainnet since 30-Jun-2025, real DeFi today) and **native WASM contracts** (AlphaNet, XLS-0101).

Point at a contract → see its decoded calls, emitted events and triggered transactions as a structured `trace.json` and a visual x-ray → click "watch this event" → receive a Telegram/Discord alert.

> **Note:** the project pivoted (Jun 2026) from a local WASM-Hooks simulator to observability, because Ripple already publishes `ripple/craft` with a `wasm-host-simulator`. We don't reimplement craft: we **wrap** it if a preview is offered. The old simulator code is preserved in `packages/core/legacy/hooks-sim/`.
>
> Internal planning docs live OUTSIDE this repo (local folder `../documentacion/` — read `PROYECTO.md` there first each session).

## Stack (núcleo 100% TypeScript, SIN Rust)

- **Language:** TypeScript + Node ≥ 20. Monorepo: pnpm workspaces (`packages/core`, `packages/cli`, `packages/web`, `examples/`).
- **XRPL native:** `xrpl` (xrpl.js) + WebSocket to `rippled`/Clio (AlphaNet).
- **EVM sidechain:** `viem` against the sidechain RPC (mainnet).
- **Data:** MongoDB (`mongodb`).
- **Web:** Next.js explorer (`packages/web`).
- **Alerts:** workers + Telegram/Discord/webhook.
- **Simulation (optional):** wraps `ripple/craft`. **Do not reimplement craft.**
- **Tests:** `vitest`. **CI:** GitHub Actions (`pnpm lint && pnpm test`). **License:** Apache-2.0.

## Commands

```bash
pnpm install
pnpm lint
pnpm test

# CLI (target surface)
kryndel watch <contractAddress> --net evm|alphanet     # index a contract's calls/events
kryndel trace <txHashOrCall> --json > trace.json       # decode one call → structured trace
kryndel alert <contractAddress> --event <Name> --to telegram
kryndel web                                            # open the Next.js explorer
```

## Architecture overview

```
@kryndel/cli  (watch · trace · alert · web)
  └─► @kryndel/core
        ├── watcher.ts      — Clio/rippled WS (AlphaNet) + EVM RPC (viem): contract tx & events
        ├── decoder.ts      — decode raw calls/events via on-chain ABI (native) / standard ABI (EVM)
        ├── indexer.ts      — persist contracts, calls, events in MongoDB
        ├── recorder.ts     — assemble the structured trace.json (REUSED from legacy)
        ├── tracer.ts       — kryndel trace: tx hash → structured trace
        ├── subscriber.ts   — subscribe to contract events (push, not polling)
        ├── alerts.ts       — dispatch notifications (Telegram first)
        ├── pipeline.ts     — wires watcher → decoder → indexer → subscriber → alerts
        └── types.ts        — shared contract/trace types

@kryndel/web                — Next.js explorer (contract → calls → event/tx timeline → "watch" button)
packages/core/legacy/hooks-sim/ — preserved old WASM-Hooks simulator (optional craft-style preview only)
```

The **trace JSON** is the core product: a decoded call → emitted events → triggered transactions → state changes.

## Scope guardrails

**In scope (Phase 1 / M1):**
- Watcher for EVM sidechain (mainnet) events + native AlphaNet contract tx (XLS-0101: `ContractCreate`/`ContractCall`/`ContractModify`/`ContractDelete`).
- Decoder (on-chain ABI / standard ABI) → MongoDB indexer → recorder → `trace.json`.
- One real alert to Telegram. CLI + Next.js explorer (minimal).
- ≥1 EVM contract example + ≥1 native (`ripple/craft`) example.

**Explicitly out of scope (Phase 2+):**
- Rewriting a WASM simulator (use/wrap `ripple/craft`).
- A generic XRPL explorer (XRPScan/Bithomp cover payments/tokens/NFT/AMM).
- Production-scale alert engine, hosted tier, multi-tenant, paid features.

## Security rules (always)

- **Never commit secrets.** All credentials live in `.env` (gitignored); document keys in `.env.example` with empty values.
- **Treat ALL on-chain data as untrusted input** (event names, args, addresses come from arbitrary contracts): sanitize before writing to MongoDB (no `$`/`.` in keys), escape before interpolating into Telegram/Discord Markdown, never `eval` or template into shell commands.
- **Validate alert targets:** webhook/Discord URLs must be `https://` and explicitly user-provided; never fetch URLs derived from on-chain data (SSRF).
- Fail **loudly** on malformed user input (e.g. bad `--filter` JSON), never silently fall back.
- CI uses `pnpm install --frozen-lockfile`; dependency updates are deliberate, never implicit.

## Technical honesty rule

Do **not** assert unverified XRPL capabilities. Mark uncertain details `[verificar]` (e.g. exact `eventEmitted` message shape, AlphaNet→mainnet timeline). Keep the core in TypeScript; simulation, if offered, wraps craft.

## Phase exit criteria (before applying for the grant)

- [ ] Public repo tagged `v0.1.0`
- [ ] `kryndel trace` produces a decoded trace on ≥1 EVM sidechain contract (native AlphaNet blocked by RPC 526 SSL issue — see LIMITATIONS.md)
- [ ] Web explorer renders the x-ray
- [ ] One real alert reaches Telegram
- [ ] Tests pass, CI green; README with honest positioning & limits
- [ ] Demo clip ≤40 s recorded and linked

## ⛔ SCOPE GUARDRAILS — NON-NEGOTIABLE (added 2026-06-11 after Xahau deviation; see AUDIT-XAHAU.md)

1. **Exactly two surfaces:**
   - **XRPL native contracts: XLS-0101 (WASM)** on XRPL AlphaNet/Devnet.
   - **XRPL EVM Sidechain** (mainnet).
   **NOTHING ELSE.**
2. **Xahau, classic Hooks, or any other network/fork: OUT OF SCOPE.** If they ever seem necessary: document the reason and **ASK Roger BEFORE acting.** Never substitute one surface for another network "because it's responding."
3. **Blockers do not authorize scope changes.** If a network/endpoint is down: document the blocker with evidence, prioritize the other valid surface (EVM mainnet), declare the state honestly — and ask.
4. **North star: complete Phase 1 and submit the grant application.** Every technical decision is evaluated with one question: **does this bring the grant submission closer or push it further away?**
