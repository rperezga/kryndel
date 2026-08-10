# Changelog

All notable changes to Kryndel are documented here.

## 0.4.3

### Added

- Heartbeat / silence dead-man-switch alert rules with 1h, 6h, 12h, 24h and custom windows.
- Worker silence loop that emits one quiet alert, sends an activity-resumed notice and re-arms after a later event.
- Per-contract `lastEventAt` tracking in the live event persistence path.

### Changed

- Event dispatch ignores silence rules; legacy rules without `kind` remain event rules.

## 0.4.1

### Added

- Standard decoding for ownership, access-control, pause and proxy-administration events.
- Mint, burn and admin-activity alert templates; mint/burn use fixed zero-address filters.
- Public create-alert links from decoded EVM traces and contract Explorer pages, preserving the prefilled rule builder through sign-in and automatically watching new contracts.

### Changed

- Alert filter construction now uses one shared operator mapper, including `=` → `$eq`.
