# ARGUS Matrix Integration

**Status:** Public-facing documentation draft  
**Audience:** maintainers, dispatchers, admins, and self-host evaluators

## Purpose

ARGUS uses Matrix for notifications and communication.

ARGUS does not use Matrix as workflow storage. Operational truth remains in ARGUS records, assignments, notes, lifecycle fields, and audit entries.

## Core rule

> ARGUS state is the operational source of truth. Matrix is the communication layer.

Matrix sends may notify operators or responders, but Matrix does not become the incident database, assignment ledger, audit trail, or closure record.

## Service account model

ARGUS should use a dedicated Matrix service account for application-originated sends.

Recommended pattern:

- dedicated bot/service account
- recognizable sender identity
- access token stored securely in server configuration
- no human operator account used as the automated sender

Example identity pattern:

```text
@argus:example.org
```

Do not publish real Matrix access tokens.

## Required Matrix configuration categories

A deployment needs configuration for:

- Matrix homeserver URL
- Matrix sender user ID
- Matrix access token
- request timeout seconds

Exact environment variable names should match the final public repository.

## Routing fields

ARGUS Matrix routing depends on two primary local fields.

### Zone room routing

Zones may store a Matrix room ID.

Conceptual field:

```text
zones.matrix_room_id
```

This is used for zone-targeted sends.

### Responder direct-message routing

Responders/operators may store a Matrix user ID.

Conceptual field:

```text
responders.matrix_user_id
```

ARGUS may also cache a successful direct-message room ID.

Conceptual field:

```text
responders.dm_room_id
```

The cache should be updated only after successful delivery through that room. If a cached room fails, ARGUS should re-resolve or recreate the DM room and retry once before returning structured failure.

## Automatic sends

ARGUS v1 supports limited automatic sends.

### Zone notification on record creation

Trigger:

- record is created
- record has a zone at creation time
- that zone has a usable Matrix room ID

Behavior:

- create the ARGUS record first
- attempt Matrix notification
- write audit success/failure
- do not roll back the record if Matrix fails

No delayed automatic send occurs when a zone is added later. If the dispatcher wants to notify a zone after later zone assignment, they should use manual alert send.

### Direct assignment notification

Trigger:

- assignment creation succeeds
- assigned responder has a usable Matrix user ID

Behavior:

- create the assignment first
- resolve or create a DM room
- attempt Matrix notification
- write audit success/failure
- do not roll back assignment if Matrix fails

Assignment is the operational link. Matrix notification is delivery. The two should not be treated as the same event.

## Manual alerts

Manual alerts are record-linked and dispatcher/admin-controlled.

Current route concept:

```text
POST /api/records/{record_id}/matrix-alerts
```

Manual destinations in v1:

- one responder
- all online responders
- all responders
- one zone
- all zones

Manual alerts should use the currently selected record and may include an optional dispatcher note.

There is no free-floating broadcast composer in v1.

## Payload rules

Every Matrix send should include enough record-linked context to be useful.

Minimum payload concepts:

- summary
- category
- severity
- zone when present
- location when present
- record ID or record link/reference
- optional dispatcher note

## Privacy exclusions

Matrix payloads must not include:

- reporter identity
- reporter contact information
- internal-only notes
- internal-only fields
- dispatcher/admin-only context
- fields not allowed by the recipient’s visibility level

Zone room sends should stay at shared/redacted awareness level.

Direct responder sends may include responder-visible detail appropriate to the assignment or alert, but still must not include reporter identity/contact or internal-only fields.

## Failure model

Matrix failure must not crash core ARGUS operations.

Expected behavior:

- record creation still succeeds if automatic zone notification fails
- assignment still succeeds if direct Matrix notification fails
- manual alert send returns success, failure, or partial failure
- failures are visible to dispatch/admin users
- send outcomes are recorded in audit

## Audit

Matrix send history is audit-backed in v1. A separate notification-history table is not required.

Useful Matrix audit event concepts include:

- zone auto-send success
- zone auto-send failure
- direct assignment send success
- direct assignment send failure
- manual alert success
- manual alert failure
- manual alert partial success
- DM room resolution
- DM room creation
- DM room resolution failure

Audit metadata should include enough context to troubleshoot delivery:

- trigger type
- destination type
- record ID
- record summary snapshot
- zone ID/name
- responder ID/display name
- Matrix user ID
- Matrix room ID
- success count
- failure count
- error detail where applicable

## Matrix / Integration Status panel

The Matrix status surface should show health and routing readiness.

It may show:

- connector health
- sender account configured/missing
- homeserver reachable/unreachable
- zones with usable Matrix room IDs
- responders with usable Matrix user IDs
- cached DM room count if implemented
- last send result summary

It should not become:

- a chat panel
- a message-history browser
- a retry queue console
- a replacement for the Audit panel
