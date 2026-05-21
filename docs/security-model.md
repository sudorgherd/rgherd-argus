# ARGUS Security Model

**Status:** Public-facing documentation draft  
**Audience:** maintainers, self-host evaluators, security reviewers, and admins

## Purpose

This document summarizes the intended ARGUS v1 security posture.

It is not a complete penetration-test report. It describes the application’s intended trust boundaries, access controls, route protection model, redaction model, and deployment assumptions.

## Trust model

ARGUS is a controlled-access operator system.

Authentication alone is not enough. A user must authenticate through the configured identity provider and also be approved in ARGUS.

Operational authority is controlled by local ARGUS capabilities, such as:

- approved
- admin
- dispatch
- respond

## Public boundary

The public edge should expose only the intended HTTP/TLS entrypoint, normally through nginx or an equivalent reverse proxy.

Recommended posture:

- nginx or equivalent reverse proxy listens publicly on 80/443
- backend application listens on loopback only
- database listens on loopback or private network only
- protected APIs return 401 when unauthenticated
- API documentation/schema routes are not publicly exposed unless intentionally enabled
- TLS certificates are valid and renewable
- security headers/HSTS are handled by the reverse proxy where appropriate

## Backend boundary

ARGUS backend is expected to run behind the public reverse proxy.

The backend owns:

- session handling
- protected routes
- role/capability enforcement
- serializer/redaction behavior
- lifecycle enforcement
- Matrix send orchestration
- audit writes

The backend should not be directly exposed to the public internet.

## Database boundary

PostgreSQL stores operational state.

It should not be publicly reachable.

Operational data may include sensitive records, notes, assignment state, operator metadata, zone data, audit entries, and Matrix routing identifiers. Self-hosting groups are responsible for their own retention, backup, and access-control policies.

## Identity provider boundary

ARGUS uses OIDC identity from an external identity provider such as MAS.

Identity provider login proves identity. ARGUS local approval grants application access.

The local ARGUS operator record is the operational overlay. It controls local display name, capabilities, approval, presence, availability, zones, and Matrix routing fields.

## Route protection

Protected API routes should require an authenticated and authorized session.

Current route categories include:

- public/session routes
- protected health route
- records
- lifecycle
- assignments
- notes
- audit
- responders/operators
- zones
- Matrix status and alerts

A responder should not receive dispatcher/admin route authority simply because they are authenticated.

## Redaction and visibility

ARGUS should expose less by default.

Responder visibility has two main states:

1. Assigned records with responder-visible detail.
2. Same-zone unassigned records in redacted form.

Same-zone visibility is situational awareness. It does not grant full record access.

Reporter identity/contact is dispatcher/admin-only by default.

Internal-only notes and dispatcher/admin-only fields should never appear in responder views or Matrix payloads unless a deployment intentionally changes the policy and accepts the risk.

## `/me` route hygiene

The current operator-bootstrap route should return only the state needed by the frontend shell.

It should not expose:

- raw OIDC token payloads
- decoded ID token claims
- access tokens
- raw userinfo
- debug-only token data

## Lifecycle security

Archived records are read-only.

Normal mutation routes should block archived records, including:

- generic record update
- notes
- assignments
- assignment updates
- assignment deletes
- closure edits

Purge is admin-only, archived-only, and destructive.

## Matrix security

Matrix tokens are secrets.

Do not publish:

- Matrix access tokens
- MAS client secrets
- session secrets
- database URLs containing credentials
- live server IPs or private deployment details unless intentionally public

Matrix payloads should exclude:

- reporter identity
- reporter contact
- internal-only notes
- internal-only fields
- admin-only context
- fields outside the recipient’s visibility ceiling

Matrix send failure should be visible and audited, but should not crash the underlying ARGUS operation when Matrix is a side effect.

## Repository hygiene before public release

Before publishing source, verify that the release repository does not include:

- `.env`
- live database dumps
- backup archives
- `.bak` files
- logs
- Python bytecode
- `__pycache__`
- real secrets
- live Matrix tokens
- MAS client secrets
- hardcoded deployment-only hostnames unless clearly example-only
- private internal reports not converted into public documentation

## Security disclaimer

ARGUS is not guaranteed secure against all threats. Operators and self-hosting groups are responsible for hardening their own deployment, monitoring logs, managing secrets, reviewing updates, and complying with applicable laws and policies.
