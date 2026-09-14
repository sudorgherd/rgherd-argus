# ARGUS v1.3 module-readiness remediation

Date: 2026-09-14
Starting branch/SHA: `main` / `ae554b279cdf8de8da7331195f41122a2b412532`
Starting version: `1.2.0`
Target: `ARGUS v1.3.0`

This is an implementation record for known findings, not a new audit.

## Addressed

- `ARGUS-SUP-001`: installed backend routers now inherit host-owned current
  responder and enabled-module dependencies. Current responder resolution
  requires authenticated, approved, active local identity. Stronger module
  capabilities remain additive.
- Previously known inactive-responder authorization gap: centralized in
  `get_current_responder`; console/callback behavior also honors inactive state.
- Previously known assignment-eligibility drift: one backend rule now requires
  approved, active, response-capable, effectively Online, and Available.
  Capacity, assignment creation, frontend selection, and applicable Matrix
  recipient paths use the same primitives.
- Previously known assignment-state drift: core responder transitions are now
  exactly `assigned -> active -> cleared`; invalid/repeated transitions have no
  audit or activity side effects.
- Previously known dispatcher-note mismatch: a responder receives the note only
  on their own assignment; other assignments and zone-only viewers do not.
- Previously known Matrix privacy leak: operational messages use a safe-field
  allowlist and exclude internal intake/reporter content.
- Previously known historical/mutation conflation: cleared assignment rows retain
  reads while losing note/state mutation authority; closed and archived records
  reject normal operational writes until an authorized reopen.
- Previously known record-contract drift: occurrence and reporter metadata can
  be created/updated; reporter fields remain dispatcher/admin-only.
- `ARGUS-SUP-008`: module enable/disable transitions atomically write system
  audit events with actor, module, old/new state, versions, and timestamp.
- `ARGUS-SUP-012`: enabled frontend manifests load lazily and independently;
  invalid, duplicate, initialization-failing, and render-failing modules no
  longer prevent core console use.
- Candidate-diff bypass review: discovery rejects raw Starlette routes that
  cannot inherit host dependencies; a render failure restores core navigation;
  inconsistent assignment state/timestamp rows cannot transition or permit
  record closure.

No database migration was required; all affected columns/tables already exist.

## Important decisions

- ARGUS v1.3 supports no public installed-module routes. Public access cannot
  result from a missing dependency.
- `Available` is required for assignment, while Busy/Away remains valid for an
  authorized Matrix communication.
- `all_online_responders` and a selected responder require effective Online
  presence; `all_responders` intentionally remains asynchronous and therefore
  does not require Online, but does require approval, active status, and respond
  capability.
- P&B-specific ride progress remains module-owned and does not extend the ARGUS
  assignment state machine.
- Occurrence timestamps are normalized to naive UTC storage and serialized with
  a UTC `Z`. Reporter identity/contact/callback policy remains dispatcher/admin
  only.
- No-op module state submissions do not create false transition audit events.
- A completed assignment is represented by both `assignment_state = cleared`
  and a non-null `cleared_at`; contradictory existing rows fail closed.

## Polls & Back compatibility

The canonical public repositories available locally were inspected read-only:

- `pollsandback-intake` at `61e5de9dd7ec33d3d5742099073e2eeb1fb8bf07`;
- `pollsandback.com` at `0635f2d0d39978d5a51c504c135d01c43ec33e6d`.

They cover the public website and driver intake, not the deployment-installed
ARGUS module. `src/modules/installed` is empty by design and `ARGUS_MODULES_DIR`
was unset. Consequently this release preserves the documented host API and has
generic host compatibility tests, but production P&B module source compatibility
must be checked before deployment.

| Surface | Status | Evidence / contract |
|---|---|---|
| Module discovery | UNCHANGED | `register(host)` and `ModuleRegistration` shape are unchanged. |
| Module enable/disable | COMPATIBLE CHANGE | Same API/state and disabled `503`; successful transitions now audit. |
| Module backend routes | NOT VALIDATED | Host guards are additive, but installed P&B source is unavailable. |
| Module authentication | COMPATIBLE CHANGE | Documented approved responder requirement now also enforces authoritative active state. |
| Module responder resolution | COMPATIBLE CHANGE | Same responder object/dependency; inactive responders are rejected. |
| Module navigation | COMPATIBLE CHANGE | Valid enabled manifests keep the same IDs/props; loading is lazy and isolated. |
| Record creation/read | COMPATIBLE CHANGE | Existing fields remain; occurrence/reporter support is additive and reporter-redacted. |
| Assignment creation/read | NOT VALIDATED | Creation now enforces the documented full eligibility rule; P&B runtime use is unavailable. |
| Assignment state changes | NOT VALIDATED | Core now accepts only `assigned -> active -> cleared`; P&B ride states must remain module-owned. |
| Dispatcher notes | COMPATIBLE CHANGE | Assigned responder now receives their own note; disclosure is narrower elsewhere. |
| Closed/completed visibility | COMPATIBLE CHANGE | Historical assignment reads remain; operational writes require reopen. |
| Matrix notifications used by P&B | NOT VALIDATED | Safe core fields/explicit dispatcher note remain; P&B module source is unavailable. |

## Deferred findings

The release intentionally defers `ARGUS-SUP-002`, `004`, `005`, `006`, `007`,
`009`, `010`, `011`, `013`, and `014`, except that v1.3 documentation records
the production transformed layout context for `014`. P2 record-domain validation,
CSRF, effective Matrix-domain consistency, and no-op record-update cleanup remain
out of scope.

## Regression coverage

- Backend: session/approval/active/capability combinations; every assignment
  eligibility dimension and presence timeout; positive/negative assignment
  transitions; audit/activity non-events; cleared/closed/archived read/mutation;
  scoped dispatcher notes; Matrix recipients and internal-marker redaction;
  record metadata redaction/UTC round-trip; fail-closed module routes; capability
  strengthening; raw-route rejection; module toggle audit and rollback;
  inconsistent assignment-row closure/transition rejection.
- Frontend: valid, malformed, throwing, duplicate, mismatched, and disabled-broken
  manifest behavior; render failure removes the module for the session and
  restores core navigation while retaining another valid module.
- CI now executes backend pytest and frontend module unit tests in addition to
  the existing build/audit checks.

## Test record

Baseline:

- `..\.venv\Scripts\python.exe -m pytest -q` from `backend`: 36 passed.
- `npm run build`: passed (after running outside the restricted sandbox).
- `npm run test:smoke`: 5 passed after installing Playwright Chromium.

Candidate:

- `..\.venv\Scripts\python.exe -m pytest -q` from `backend`: 80 passed.
- `npm run test:unit`: 4 passed.
- `.\.venv\Scripts\python.exe -m compileall -q backend\app backend\alembic`: passed.
- `npm run build`: passed.
- `npm run test:smoke`: 5 passed.
- `git diff --check`: passed.
