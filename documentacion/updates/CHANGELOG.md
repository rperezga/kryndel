# Kryndel development changelog

## 2026-08-09 — T8 multi-RPC worker fallback

- Added `EVM_RPC_URLS` as an ordered comma-separated list with backward compatibility for `EVM_RPC_URL` and the public XRPL EVM default.
- Added viem `fallback()` transport construction for the core EVM watcher with deterministic ordering (`rank: false`).
- Added ordered, sticky failover to the Kali/PM2 worker's shared EVM poller so a failed primary RPC does not stop all watchers.
- Unified heartbeat and worker polling against the same resolved endpoint list.
- Added `/healthz.evmRpcEndpoint` and sanitized RPC labels so credentials and query parameters cannot leak.
- Added unit coverage for one/three transport URLs, env compatibility, label redaction, and first-provider failure followed by successful indexing through the next provider.
- Updated the visible worker build marker to `worker-v0.4.2`.
