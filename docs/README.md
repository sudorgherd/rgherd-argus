# ARGUS Public Documentation Draft Set

**Status:** Pre-public release documentation draft  
**Generated:** 2026-05-21  
**Audience:** maintainers, beta operators, self-host evaluators, and contributors

This folder contains public-facing ARGUS documentation that can be prepared before the final clean-room repository inspection is complete.

These documents intentionally avoid deployment-specific secrets, live server paths, private internal report language, and RG Herd-only configuration assumptions. They describe the v1 product model, operational workflow, roles, lifecycle, Matrix integration model, security posture, and beta-readiness boundary.

## Included documents

- [`overview.md`](overview.md) — Product purpose, scope, doctrine, and architecture summary.
- [`operational-workflow.md`](operational-workflow.md) — Dispatcher/responder workflow from intake through closure.
- [`roles-and-permissions.md`](roles-and-permissions.md) — Admin, dispatcher, responder, capabilities, and redaction rules.
- [`lifecycle.md`](lifecycle.md) — Working, closed, archived, purged, and authority rules.
- [`matrix-integration.md`](matrix-integration.md) — Matrix notification model, zone routing, responder DMs, and privacy rules.
- [`security-model.md`](security-model.md) — Public edge, auth, route protection, redaction, and deployment security assumptions.
- [`beta-readiness.md`](beta-readiness.md) — What beta-ready means, what it does not mean, and what should still be tested.

## Finalization note

The following documentation should be finalized only after the clean-room release repository is inspected:

- install guide
- configuration guide
- deployment guide
- `.env.example`
- backup/restore guide
- migration/upgrade guide
- admin bootstrap guide

Those documents depend on the final public repository layout and should not be locked against the live server tree.

## AI-assisted development disclosure

ARGUS is developed with AI-assisted tooling as part of the engineering workflow.

Human maintainers direct the architecture, review code changes, test behavior, control releases, and remain responsible for security, privacy, licensing, and operational decisions. AI assistance may be used for drafting, refactoring, documentation, debugging support, test planning, and implementation guidance.

No secrets, private deployment credentials, live tokens, private user data, or operational logs should be included in public source releases.
