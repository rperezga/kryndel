# Kryndel — Limitations (honest)

This document describes what Kryndel does **not** do in v0.1.0 and why. No spin.

## EVM Sidechain (XRPL EVM, chain ID 1440002)

**No `eth_newFilter` / `eth_getFilterChanges`.** The public RPC (`rpc.xrplevm.org`) rejects subscription-based log filters. Kryndel polls with `eth_getLogs` every ~6 s, looking back 5 blocks.

**`eth_getLogs` restrictions.** The RPC rejects: (a) queries where `fromBlock == toBlock`, (b) queries that combine an `address` filter with a block range. Workaround: fetch logs with no address, filter client-side by `log.address`.

**No state diff.** `debug_traceTransaction` is not available on the public RPC. The `stateDiff` field in `Trace` is always empty.

**Polling lag.** Alert latency is roughly the polling interval (6 s) plus processing time. Not suitable for latency-sensitive use cases.

**Alerts are in-process.** Alert rules live in MongoDB and are evaluated in the same process as the watcher. There is no persistence of in-flight events across restarts (Phase 2 target: M4 — persistent queue).

**No REST API.** The indexer writes to MongoDB; reading requires either the CLI or direct database access. A REST API is scheduled for Phase 2 (M2).

**Decimals not assumed.** Token values are displayed as raw integers with a note to divide by `10^decimals`. The `decimals()` ABI call is not made automatically.

## Native contracts — XLS-0101 (XRPL AlphaNet)

**Scope clarification.** Kryndel targets **XLS-0101 native WASM contracts** on the XRPL AlphaNet/Devnet — not Xahau or Hooks. XLS-0101 is the XRPL's own smart-contract amendment; Xahau is a separate network and out of scope.

**AlphaNet availability (verified 2026-06-11).** The RPC endpoint `alphanet.rpc.nerdnest.xyz` returns Cloudflare error **526 (Invalid SSL Certificate)** — the server infrastructure is alive (the faucet at `alphanet.faucet.nerdnest.xyz` responds normally) but the certificate is invalid/expired, making the RPC and WebSocket endpoints unusable. The watcher and XLS-0101 decoder are implemented and unit-tested offline; live tracing is blocked by this external endpoint issue, not by Kryndel code. We will update this section when the endpoint is restored.

**No ABI on-chain (yet).** XLS-0101 contracts store their ABI on-chain, but the decoder currently returns a structured stub pending a stable AlphaNet connection to verify the exact ledger-entry shape. The hex→UTF-8 utility and trace structure are in place.

**No real-time watcher for native contracts.** The live WebSocket watcher (`kryndel watch --net alphanet`) requires a stable `ALPHANET_WS` endpoint. The watcher code filters `ContractCreate`, `ContractCall`, `ContractModify`, and `ContractDelete` transaction types correctly; live subscription is untested until the endpoint is reliably reachable.

**No own contract deployed on AlphaNet.** Deploying a native WASM contract requires the `craft-toolkit-ts` toolchain and a funded AlphaNet account. This is deferred until AlphaNet is stable.

## Web explorer

Not available in v0.1.0. The `kryndel web` command exits with a TODO. The Next.js package (`packages/web`) is scaffolded for Phase 1.

## General

**Single-node.** No clustering, no horizontal scaling. One watcher process per contract per machine.

**MongoDB M0 limits.** The free Atlas tier (M0) has storage and connection limits. Suitable for demo and development; not for production indexing of high-volume contracts.

**No authentication.** The CLI reads `.env` directly. There is no multi-user auth or role-based access.

**Alert channels.** Telegram and generic webhooks are supported. Discord support exists but uses the same webhook format. Slack and PagerDuty are not implemented.
