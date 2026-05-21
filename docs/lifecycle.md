# ARGUS Record Lifecycle

**Status:** Public-facing documentation draft  
**Audience:** dispatchers, admins, maintainers, and beta testers

## Purpose

This document explains the ARGUS v1 lifecycle model.

The locked v1 lifecycle is:

> Working → Closed → Archived → Purged

Lifecycle state controls who may act on a record and what actions are allowed.

## Working

A working record is any non-archived record that is not closed.

Working records may be newly created, under review, notified, assigned, active, or resolved.

Dispatchers and admins may update working records according to their capabilities. Responders may interact with working records only through their allowed responder paths.

## Closed

A closed record is no longer active work, but remains visible in the closed-records view.

Closure is a structured action. It should not be faked by a normal status update.

Closure requires closure fields such as:

- outcome type
- outcome notes
- closed by
- closed at
- responders involved
- need met
- follow-up needed

## Closure rule

If responders are assigned to a record, each assigned responder should be cleared before the dispatcher closes the record.

A dispatcher may also unassign responders before closure when appropriate.

This preserves the separation between field completion and final dispatch closure:

- responders own their own completion state
- dispatchers own final record closure

## Reopen

Dispatchers and admins may reopen closed records that have not been archived.

Reopen returns a closed record to active working state.

Archived records cannot be reopened in v1.

## Archived

Archived records are closed records moved into read-only historical storage.

Archive behavior:

- admin-only
- manual
- allowed only after closure
- read-only after archive
- not reversible in v1

Archived records should not be mutated through normal workflow routes. Notes, assignments, generic updates, and closure edits should be blocked once archived.

Dispatchers and admins may view archived records read-only. Responders should only receive whatever archived visibility the deployment explicitly allows.

## Purged

Purge is permanent removal of an archived record and dependent operational data.

Purge behavior:

- admin-only
- archived-only
- destructive
- removes dependent operational rows
- does not preserve a retained audit trace by design

Because purge deletes operational history, deployments should treat it as a serious administrative action.

## Lifecycle route model

Expected route concepts:

- close a record
- reopen a closed record
- archive a closed record
- purge an archived record
- list working records
- list closed records
- list archived records

Record listing should support lifecycle filtering:

- working
- closed
- archived

Invalid lifecycle filters should return a structured error rather than silently falling back.

## Lifecycle authority summary

| Action | Dispatcher | Responder | Admin |
|---|---:|---:|---:|
| Create record | Yes | No | Yes |
| Update working record | Yes | No | Yes |
| Assign responder | Yes | No | Yes |
| Mark own assignment cleared | No | Yes | Admin override only if implemented |
| Close record | Yes | No | Yes |
| Reopen closed record | Yes | No | Yes |
| Archive closed record | No | No | Yes |
| View archived records | Yes | No by default | Yes |
| Purge archived record | No | No | Yes |

## Operational warning

ARGUS lifecycle controls are not a substitute for a deployment’s legal, privacy, retention, or safety policy. Self-hosting groups are responsible for deciding how long to retain operational records and when purge is appropriate.
