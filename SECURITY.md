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

- **No secrets in git, ever.** Gitleaks runs on the staged diff at every
  commit, on the full history at every push and before every merge
  (`just secrets`, skill `local-ci`), TruffleHog nightly; a missing scanner
  fails the tier. A leaked secret is rotated first, then purged from
  history (see CONTRIBUTING § Security).
- **Dependencies**: GitHub Dependabot alerts + security updates are enabled;
  `.github/dependabot.yml` opens weekly grouped PRs for npm and GitHub Actions.
  Production dependencies: none (the widget has zero runtime dependencies).
- **GitHub Actions**: one workflow only, `prod.yml`, on a signed `v*` tag;
  every third-party action is pinned to a commit SHA, `permissions: {}` at
  the top with least privilege per job, and the publish runs only after the
  trusted `scripts/attest.sh release` of `main` verified the tag signature,
  the gate status and the staging note.
- **Rendering**: the widget renders inside a shadow root; every user-provided
  string is HTML-escaped before insertion. Host-provided configuration is
  trusted by design (it is the integrator's own code).
- **Client-side storage**: when a submission fails (network or server error)
  the **full feedback payload** is queued in `localStorage` for retry: free-text
  message, optional reporter name, page URL and referrer, user agent, viewport,
  session id, widget version and the targeted element's descriptor (never a
  form field's content, typed, prefilled or editable). The outbox keeps at most 50 entries for up to 7 days,
  then purges them; the rate limiter stores only timestamps. Both are
  namespaced per project and readable by any script on the same origin, as all
  `localStorage` is. Integrators who collect feedback on pages with sensitive
  content should disclose this in their privacy notice.
- **Transport**: the payload is POSTed to the integrator's endpoint. Origin
  filtering, rate limiting and validation are enforced server-side by
  `feedback-pipeline-worker`.

## Accepted risks (reviewed 2026-11-13)

| Finding                                 | Why accepted                                                                                                                                            | Review trigger                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `main` not branch-protected             | GitHub Free does not offer protection on private repos. The pre-push hook (`just check`) and the gate attestation `just merge` demands are the barrier. | Repo goes public, or the plan changes.               |
| No CodeQL / Dependency Review workflows | Both need GitHub Advanced Security on private repos.                                                                                                    | Repo goes public (see the public release checklist). |
