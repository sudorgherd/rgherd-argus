# Security Policy

ARGUS v1.3.0 is the current release candidate and remains under active development.

## Supported versions

Version v1.3.0 is the currently supported source line. Deployments should be reviewed carefully, and later tagged releases may revise the supported-version policy.

## Reporting security issues

Do not report sensitive vulnerabilities through public issues.

For now, send security-sensitive reports to:

    help@rgherd.com

Include:

- affected component
- impact summary
- reproduction steps, if safe to share
- whether the issue may expose secrets, private data, auth flows, Matrix routing, or operator records

## Public issue guidance

Use public issues only for non-sensitive bugs, documentation problems, feature requests, and general development discussion.

Do not post:

- secrets
- live tokens
- private keys
- database dumps
- private user data
- operational logs containing sensitive data
- exploit chains against live deployments
