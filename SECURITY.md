# Security Policy

Kryndel ingests **untrusted on-chain data** by design (anyone can deploy a contract whose
events flow through the watcher → decoder → indexer → alerts pipeline). We treat all
contract-derived strings as attacker-controlled input.

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Email
**rperezga@gmail.com** with a description and reproduction steps. You should receive a
response within 72 hours. Coordinated disclosure is appreciated; credit will be given in
release notes unless you prefer otherwise.

## Scope

- `@kryndel/core` (watcher, decoder, indexer, recorder, tracer, subscriber, alerts)
- `@kryndel/cli`
- `@kryndel/web` (explorer)

Out of scope: the preserved legacy simulator (`packages/core/legacy/hooks-sim/`), which is
not part of the active product.

## Operational notes for self-hosters

- All credentials (RPC endpoints, MongoDB URI, Telegram bot token) belong in `.env`
  (gitignored). Never commit them.
- Restrict MongoDB network access; use a least-privilege user scoped to the `kryndel` db.
- Alert webhook targets must be `https://` URLs you control.
