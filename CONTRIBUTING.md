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

## AI-assisted contributions

Contributions may use AI-assisted tooling, but contributors are responsible for reviewing, testing, and understanding the submitted changes.

Do not submit AI-assisted code, documentation, generated examples, logs, or prompts that include secrets, private credentials, private user data, operational logs, or third-party material that cannot be legally contributed under this project license.
