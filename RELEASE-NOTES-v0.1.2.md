# v0.1.2 — Technical Debt & Security Hardening (Etapa TD)

> Base: v0.1.1 (e4cf74a). Branch: main. New commits: 3b5cb25, 744521a.

## Summary

Audit of all B1–B9 hallazgos from ESTADO-Y-AUDITORIA.md §6. B1–B8 and A2.6
were already resolved in v0.1.1 (comments in code: A2.1, A2.4, A2.6, A2.7,
A2.8, A2.9, A2.10). This release closes B9 and adds infrastructure hardening.

## Changes

### fix(B9) — EVM watcher exponential backoff (`packages/core/src/watcher.ts`)
- On RPC error in `poll()`, backoff doubles (4 s → 8 → 16 → 32 → 60 s ceiling).
- Resets to 4 s on next successful poll.
- Exports `POLL_BASE`, `POLL_MAX`, `nextEvmBackoff()` as pure helpers for testing.
- The native WebSocket watcher already had backoff (unchanged).

### infra — line ending normalization (`.gitattributes`)
- `* text=auto eol=lf` — normalizes all text files to LF on checkin, converts
  to native on checkout. Prevents CRLF noise in diffs on Windows.

### security — gate `/api/debug` (`packages/web/src/app/api/debug/route.ts`)
- Endpoint returns 404 unless `KRYNDEL_DEBUG=true` in the environment.
- Prevents unintentional exposure of MongoDB host info in production deployments.

### docs — `LIMITATIONS.md`
- Documents EVM watcher backoff behavior: 4 s base, 60 s ceiling, resets on success.

## Tests

57 passing (8 files). Baseline was 55; +2 new B9 tests in `watcher.test.ts`.
CI passes on origin/main.

## Already resolved in v0.1.1 (confirmed, no action needed)

| Hallazgo | Commit / location |
|---|---|
| B1 logIndex in unique index | indexer.ts (A2.1) |
| B2 matchesRule contract filter | subscriber.ts (A2.4) |
| B3 [external] label in tracer | tracer.ts (A2.6) |
| B4 partial pruning of `seen` map | watcher.ts (A2.7) |
| B5 wireAlerts() removed | subscriber.ts (A2.8/B5) |
| B6 dead `matched` array removed | pipeline.ts (A2.8) |
| B7 EVM_DEMO_CONTRACT from env | cli/index.ts (A2.9) |
| B8 rename to 'native value transfer' | tracer.ts (A2.10) |
| A2.6 blockHash polling | watcher.ts (A2.6/blockHash) |

## For Roger (manual steps — NOT done by this instance)

- **Atlas hardening:** restrict DB user to min-role on `kryndel` collection; rotate password; remove 0.0.0.0/0 from IP allowlist.
- **GitHub:** enable 2FA + branch protection + CI required checks + secret scanning.
