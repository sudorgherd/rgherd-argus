# Changelog

## v1.3.0

- Made installed backend module routes fail closed with host-owned responder authentication, approval, active-account, and enabled-module enforcement.
- Centralized current-responder and assignment-eligibility rules, including effective presence timeout handling.
- Enforced the core assignment transition graph: `assigned -> active -> cleared`.
- Separated historical assignment visibility from current mutation authority and made closed records operationally read-only.
- Added responder-scoped dispatcher notes without widening same-zone disclosure.
- Removed internal intake content from the explicit Matrix notification allowlist and hardened responder recipient selection.
- Added atomic system-audit events for module enable/disable changes.
- Isolated optional frontend module load, validation, and render failures from the core console.
- Added dispatcher/admin API support for occurrence and reporter metadata while preserving responder redaction.
- Added backend and frontend regression suites for the v1.3 hardening boundaries.

## v1.2.0

- Added the generic installed-module host, module discovery/state APIs, admin controls, frontend manifest integration, and commit-free canonical core operations for deployment-installed modules.

## v1.1.0

- Added persistent per-user record activity highlights for dispatchers, admins, and responders.
- Added version-based unseen activity tracking with explicit acknowledgement on record open.
- Added per-user record view state with concurrency-safe first-view handling.
- Added activity tracking for notes, assignments, record updates, closure, reopening, and archival.
- Added `UPDATED` queue indicators for dispatcher and responder workflows.
- Added backend and Playwright regression coverage for record activity highlighting.

## v1.0.0

- Declared ARGUS v1.0.0 as the first public source release.
- Updated frontend-visible version from v0.8.7 to v1.0.0.

## Unreleased

- Added public source-release candidate source tree.
- Added backend FastAPI application source.
- Added Alembic migration history.
- Added React/Vite frontend source.
- Added `.env.example`.
- Added backend Python dependency manifest.
- Added nginx and systemd deployment examples.
- Added deployment notes.
- Updated scaffold documentation for source-release candidate status.

## Pre-release scaffold

- Public repository space created.
- Pre-release governance, licensing, support, and documentation scaffolds added.
