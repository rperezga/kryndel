# kryndel

> **The observability & alerts layer for XRPL programmable logic.**
> Index, decode, trace and **alert** on deployed contracts — XRPL EVM Sidechain (mainnet) and native contracts (AlphaNet).

**WIP — under active development.** Apache-2.0.

---

## Why Kryndel

The XRPL is gaining a contract layer — the **XRPL EVM Sidechain** (mainnet since 30-Jun-2025, real DeFi today) and **native WASM contracts** (AlphaNet, XLS-0101) `[verificar exact native mainnet timeline]`. But there's no "Etherscan + monitor" for it: existing explorers (XRPScan, Bithomp) don't decode contracts or their events, and don't alert.

Kryndel fills that gap: point at a contract → see its decoded calls, emitted events and triggered transactions in a visual **x-ray**, then click **"watch this event"** → get a Telegram/Discord alert.

## Position (honest)

- **vs `ripple/craft` (wasm-host-simulator):** craft is dev-time, local, terminal, Rust. Kryndel is **deploy-time + production**, visual, with alerts — and can *wrap* craft for optional preview. We don't reimplement it.
- **vs XRPScan / Bithomp:** mature explorers for payments/tokens/NFT/AMM — but they don't decode contracts or alert. Kryndel focuses **only on the contract layer + alerts**.
- **Honest risk:** native contracts aren't on mainnet yet → we prove value on the **EVM sidechain (mainnet)** today. Incumbent explorers could extend to contracts → our defensible wedge is **alerts + developer workflow**, not generic exploration.

## Stack

100% TypeScript, no Rust. `watcher` (Clio/rippled WS + EVM RPC via `viem`) → `decoder` (on-chain / standard ABIs) → `indexer` (MongoDB) → `recorder` (trace) → `subscriber` → `alerts` (Telegram). Explorer in Next.js. Optional simulation wraps `ripple/craft`.

## Quickstart (target)

```bash
npx kryndel watch <contractAddress> --net evm        # index a contract's calls/events
npx kryndel trace <txHashOrCall> --json > trace.json # decode one call into a structured trace
npx kryndel alert <contractAddress> --event Transfer --to telegram
npx kryndel web                                      # open the explorer
```

## Status

Pivoted from a WASM-Hooks simulator to observability after an ecosystem study (Jun 2026). See `DELTA.md` (what was reused/changed) and `PLAN.md` (roadmap). The previous Hooks-simulator code is preserved under `packages/core/legacy/hooks-sim/`.

## License

Apache-2.0.
