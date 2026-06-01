# Contributing

ARGUS is being prepared for its initial public source release.

Contributions are welcome after the source-release branch is reviewed and merged.

## Before contributing

Please read:

- `README.md`
- `SECURITY.md`
- `SUPPORT.md`
- `DEPLOYMENT-DISCLOSURE.md`
- `docs/`

## Development expectations

- Do not commit secrets.
- Do not commit `.env` files.
- Do not commit database dumps, private keys, tokens, logs, or live deployment backups.
- Keep Matrix as the communication layer, not the operational source of truth.
- Keep ARGUS application/database state as the operational source of truth.
- Preserve responder-safe redaction and capability-based access controls.
- Prefer small, reviewable changes.

## Security-sensitive changes

For auth, permissions, Matrix delivery, redaction, lifecycle controls, or database migrations, include clear testing notes in the pull request.
