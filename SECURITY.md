# Security Policy

## Supported versions

| Version             | Supported |
| ------------------- | --------- |
| latest `vX.Y.Z` tag | Yes       |
| older tags          | No        |

The widget is distributed as a versioned bundle (`widget-X.Y.Z.js`). Integrators
pin a version and bump deliberately; only the latest release receives fixes.

## Reporting a vulnerability

1. **Do not open a public issue.**
2. Email **bbd.concept@gmail.com** with a description, reproduction steps and
   the impact you foresee.
3. You get an acknowledgment within **48 hours** and a fix prioritised by
   severity.

## What the project does

- **No secrets in git, ever.** Gitleaks runs locally when installed
  (`pnpm verify` announces it when missing), in CI on every push and PR, and
  on a weekly cron. A leaked secret is rotated first, then purged from
  history (see CONTRIBUTING § Security).
- **Dependencies**: GitHub Dependabot alerts + security updates are enabled;
  `.github/dependabot.yml` opens weekly grouped PRs for npm and GitHub Actions.
  Production dependencies: none (the widget has zero runtime dependencies).
- **GitHub Actions**: every third-party action is pinned to a commit SHA and
  every workflow declares least-privilege `permissions`.
- **Rendering**: the widget renders inside a shadow root; every user-provided
  string is HTML-escaped before insertion. Host-provided configuration is
  trusted by design (it is the integrator's own code).
- **Client-side storage**: outbox and rate-limiter data are bounded and
  namespaced per project; nothing sensitive is stored.
- **Transport**: the payload is POSTed to the integrator's endpoint. Origin
  filtering, rate limiting and validation are enforced server-side by
  `feedback-pipeline-worker`.

## Accepted risks (reviewed 2026-10-15)

| Finding                                                                        | Why accepted                                                                                                                                     | Review trigger                                                                               |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `node-forge` ≤ 1.4.0 (RSA PKCS#1 v1.5 signature check) via `sonarqube-scanner` | No fixed upstream version. Dev-only, runs on the maintainer's machine during the local SonarQube scan; never in CI, never in the shipped bundle. | A patched `node-forge` or a scanner release without it; re-run `pnpm audit` at each release. |
| `main` not branch-protected                                                    | GitHub Free does not offer protection on private repos. The pre-push hook (`pnpm verify`) is the gate.                                           | Repo goes public, or the plan changes.                                                       |
| No CodeQL / Dependency Review workflows                                        | Both need GitHub Advanced Security on private repos.                                                                                             | Repo goes public (see the public release checklist).                                         |
