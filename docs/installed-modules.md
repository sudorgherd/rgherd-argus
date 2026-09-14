# Installed-module contract

ARGUS v1.3 hosts trusted deployment-installed modules in the existing FastAPI
process and Vite console. This is an integration contract, not a sandbox.

## Backend boundary

Every router returned by `register(host)` is mounted with host-owned guards:

1. an authenticated ARGUS session;
2. an approved and active local responder;
3. a currently enabled persisted module state.

Disabled routes retain the canonical `503` response with
`detail.code = "module_disabled"`. Modules may add stronger dependencies from
the host (`require_dispatch_responder`, `require_respond_responder`, or
`require_admin_responder`) plus their own object-level checks. Route authors
must not replace responder identity with client-supplied IDs.

Public installed-module routes are not supported in v1.3. A future public-route
facility would require an explicit host contract; omitting authentication never
makes a route public.

Module routers must contain FastAPI `APIRoute`/`APIWebSocketRoute` entries.
Discovery rejects raw Starlette route entries because FastAPI cannot propagate
the host dependencies to them.

Host core operations are commit-free. A module owns the surrounding transaction
and must commit once after all related module/core database writes succeed.
ARGUS core lifecycle, assignment eligibility, audit, and activity rules still
apply. Module-specific ride progress remains module state rather than an ARGUS
assignment-state extension.

## Frontend boundary

The build discovers `src/modules/installed/<module-id>/manifest.jsx`. Directory
and manifest IDs must match. At runtime ARGUS imports only backend-enabled
manifests and isolates each import, validation, duplicate-ID, and render failure.
A broken optional module is removed for the browser session; core navigation is
restored alongside any other valid module, preserving Admin → Modules for
operators who can disable it.

Syntax errors and unresolved imports remain build-time failures and must be
caught before replacing production assets. Frontend capability/navigation checks
are presentation controls; backend authorization remains authoritative.

## Compatibility expectations

Modules must use stable core statuses and the assignment graph
`assigned -> active -> cleared`. Richer domain progress belongs in module-owned
tables. Current assignments require an approved, active, response-capable,
effectively Online responder whose availability is `Available`. Cleared rows may
support historical reads but no longer authorize operational mutation.

Module packages should be tested against the target ARGUS release before
deployment. ARGUS and a module may be merged/tagged independently, but production
deployment must wait when the module's source-level compatibility has not been
validated.
