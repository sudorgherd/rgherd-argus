<img width="1536" height="1024" alt="ARGUS_landing" src="https://github.com/user-attachments/assets/2db5f172-3600-428f-8658-2abb24460d5f" />
# ARGUS

ARGUS is a self-hosted operator interface for dispatcher-mediated community coordination.

It is designed around one core rule:

> Operational state lives in ARGUS. Communication lives in Matrix.

ARGUS uses a FastAPI backend, PostgreSQL, a React/Vite frontend, MAS/OIDC authentication, and optional Matrix notification delivery.

## Current status

This repository contains the public source release of ARGUS version `v1.0.0`.

ARGUS is under active development. It is not yet a polished one-command installer, and deployments should be reviewed carefully before operational use.

## Project ecosystem

ARGUS is developed by [RaveGoat Labs](https://ravegoat.com/) as part of the wider [RG Herd](https://rgherd.com/) privacy-first communications and coordination ecosystem.

Related public projects:

- [ARGUS REDLINE](https://github.com/sudorgherd/argus-redline) — experimental long-range radio firmware and off-grid coordination infrastructure
- [ARGUS v1.0.0 release](https://github.com/sudorgherd/rgherd-argus/releases/tag/v1.0.0) — the first public source release
- [RG Herd](https://rgherd.com/) — project overview and public coordination infrastructure

## What ARGUS does

ARGUS provides a structured operational layer for:

- intake records
- active response tracking
- dispatcher workflow
- responder availability and presence
- assignment tracking
- append-only notes
- audit history
- zone-aware visibility
- lifecycle handling for working, closed, archived, and purged records
- Matrix-backed alert delivery

## What ARGUS is not

ARGUS is not:

- a replacement for Matrix
- a public free-for-all reporting portal
- a social network
- a one-click SaaS product
- an emergency service
- a replacement for 911, emergency medical services, fire services, law enforcement, crisis services, or other professional emergency response systems

ARGUS is built for trusted, self-hosted, operator-mediated use.

## Core architecture

- Backend: FastAPI
- Database: PostgreSQL
- Migrations: Alembic
- Frontend: React + Vite
- Auth: MAS / OIDC
- Communications: Matrix
- Reverse proxy: nginx recommended

## Configuration

Runtime configuration is environment-driven.

Start with:

    .env.example

Copy it to `.env` on the deployment host and fill in deployment-specific values.

Never commit real `.env` files, secrets, access tokens, database dumps, private keys, or production backups.

## Backend setup

Python dependencies are listed in:

    backend/requirements.txt

Database migrations are managed through Alembic under:

    backend/alembic/

## Frontend setup

Install frontend dependencies:

    npm ci

Build frontend assets:

    npm run build

## Deployment

See:

    docs/deployment.md

Example deployment templates are provided under:

    deploy/

Included examples:

- `deploy/systemd/argus.service.example`
- `deploy/nginx/argus.conf.example`

## Matrix integration

ARGUS can send Matrix notifications for record and assignment workflows.

Matrix configuration may include:

- homeserver URL
- dedicated ARGUS Matrix service account
- Matrix access token
- Matrix user domain
- zone room IDs
- responder Matrix user IDs

Matrix is treated as the notification and communication layer. ARGUS remains the operational source of truth.

## Security posture

ARGUS is designed for privacy-conscious, vetted coordination environments.

Public release safety goals include:

- no committed secrets
- environment-based configuration
- protected API routes
- database-backed operator approval/capability controls
- responder-safe redaction paths
- Matrix payload privacy limits

This repository should still be reviewed carefully before production use.

## License

ARGUS is licensed under the GNU Affero General Public License v3.0 or later.

## AI-assisted development disclosure

ARGUS is developed with AI-assisted tooling as part of the engineering workflow.

Human maintainers direct the architecture, review code changes, test behavior, control releases, and remain responsible for security, privacy, licensing, and operational decisions. AI assistance may be used for drafting, refactoring, documentation, debugging support, test planning, and implementation guidance.

No secrets, private deployment credentials, live tokens, private user data, or operational logs should be included in public source releases.
