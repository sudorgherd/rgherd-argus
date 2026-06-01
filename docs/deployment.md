# ARGUS deployment notes

ARGUS is a FastAPI + PostgreSQL backend with a React/Vite frontend. Authentication is handled through MAS/OIDC. Matrix is used as the notification and communication layer, not as the operational database.

This document is an operator-oriented deployment outline. It is not a complete production hardening guide.

## Required components

- Linux server
- Python 3.11+ recommended
- PostgreSQL
- Node.js 20+ recommended
- nginx or another reverse proxy
- MAS / OIDC provider
- Matrix homeserver, if using Matrix notifications

## 1. Create application directory

Example:

    sudo mkdir -p /opt/argus
    sudo chown -R argus:argus /opt/argus

Copy the repository contents into `/opt/argus`.

## 2. Backend virtual environment

    cd /opt/argus
    python3 -m venv venv
    ./venv/bin/pip install --upgrade pip
    ./venv/bin/pip install -r backend/requirements.txt

## 3. Environment configuration

Copy `.env.example` to `.env` on the deployment host:

    cp .env.example .env
    chmod 600 .env

Fill in real values for:

- `ARGUS_BASE_URL`
- `SESSION_SECRET`
- `DATABASE_URL`
- `MAS_ISSUER`
- `MAS_CLIENT_ID`
- `MAS_CLIENT_SECRET`
- Matrix settings if using Matrix notifications

Do not commit `.env`.

## 4. Database migrations

    cd /opt/argus/backend
    set -a
    source /opt/argus/.env
    set +a
    ../venv/bin/alembic upgrade head

## 5. Frontend build

    cd /opt/argus
    npm ci
    npm run build
    mkdir -p /opt/argus/frontend
    rsync -a --delete dist/ /opt/argus/frontend/

## 6. systemd

Copy `deploy/systemd/argus.service.example` to `/etc/systemd/system/argus.service` and adjust paths/user if needed.

    sudo systemctl daemon-reload
    sudo systemctl enable --now argus
    sudo systemctl status argus

## 7. nginx

Copy `deploy/nginx/argus.conf.example` to your nginx sites directory, replace `argus.example.org`, configure TLS, then reload nginx.

    sudo nginx -t
    sudo systemctl reload nginx

## 8. First operator onboarding

After the first successful MAS login, ARGUS creates or updates a local responder/operator row keyed to the MAS `subject_id`.

An admin-capable operator must approve and grant capabilities in the local ARGUS database or Admin UI, depending on your deployment state.

## 9. Matrix setup

ARGUS Matrix notifications require:

- Matrix homeserver URL
- dedicated Matrix service account
- service account access token
- Matrix user domain
- zone room IDs for zone alerts
- responder Matrix IDs for direct notifications

Matrix values may be supplied through environment settings and/or the ARGUS Admin Matrix integration settings UI.

## 10. Public release safety

Before publishing a repo, verify that the tree does not include:

- `.env`
- database dumps
- backup files
- private keys
- Matrix access tokens
- MAS client secrets
- local production domains unless intentionally documented
- deployment logs
