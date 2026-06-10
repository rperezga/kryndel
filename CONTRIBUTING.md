# Contributing to Kryndel

Thanks for your interest. Kryndel is an early-stage project — contributions that close the Phase 1 scope are most welcome.

## Setup

```bash
git clone https://github.com/rperezga/kryndel.git
cd kryndel
pnpm install          # requires Node ≥ 20 and pnpm ≥ 11
cp .env.example .env  # fill in your keys (see below)
```

Required env vars for local development:

| Variable | Description |
|---|---|
| `EVM_RPC_URL` | XRPL EVM Sidechain RPC — `https://rpc.xrplevm.org` works |
| `MONGODB_URI` | MongoDB Atlas M0 or local `mongodb://localhost:27017` |
| `TELEGRAM_BOT_TOKEN` | Optional — only needed for `alert --to telegram` |
| `TELEGRAM_CHAT_ID` | Optional — your Telegram chat ID |
| `NATIVE_RPC_URL` | Optional — `https://hooks-testnet-v3.xrpl-labs.com` |

## Build & test

```bash
# From repo root:
pnpm exec tsc --project packages/core/tsconfig.json
pnpm exec tsc --project packages/cli/tsconfig.json

# Tests (from packages/core):
cd packages/core && pnpm exec vitest run
```

All tests run offline (network calls are mocked with fixtures in `test/fixtures/`).

## Code style

- TypeScript strict mode — no `any`, no unused vars.
- Exported functions get a one-line JSDoc comment.
- On-chain data (event names, args, addresses) must pass through `escapeMarkdown()` before reaching any alert message.
- MongoDB inserts must pass through `sanitizeKeys()` to prevent operator injection.
- Secrets (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `MONGODB_URI`) live only in `.env` — never in source, tests, fixtures, or commit messages.

## Commit style

```
type(scope): short description

feat(core): add traceNativeTx for Hooks testnet
fix(alerts): escape Markdown in event names
test(decoder): add decoder-native.test.ts with real fixture
docs: update LIMITATIONS.md with AlphaNet status
```

Types: `feat`, `fix`, `test`, `docs`, `refactor`, `chore`.

## Pull requests

1. Open an issue first for anything non-trivial.
2. One logical change per PR.
3. Tests must pass: `pnpm exec vitest run` green.
4. Build must pass: both `tsc` commands exit 0.
5. Sign off your commits: `git commit -s` (DCO).

## Scope (Phase 1 only)

The current focus is closing Phase 1 for the XRPL Grants application. Out-of-scope for now: REST API, state diff (`debug_traceTransaction`), multi-chain indexing, auth layer. See `LIMITATIONS.md` for the honest list.
