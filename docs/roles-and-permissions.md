# ARGUS Roles and Permissions

**Status:** Public-facing documentation draft  
**Audience:** admins, operators, maintainers, and self-host evaluators

## Purpose

ARGUS v1 uses a small role set with capability-based enforcement. Authentication proves who a user is. ARGUS approval and capabilities determine what that user can do.

A user may successfully authenticate through the identity provider and still lack ARGUS operational access until approved locally.

## Role set

ARGUS v1 uses three roles:

- Admin
- Dispatcher
- Responder

There is no Observer role in v1.

## Capability model

ARGUS uses local operator records to control application authority.

Important local operator fields include:

- approval state
- admin capability
- dispatch capability
- respond capability
- presence
- availability
- zone membership
- Matrix user ID
- display name

The role label is not enough by itself. Route authority should follow capability checks.

## Admin

Admins have full system management authority.

Admins can:

- create and manage local operators/responders
- approve or disable operators
- manage capabilities
- manage zones
- manage responder-zone memberships
- archive closed records
- purge archived records
- perform dispatcher-level actions
- access administrative surfaces

Admins are the only role that can archive or purge records in v1.

## Dispatcher

Dispatchers operate the core dispatch workflow.

Dispatchers can:

- create operational records
- update core record fields
- set category, severity, verification, zone, and status where allowed
- turn Active Response on or off where allowed
- assign responders
- unassign responders
- send record-linked Matrix alerts
- add notes
- view audit
- close records after responders are cleared or removed
- reopen closed non-archived records
- view archived records read-only

Dispatchers cannot:

- archive records unless also admin
- purge records unless also admin
- bypass archived read-only behavior
- silently close over uncleared assignments without removing or clearing them through the intended flow

## Responder

Responders receive limited operational visibility and can update their own response state.

Responders can:

- view assigned records with responder-appropriate detail
- view same-zone unassigned records in redacted form
- update their own availability
- update their own assignment state where allowed
- mark themselves cleared
- add append-only responder-visible notes to records they are allowed to update

Responders cannot:

- create records
- assign responders
- reassign responders
- unassign responders
- close records
- reopen records
- archive records
- purge records
- edit core classification fields
- view internal-only notes
- view reporter identity/contact by default
- mutate other responders' assignments

## Dispatcher-only users

Dispatch-only users still require local operator bootstrap data. The current operator self route should require an authorized approved session, not responder capability. This allows dispatch-only users to load the shell and receive their local operator state without being granted responder authority.

## Visibility model

Responder visibility has two levels.

### Assigned records

Assigned responders receive responder-visible detail needed for their role.

They may see operational context that is appropriate for carrying out the assignment, but they still do not receive internal-only fields or reporter identity/contact by default.

### Same-zone unassigned records

Responders may see same-zone unassigned records in redacted form for situational awareness.

Same-zone visibility does not grant:

- notes access
- internal details
- reporter identity/contact
- assignment controls
- closure controls

## Redaction model

ARGUS should expose less by default.

Sensitive or internal fields should remain internal unless explicitly exposed through a responder-visible path.

Reporter identity and contact details are dispatcher/admin-only by default. They should not appear in responder views or Matrix payloads unless a future deployment intentionally changes that policy and accepts the risk.

## Presence vs availability

Presence and availability are separate.

Presence describes whether the operator is connected or recently active in ARGUS.

Availability describes whether a responder is operationally ready:

- Available
- Busy
- Away

Presence should not be treated as a social chat status. It exists to support dispatch readiness and assignment safety.

## Zone membership

Zones are flat, group-defined labels.

Each record may have one zone. Each responder may belong to one or more zones.

Zone membership supports:

- responder visibility
- dispatch filtering
- roster context
- Matrix room routing

Zone membership is not a hierarchy, chain of command, or federation model in v1.
