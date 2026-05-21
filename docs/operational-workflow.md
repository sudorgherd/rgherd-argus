# ARGUS Operational Workflow

**Status:** Public-facing documentation draft  
**Audience:** dispatchers, admins, responders, maintainers, and beta testers

## Purpose

This document describes the intended ARGUS v1 workflow from incoming information through closure, archive, and audit.

ARGUS is built around dispatcher-mediated coordination. Human operators decide what information becomes an operational record, how it should be classified, who should be notified, who should be assigned, and when the record is complete.

## Core workflow

The smallest successful ARGUS v1 workflow is:

1. A dispatcher receives information.
2. The dispatcher creates one operational record.
3. The dispatcher classifies it using category, severity, verification state, and Active Response.
4. If appropriate, the dispatcher notifies or assigns responders.
5. Responders receive only the visibility appropriate to their role and relationship to the record.
6. Responders update their own assignment state and add append-only notes.
7. The dispatcher tracks operational status and record updates.
8. Responders clear themselves when done.
9. The dispatcher completes structured closure.
10. The record can later be reopened, archived, or purged according to role authority.

## Intake

ARGUS v1 uses one universal intake form.

Required at creation:

- summary
- category
- severity
- active response
- creator identity
- creation timestamp

Conditionally required:

- professional escalation decision, when Active Response is on and category is Safety / Threat / Health

Optional at creation:

- location
- zone
- verification state
- source type
- reporter identity/contact fields
- occurrence time
- freeform/internal notes
- responder instructions
- safety/privacy flags

Location is not required at intake. In urgent situations, incomplete or vague location text may be refined later.

## Active Response

Active Response is the operator-facing switch that determines whether a record is in live response flow.

**Off** means the record is being tracked but is not actively dispatched.

**On** means the record is in active operational response flow.

Verification does not block Active Response. A record may be urgent before it is fully verified.

## Potential Emergency boundary

When Active Response is turned on for a Safety / Threat / Health record, ARGUS requires the operator to make a professional-escalation decision:

- Yes
- No
- Unknown

This is a required operational boundary. ARGUS must not imply that volunteer or community responders are the correct response to every emergency, threat, or health situation.

## Triage and classification

Dispatchers classify records using:

- category
- severity
- verification state
- Active Response
- zone
- operational notes or instructions

Verification is a confidence indicator. It does not stop urgent action when a dispatcher determines response is needed.

## Notification and assignment

ARGUS supports both notify-first and assign-first workflows.

A dispatcher may send a Matrix alert before assigning a responder, or may assign a responder and trigger direct notification through that assignment flow.

Assignment is the formal operational link between a responder and a record. Matrix notification is a communication event. These are related, but not the same thing.

## Responder workflow

Responders can:

- view records assigned to them
- view same-zone records in redacted form when unassigned
- update their own availability
- update their own assignment state where allowed
- add append-only responder-visible notes
- mark themselves cleared

Responders cannot:

- create core records
- assign or reassign responders
- close records
- archive records
- purge records
- edit core classification fields
- view internal-only notes
- view reporter identity/contact by default

## Notes

Notes are append-only. They are not editable or deletable in normal v1 use.

Dispatcher/admin notes may be internal or responder-visible depending on intended audience.

Responder-created notes are responder-visible. Responders cannot create internal-only notes.

Same-zone unassigned responders do not see notes. Zone visibility is for situational awareness, not full operational context.

## Audit

Audit entries capture meaningful operational events such as:

- record creation
- record update
- assignment creation
- responder self-clear
- unassignment
- notes added
- closure
- reopen
- archive
- Matrix send success/failure

Audit exists to preserve operational history and support review. It is not a replacement for dispatcher judgment.

## Closure

Closure is a structured action, not a generic status edit.

A dispatcher closes a record after required closure details are completed and assigned responders are cleared or removed.

Responders own field completion by clearing themselves. Dispatchers own final record closure.

## Reopen, archive, and purge

After closure:

- Dispatch/Admin may reopen closed records.
- Admin may archive closed records.
- Dispatch/Admin may view archived records read-only.
- Admin may purge archived records.
- Archived records cannot be reopened in v1.

Purge removes the record and dependent operational rows. It is intentionally destructive and admin-only.
