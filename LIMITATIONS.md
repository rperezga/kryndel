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

## Native contracts (Xahau / XRPL Hooks testnet)

**Hooks testnet only.** The Xahau mainnet and the XRPL native-contracts amendment (XLS-0101) are not the same network. Kryndel targets `hooks-testnet-v3.xrpl-labs.com` (Xahau testnet, currency XAH). There is no stable AlphaNet endpoint for XLS-0101 as of June 2026 (`alphanet.rpc.nerdnest.xyz` is down).

**No ABI on-chain.** Hooks are WASM binaries — there is no ABI registry on-chain analogous to Solidity. Kryndel decodes the `HookReturnString` (hex → UTF-8) and the `HookResult` code. Argument types beyond the return string are not decoded.

**No real-time watcher for native contracts.** The live WebSocket watcher (`kryndel watch --net alphanet`) requires a stable `ALPHANET_WS` endpoint. `trace --net alphanet` works via HTTP polling but live subscription is untested in v0.1.0.

**No own contract deployed.** v0.1.0 traces existing Hook contracts on the testnet. Deploying a custom Hook (via `SetHook` + WASM) is not part of the CLI and requires the `craft-toolkit-ts` toolchain separately.

## Web explorer

Not available in v0.1.0. The `kryndel web` command exits with a TODO. The Next.js package (`packages/web`) is scaffolded for Phase 1 M3.

## General

**Single-node.** No clustering, no horizontal scaling. One watcher process per contract per machine.

**MongoDB M0 limits.** The free Atlas tier (M0) has storage and connection limits. Suitable for demo and development; not for production indexing of high-volume contracts.

**No authentication.** The CLI reads `.env` directly. There is no multi-user auth or role-based access.

**Alert channels.** Telegram and generic webhooks are supported. Discord support exists but uses the same webhook format. Slack and PagerDuty are not implemented.
