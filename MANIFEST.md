# ARGUS Public Source Release Manifest

Status: source-release candidate
Version: v0.9.1

This repository contains:

## Application source

- `backend/` — FastAPI backend, database models, Alembic migrations, auth/config, Matrix integration logic
- `src/` — React/Vite frontend source
- `public/` — static public frontend assets
- `tests/` — smoke/e2e test assets where present

## Configuration and deployment

- `.env.example` — public-safe runtime configuration template
- `backend/requirements.txt` — Python dependency manifest
- `package.json` / `package-lock.json` — frontend dependency manifest
- `deploy/systemd/argus.service.example` — example systemd service
- `deploy/nginx/argus.conf.example` — example nginx reverse proxy config
- `docs/deployment.md` — deployment outline

## Governance and project docs

- `README.md`
- `LICENSE`
- `SECURITY.md`
- `SUPPORT.md`
- `CONTRIBUTING.md`
- `CHANGELOG.md`
- `NOTICE.md`
- `TRADEMARKS.md`
- `DEPLOYMENT-DISCLOSURE.md`
- `docs/`

## Exclusions

The public source tree must not include:

- `.env`
- real secrets
- Matrix access tokens
- MAS client secrets
- database dumps
- private keys
- production backups
- operational logs
- private deployment configuration
