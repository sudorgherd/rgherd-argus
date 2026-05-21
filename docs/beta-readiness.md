# ARGUS Beta Readiness

**Status:** Public-facing documentation draft  
**Audience:** beta testers, maintainers, contributors, and self-host evaluators

## Current beta posture

ARGUS should be described as:

> beta-ready for controlled operator testing

That does not mean ARGUS is complete forever, production-hardened against all threats, ready for open registration, or packaged as a finished self-host installer.

It means the core v1 operational model exists and can be exercised by trusted operators in a controlled beta.

## What beta-ready means

Beta-ready means the system has enough of the intended v1 operational loop to test with trusted users:

- authenticated operator access
- local ARGUS approval/capability model
- one core operational record model
- universal intake
- Active Response behavior
- Potential Emergency boundary
- category/severity/verification fields
- queue/detail UI
- assignment flow
- responder console
- notes flow
- audit flow
- zones and responder-zone membership
- lifecycle controls
- Matrix notification integration
- admin/operator management
- constrained public edge exposure

## What beta-ready does not mean

Beta-ready does not mean:

- public open registration
- public self-service dispatch
- emergency-services reliability
- no bugs remain
- no UI cleanup remains
- stress testing is complete
- mobile experience is finalized
- plugin architecture exists
- self-host packaging is complete
- deployment is one-click
- all public documentation is finished
- all future modules are implemented

## Controlled beta assumptions

A controlled beta should use trusted testers and explicit expectations.

Recommended beta boundaries:

- testers understand ARGUS is not emergency-services software
- testers use non-sensitive or controlled test scenarios unless authorized
- operators are given roles intentionally
- Matrix rooms/users used for beta are known
- admins can inspect audit and logs
- feedback is collected in structured form
- bugs are expected and documented

## Suggested beta test areas

### Access and onboarding

Test:

- identity-provider login
- approved vs unapproved user behavior
- admin-created operator records
- dispatcher-only access
- responder-only access
- admin access
- logout behavior

### Intake and classification

Test:

- creating records
- Active Response off/on
- Safety / Threat / Health professional escalation prompt
- required vs optional fields
- zone selection
- severity selection
- verification state

### Dispatch workflow

Test:

- record list behavior
- selected record detail
- record updates
- assignment creation
- assignment removal
- responder self-clear
- close after responders are cleared
- reopen closed record
- archive closed record
- purge archived record with admin authority

### Responder workflow

Test:

- assigned record visibility
- same-zone unassigned redacted visibility
- responder notes
- responder availability updates
- responder assignment state
- cleared assignment behavior

### Matrix integration

Test:

- Matrix status panel
- zone room routing
- assignment direct-message send
- manual alert send to one responder
- manual alert send to one zone
- fanout send behavior if enabled
- missing Matrix ID failure
- missing zone room failure
- partial failure feedback
- audit entries for send results

### Security and redaction

Test:

- unauthenticated protected APIs return 401
- unapproved users are blocked
- responder cannot see internal-only fields
- responder cannot see reporter identity/contact by default
- same-zone unassigned responder cannot see notes
- archived records reject mutation
- Matrix payloads exclude private/internal fields

### Stale presence behavior

If heartbeat/stale-session handling is implemented in the tested version, test:

- tab close
- browser close
- network drop
- return after timeout
- assignment blocking against stale/offline responders

If heartbeat is not implemented, document that presence still depends primarily on login/logout behavior in that version.

## Known non-blockers for public v1 unless intentionally promoted

These should not block v1 unless the project explicitly promotes them:

- plugin loader
- mobile-specific responder app
- public intake portal
- GIS map
- AI enrichment
- advanced automation/rules engine
- multi-org federation
- attachment storage
- full notification-history table
- microservice extraction

## Feedback collection

Structured beta feedback should capture:

- tester code or anonymous tester identifier
- role used
- workflow step
- what the tester tried
- what happened
- what was confusing
- what felt useful
- severity of issue
- freeform note
- timestamp

A database-backed beta notes system is preferable to scattered email feedback because it creates sortable, timestamped records by step and tester.
