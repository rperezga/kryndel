# Kryndel — Limitations (honest)

This document describes what Kryndel does **not** do in v0.1.0 and why. No spin.

## EVM Sidechain (XRPL EVM, chain ID 1440002)

**No `eth_newFilter` / `eth_getFilterChanges`.** The public RPC (`rpc.xrplevm.org`) rejects subscription-based log filters. Kryndel polls with `eth_getLogs` every ~6 s, looking back 5 blocks.

**`eth_getLogs` restrictions.** The RPC rejects: (a) queries where `fromBlock == toBlock`, (b) queries that combine an `address` filter with a block range. Workaround: fetch logs with no address, filter client-side by `log.address`.

**No state diff.** `debug_traceTransaction` is not available on the public RPC. The `stateDiff` field in `Trace` is always empty.

**Polling lag.** Alert latency is roughly the polling interval (~4 s) plus processing time. Not suitable for latency-sensitive use cases.

**RPC error backoff.** The EVM watcher uses exponential backoff on consecutive RPC failures: starting at 4 s, doubling each time up to a ceiling of 60 s, then resetting to 4 s on the next successful poll. This prevents hammering a degraded endpoint but means alert latency can temporarily grow to 60 s during RPC instability.

**Alerts are in-process.** Alert rules live in MongoDB and are evaluated in the same process as the watcher. There is no persistence of in-flight events across restarts (Phase 2 target: M4 — persistent queue).

**No REST API.** The indexer writes to MongoDB; reading requires either the CLI or direct database access. A REST API is scheduled for Phase 2 (M2).

**Decimals not assumed.** Token values are displayed as raw integers with a note to divide by `10^decimals`. The `decimals()` ABI call is not made automatically.

## Native contracts — XLS-0101 (XRPL AlphaNet)

**Scope clarification.** Kryndel targets **XLS-0101 native WASM contracts** on the XRPL AlphaNet/Devnet — not Xahau or Hooks. XLS-0101 is the XRPL's own smart-contract amendment; Xahau is a separate network and out of scope.

**AlphaNet availability (re-verified 2026-06-14).** Both known RPC endpoints return Cloudflare error **526 (Invalid SSL Certificate)**: `alphanet.xrpl-labs.com` (tested 2026-06-11) and `alphanet.rpc.nerdnest.xyz` (tested 2026-06-14 via PowerShell `Invoke-RestMethod`). The watcher and XLS-0101 decoder are implemented and unit-tested offline with fixtures (see `packages/core/test/e2e-offline.test.ts`); live tracing is blocked by this external endpoint issue, not by Kryndel code. We will update this section when the endpoint is restored. Decision logged as DEC-011.

**No ABI on-chain (yet).** XLS-0101 contracts store their ABI on-chain, but the decoder currently returns a structured stub pending a stable AlphaNet connection to verify the exact ledger-entry shape. The hex→UTF-8 utility and trace structure are in place.

**No real-time watcher for native contracts.** The live WebSocket watcher (`kryndel watch --net alphanet`) requires a stable `ALPHANET_WS` endpoint. The watcher code filters `ContractCreate`, `ContractCall`, `ContractModify`, and `ContractDelete` transaction types correctly; live subscription is untested until the endpoint is reliably reachable.

**No own contract deployed on AlphaNet.** Deploying a native WASM contract requires the `craft-toolkit-ts` toolchain and a funded AlphaNet account. This is deferred until AlphaNet is stable.

## Web explorer

Available in v0.1.1. The `kryndel web` command launches the Next.js explorer (requires `MONGODB_URI` in `.env`). Known limitation: on Windows, the command required `shell: true` in the spawn call — fixed in commit `e4cf74a`. The Next.js package (`packages/web`) is functional locally; public deployment (Vercel) is deferred (milestone C1).

## General

**Single-node.** No clustering, no horizontal scaling. One watcher process per contract per machine.

**MongoDB M0 limits.** The free Atlas tier (M0) has storage and connection limits. Suitable for demo and development; not for production indexing of high-volume contracts.

**No authentication.** The CLI reads `.env` directly. There is no multi-user auth or role-based access.

**Alert channels.** Telegram and generic webhooks are supported. Discord support exists but uses the same webhook format. Slack and PagerDuty are not implemented.
