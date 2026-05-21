# ARGUS Overview

**Status:** Public-facing documentation draft  
**Audience:** operators, maintainers, contributors, and self-host evaluators

## What ARGUS is

ARGUS is a controlled-access, dispatcher-mediated operational coordination platform for trusted community response teams.

It exists to help a trusted group receive information, convert it into structured operational records, coordinate responders, preserve operational notes and audit history, send notifications through Matrix where appropriate, and move records through a clear lifecycle from active work to closure and archive.

ARGUS is designed around one core rule:

> ARGUS state is the operational source of truth. Matrix is the communication layer.

That means records, assignments, responder state, notes, lifecycle status, and audit entries belong in ARGUS. Matrix is used for notifications and human coordination, but Matrix is not the incident database, assignment ledger, audit trail, or workflow engine.

## What ARGUS is not

ARGUS is not:

- an emergency services system
- a public 911 replacement
- a public self-service dispatch portal
- a chat replacement
- a long-term case-management suite
- a GIS/mapping platform
- a rules-engine automation platform
- an AI decision system
- an unrestricted public reporting queue

ARGUS is intended for trusted operators using human judgment. It does not replace professional emergency services, legal counsel, medical services, or local emergency procedures.

## Core v1 model

ARGUS v1 uses one core operational record. It does not split information into separate first-class “report” and “incident” objects. A record may be tracked without active response, or it may enter live response flow through the **Active Response** field.

**Active Response = Off** means the record remains tracked but is not in live response flow.

**Active Response = On** means the record is in active operational response flow. Verification is not required before active response; urgent work may begin with incomplete information.

When **Active Response** is turned on for a **Safety / Threat / Health** record, ARGUS requires an explicit professional-escalation decision:

- `yes`
- `no`
- `unknown`

This is a safety boundary. The system should not imply that community responders are the correct answer for every safety, threat, or health situation.

## Frozen v1 categories

ARGUS v1 uses a small operational category set:

1. Safety / Threat / Health
2. Basic Needs (Shelter / Food / Supplies)
3. Escort / Transport
4. Legal Support / Observer
5. Logistics / Coordination
6. Other Support

This category set is intentionally small. The goal is fast dispatcher classification, not an exhaustive taxonomy.

## Severity values

ARGUS v1 uses four severity values:

- Low
- Medium
- High
- Critical

Severity should affect queue prominence, notification urgency, and operator attention. It is an operational signal, not decoration.

## Verification values

ARGUS v1 uses these verification states:

- `pending`
- `unverified`
- `verified`
- `not_applicable`

Verification is a confidence and audit indicator. It does not block urgent response.

## Roles

ARGUS v1 uses three operational roles:

- Admin
- Dispatcher
- Responder

There is no Observer role in v1.

Actual authority is controlled through local ARGUS approval and capability flags, not through chat membership alone. A user can authenticate through the identity provider and still lack ARGUS access until explicitly approved.

## Architecture summary

ARGUS v1 is a modular monolith.

Core system areas include:

- records
- responders/operators
- assignments
- notes
- audit
- zones
- lifecycle
- Matrix integration
- admin/operator management
- frontend operator surfaces
- auth/session integration

The initial deployment pattern is intentionally simple: one coherent application stack with clear internal boundaries. Future optional modules can be added without turning v1 into a premature plugin platform.

## Core dependencies

A typical ARGUS deployment includes:

- Linux server environment
- nginx public reverse proxy
- FastAPI backend under Uvicorn
- PostgreSQL database
- Alembic migrations
- React/Vite frontend assets
- MAS/OIDC identity provider
- Matrix homeserver/service account for notifications

Exact installation steps depend on the final public repository layout and deployment target.
