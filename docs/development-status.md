# ARGUS development status

Current release: **ARGUS v1.3.0**.

ARGUS core currently provides MAS/OIDC-backed responder identity, local
approval/capabilities, records, zones, assignments, presence/availability,
append-only notes, activity/unread state, audit, Matrix notifications, structured
close/reopen/archive/purge, and the installed-module host.

v1.3 makes responder authorization and assignment eligibility authoritative,
enforces `assigned -> active -> cleared`, separates historical reads from current
mutation, makes closed records read-only, narrows dispatcher-note and Matrix
privacy boundaries, makes installed routers fail closed, audits module toggles,
isolates optional frontend module failures, and exposes dispatcher-only generic
occurrence/reporter metadata.

Assignment state and `cleared_at` are one lifecycle representation: only a
`cleared` row with a timestamp is complete. Inconsistent legacy rows cannot be
resurrected or used to close a record and require operator reconciliation.

The public Polls & Back site and driver-intake repositories were checked. The
deployment-installed P&B ARGUS module source is not present in this workspace,
so source-level production compatibility remains to be validated before v1.3 is
deployed underneath it. The host API shape remains backward compatible; stricter
assignment eligibility and state transitions are the principal runtime checks.

Deferred before broader operational expansion: Matrix origin/DM-cache/commit and
retry hardening, archive concurrency, responder-deletion audit/activity,
privilege/routing audit detail, purge-retention reconciliation, fresh-database
Alembic bootstrap, and deployment-template documentation alignment. P2 input,
CSRF, Matrix-domain, and no-op update cleanup also remain deferred.

Next major work is the Polls & Back module update/upgrade. Do not add ride-specific
states or scheduling concepts to ARGUS core; keep them module-owned. Matrix is a
communication side effect, not the operational ledger. Production deployment is
separate from merge/tag and requires the installed module compatibility check.
