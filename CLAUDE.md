# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this project?

**Kryndel** is an open-source **observability & alerts layer for XRPL programmable logic**. Think "Etherscan + a monitor" for the XRPL contract layer. It indexes, decodes, traces and **alerts** on deployed contracts across two surfaces: the **XRPL EVM Sidechain** (mainnet since 30-Jun-2025, real DeFi today) and **native WASM contracts** (AlphaNet, XLS-0101) `[verificar exact native mainnet timeline]`.

Point at a contract → see its decoded calls, emitted events and triggered transactions as a structured `trace.json` and a visual x-ray → click "watch this event" → receive a Telegram/Discord alert.

> **Pivote (Jun 2026):** el proyecto NACIÓ como un *simulador local de WASM Hooks* (Etapas 0–7 construidas). Tras un estudio del ecosistema cambió a **observabilidad**, porque Ripple ya publica `ripple/craft` con un `wasm-host-simulator`. No reescribimos craft: lo **envolvemos** si se ofrece preview. Ver `DELTA.md` y `PLAN.md`. El código viejo del simulador se conserva en `packages/core/legacy/hooks-sim/`.

## Key documents (read in order)

| File | Purpose |
|---|---|
| `PROYECTO.md` | Master index — state, decisions, next steps. **Read first each session.** |
| `DELTA.md` | Reconciliación del pivote: ya hecho / obsoleto / nuevo. |
| `PLAN.md` | Plan accionable: fases, milestones, orden de ejecución. |
| `00-vision/plan-kryndel-xrpl.md` | 12-month plan, architecture, monetization, grant rationale |
| `01-fase-1-mvp/fase-1-construccion-mvp.md` | Full MVP technical spec (observability wedge) |
| `01-fase-1-mvp/fase-1-runbook-pasos.md` | Executable step-by-step runbook (12 stages) |
| `02-fase-2-grant/fase-2-aplicacion-grant.md` | XRPL Grant application draft |

## Stack (núcleo 100% TypeScript, SIN Rust)

- **Language:** TypeScript + Node ≥ 20. Monorepo: pnpm workspaces (`packages/core`, `packages/cli`, `packages/web`, `examples/`).
- **XRPL native:** `xrpl` (xrpl.js) + WebSocket to `rippled`/Clio (AlphaNet).
- **EVM sidechain:** `viem` (or `ethers`) against the sidechain RPC (mainnet).
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
        ├── watcher.ts      — Clio/rippled WS (AlphaNet) + EVM RPC (viem): ContractCreate/Call & events  [verificar tx model]
        ├── decoder.ts      — decode raw calls/events via on-chain ABI (native) / standard ABI (EVM)
        ├── indexer.ts      — persist contracts, calls, events in MongoDB
        ├── recorder.ts     — assemble the structured trace.json (REUSED from legacy)
        ├── subscriber.ts   — subscribe to contract events (push, not polling)
        ├── alerts.ts       — dispatch notifications (Telegram first)
        └── types.ts        — shared contract/trace types (REUSED & re-typed)

@kryndel/web                — Next.js explorer (contract → calls → event/tx timeline → "watch" button)
packages/core/legacy/hooks-sim/ — preserved old WASM-Hooks simulator (optional craft-style preview only)
```

The **trace JSON** is the core product: a decoded call → emitted events → triggered transactions → state changes. CLI prints it, the explorer paints it, Phase 2 demos it.

## Scope guardrails

**In scope (Phase 1 / M1):**
- Watcher for EVM sidechain (mainnet) events + native AlphaNet contract tx `[verificar tx model]`.
- Decoder (on-chain ABI / standard ABI) → MongoDB indexer → recorder → `trace.json`.
- One real alert to Telegram. CLI + Next.js explorer (minimal).
- ≥1 EVM contract example + ≥1 native (`ripple/craft`) example.

**Explicitly out of scope (Phase 2+):**
- Rewriting a WASM simulator (use/wrap `ripple/craft`).
- A generic XRPL explorer (XRPScan/Bithomp cover payments/tokens/NFT/AMM).
- Production-scale alert engine, hosted tier, multi-tenant, paid features.

**Honest risk (keep, don't sugarcoat):** native contracts aren't on mainnet yet → prove value on EVM sidechain (mainnet) today; incumbent explorers could extend to contracts → defensible wedge is **alerts + dev workflow**.

## Technical honesty rule

Do **not** assert unverified XRPL capabilities. Mark uncertain details `[verificar]` (e.g. native contract tx types `ContractCreate`/`ContractCall` vs Smart Escrows, on-chain ABI storage, native event subscription, exact AlphaNet→mainnet timeline). Keep the core in TypeScript; simulation, if offered, wraps craft.

## Phase exit criteria (before applying for the grant)

- [ ] Public repo tagged `v0.1.0`
- [ ] `kryndel trace` produces a decoded trace on ≥1 native (AlphaNet) and ≥1 EVM sidechain contract
- [ ] Web explorer renders the x-ray
- [ ] One real alert reaches Telegram
- [ ] Tests pass, CI green; README with honest positioning & limits
- [ ] Demo clip ≤40 s recorded and linked
