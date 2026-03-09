# Security Policy

## Supported Versions

This project is a static front‑end application built with React and Vite. The latest commit on the `main` branch is considered the supported version.

If you are running a fork or custom deployment, you are responsible for keeping dependencies up to date (for example with `npm audit` and periodic dependency updates).

## Reporting a Vulnerability

If you discover a security issue that affects this project:

1. **Do not** open a public GitHub issue describing the vulnerability.
2. Instead, contact the maintainer privately (for example via the email address associated with the GitHub profile that owns this repository) with:
   - A clear description of the issue and its impact
   - Steps to reproduce
   - Any suggested fixes or mitigations

You can also temporarily remove any sensitive data from your reproduction steps before sharing them.

The maintainer will:

- Acknowledge receipt of your report as soon as reasonably possible
- Investigate and confirm the issue
- Work on a fix or mitigation
- Coordinate public disclosure timing if needed

## Security Best Practices for Deployments

When deploying this app:

- Serve it over **HTTPS** only.
- Configure your hosting to send modern security headers where possible (e.g. `Strict-Transport-Security`, `X-Content-Type-Options`, and `X-Frame-Options`).
- Keep your build and runtime environment (Node.js, package manager, CI runners) up to date.

Because this repo does not include a backend or database, most security concerns relate to dependency supply chain and deployment configuration rather than server‑side logic.

