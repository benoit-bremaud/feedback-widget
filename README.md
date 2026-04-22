# feedback-widget

[![CI](https://github.com/benoit-bremaud/feedback-widget/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/benoit-bremaud/feedback-widget/actions/workflows/ci.yml)
[![Gitleaks](https://github.com/benoit-bremaud/feedback-widget/actions/workflows/gitleaks.yml/badge.svg?branch=main)](https://github.com/benoit-bremaud/feedback-widget/actions/workflows/gitleaks.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=benoit-bremaud_feedback-widget&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=benoit-bremaud_feedback-widget)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-workspaces-f69220)](https://pnpm.io/workspaces)
[![License: UNLICENSED](https://img.shields.io/badge/license-UNLICENSED-lightgrey)](LICENSE)

Cross-project in-app feedback widget for collecting bug reports during
development and QA phases. Drop it into any web project with a
three-line mount call — it renders a floating button, captures
category + free-text + contextual metadata (viewport, page URL,
target DOM block), and POSTs the payload to your backend.

## Status

Currently at `v0.1.0`, private, `UNLICENSED`. This project is
intentionally private and is **not published to the public npm
registry**. Consumers install it from the **GitHub Packages
private registry** under this repository — see
[Installation](#installation) for the recommended path
(`pnpm add @benoit-bremaud/feedback-widget` with a
`read:packages` PAT), or one of the git-URL fallbacks. The
transition to public npm will only happen after a full security
audit, per the repo's private-first policy.

## Quickstart

```ts
import { mountFeedbackWidget } from '@benoit-bremaud/feedback-widget';

mountFeedbackWidget({
  endpoint: 'https://api.example.com/feedback',
  projectId: 'my-project',
});
```

That's the minimum. The widget renders a floating button in the
bottom-right corner; users click it, pick a category, optionally point
at a page block, type a message, and submit. The payload is POSTed to
`endpoint` with a `X-Feedback-Token` header if `token` is configured.

<!--
  Screenshot placeholder: add a real screenshot of the widget in the
  `docs/` directory and reference it here once the UI is stable.
  The mermaid diagram below is a first approximation of the UX flow.
-->

### UX flow

```mermaid
flowchart LR
  closed[Closed — floating button] -->|click| targetConfirm[Target confirm]
  targetConfirm -->|confirm| type[Category type]
  targetConfirm -->|reject| pointing[Pointing mode]
  pointing -->|pick| targetConfirm
  type -->|select| precision[Precision / message]
  precision -->|submit| sending[Sending]
  sending -->|ok| confirmation[Confirmation]
  sending -->|network/server| outboxFallback[Outbox + mailto fallback]
  sending -->|rate-limited / invalid| error[Error]
```

## Installation

Node 20+ and pnpm (or npm) required. Three installation methods are
documented, in order of preference: **GitHub Packages** (recommended),
git + HTTPS + PAT, and git + SSH.

### Recommended — GitHub Packages

The packages are published to the GitHub Packages private registry
(`https://npm.pkg.github.com`). Consumers authenticate with a PAT
that has the `read:packages` scope.

1. Create a GitHub PAT with `read:packages` (classic) or a fine-grained
   token with `Packages: Read` on this repo.
2. In your consumer project, add `.npmrc` (safe to commit — the token
   is resolved from env, never written into the file):

   ```ini
   @benoit-bremaud:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
   ```

3. Export the PAT and install:

   ```sh
   export GITHUB_TOKEN="<your-PAT-with-read:packages>"
   pnpm add @benoit-bremaud/feedback-widget
   ```

The consumer-side `.npmrc`, the PAT rotation policy, and the full CI
auth pattern are documented in
[`.github/publish.md`](.github/publish.md).

The remaining two methods are for environments where GitHub Packages
is not reachable or where you need to pin to a non-tagged commit.

### Option A — git + HTTPS + PAT

Install with a token-less URL — this is important: embedding the
PAT directly in the URL would cause pnpm to persist the expanded
URL (with the token) into `package.json` and/or `pnpm-lock.yaml`,
leaking the secret into the consumer's git history.

```sh
pnpm add "https://github.com/benoit-bremaud/feedback-widget.git#main"
```

Pin to a tag for reproducible builds:

```sh
pnpm add "https://github.com/benoit-bremaud/feedback-widget.git#v0.1.0"
```

The install above only works once git itself knows how to
authenticate to GitHub. Configure that once, separately from the
install command, using one of the approaches below.

**Local dev — credential helper (recommended)** — PAT cached by the
OS, prompted once on first access:

```sh
# macOS Keychain (default on macOS)
git config --global credential.helper osxkeychain
# Windows Credential Manager
git config --global credential.helper manager
# Linux: libsecret, or the built-in cache helper
git config --global credential.helper "cache --timeout=3600"
```

1. Create a GitHub PAT with scope `repo` (classic) or a fine-grained
   token scoped to this repo with `Contents: Read` permission.
2. Run `git ls-remote https://github.com/benoit-bremaud/feedback-widget.git`
   once — git prompts for your username + the PAT as the password;
   the helper stores it.

**Local dev — url.insteadOf rewrite (alternative)** — stores a
rewrite rule in `~/.gitconfig`, never in project files:

```sh
git config --global url."https://<PAT>@github.com/".insteadOf "https://github.com/"
```

### Option B — git + SSH

With an SSH key already registered on your GitHub account:

```sh
pnpm add "git+ssh://git@github.com/benoit-bremaud/feedback-widget.git#main"
```

SSH avoids PAT management and keychain/credential-helper setup
entirely — the key in `~/.ssh/` is picked up automatically. Simpler
on a dev workstation, harder in CI (needs a deploy key or
ssh-agent step).

### Consumer CI authentication

CI environments installing via git need credentials wired to the
git process itself — NOT just to the install command's env. Two
sanctioned patterns:

**git + HTTPS + PAT via `url.insteadOf`** — portable across most CI
providers, no secrets in project files:

```yaml
- name: Configure git credentials
  env:
    GH_TOKEN: ${{ secrets.FEEDBACK_WIDGET_INSTALL_TOKEN }}
  run: |
    git config --global url."https://x-access-token:${GH_TOKEN}@github.com/".insteadOf "https://github.com/"

- name: Install dependencies
  run: pnpm install
```

The `url.insteadOf` rewrite lives in the runner-wide git config
only; it does NOT leak into `package.json` or `pnpm-lock.yaml`.

**git + SSH via deploy key** — add a deploy key or a dedicated
service account SSH key to the repository's deploy-keys list, then:

```yaml
- name: Set up SSH for private git dep
  uses: webfactory/ssh-agent@v0.9.0
  with:
    ssh-private-key: ${{ secrets.FEEDBACK_WIDGET_DEPLOY_KEY }}

- name: Install dependencies
  run: pnpm install
```

## Configuration

### `WidgetConfig`

| Field | Required | Default | Description |
| ----- | -------- | ------- | ----------- |
| `endpoint` | ✓ | — | URL that receives the `POST` with the feedback payload (JSON). |
| `projectId` | ✓ | — | Identifier carried in the payload; lets the backend route/separate per project. |
| `token` | — | `null` | Sent as `X-Feedback-Token` header. Treat as public — it's bundled in the browser; use the backend to validate caller identity properly. |
| `categories` | — | `null` | Override the list of categories offered. Values must be drawn from `Category` (see [API Reference](#api-reference)). When `null`, all six built-in categories are shown. |
| `maxMessageLength` | — | `500` | Max length of the free-text field. Longer input is silently truncated. |
| `rateLimitWindowMs` | — | `600_000` (10 min) | Rolling window for the client-side rate limiter (per `projectId`, stored in `localStorage`). |
| `rateLimitMaxAttempts` | — | `3` | Max submissions per window before the widget shows a rate-limit message. |
| `minFormOpenMs` | — | `2000` | Bot heuristic — submissions faster than this are silently accepted but discarded (honeypot-style). |
| `maxTransportAttempts` | — | `3` | Retries per submission (exponential backoff starting at 1 s). |
| `transportTimeoutMs` | — | `10_000` | Per-attempt abort timeout (ms). Implemented via `AbortController`; feature-detected so legacy browsers fall back to a plain fetch. |
| `mailtoFallback` | — | `null` | When the transport exhausts retries, offer a `mailto:` fallback to this address so users can still reach you. |
| `position` | — | `'bottom-right'` | Floating button position: `'bottom-right'`, `'bottom-left'`, or `'bottom-center'`. |

### Minimal example

```ts
import { mountFeedbackWidget } from '@benoit-bremaud/feedback-widget';

mountFeedbackWidget({
  endpoint: 'https://api.example.com/feedback',
  projectId: 'my-project',
});
```

### Full example

```ts
import { mountFeedbackWidget } from '@benoit-bremaud/feedback-widget';
import type { WidgetConfig } from '@benoit-bremaud/feedback-widget';

const config: WidgetConfig = {
  endpoint: 'https://api.example.com/feedback',
  projectId: 'my-project',
  token: 'public-project-token-abc',
  categories: ['bug', 'typo', 'suggestion'],
  maxMessageLength: 1000,
  rateLimitWindowMs: 15 * 60 * 1000,
  rateLimitMaxAttempts: 5,
  minFormOpenMs: 3000,
  maxTransportAttempts: 4,
  transportTimeoutMs: 8000,
  mailtoFallback: 'team@example.com',
  position: 'bottom-right',
};

const handle = mountFeedbackWidget(config);

// Call after a SPA route change or major DOM mutation so the widget's
// target-block detection is re-scoped to the new content.
handle.refresh();
```

## API Reference

### `mountFeedbackWidget(config: WidgetConfig): FeedbackWidgetHandle`

Mounts the widget as a Web Component (`<feedback-widget>`) appended to
`document.body`. Safe to call multiple times: re-mounting on a page
that already has a widget re-uses the existing instance and calls
`refresh()` on it. SSR-safe: returns a no-op handle when `window` is
undefined.

### `FeedbackWidgetHandle.refresh(): void`

Re-scans the observed page blocks. Call it after:

- a SPA route change
- any DOM mutation that replaces the content area

so the viewport detector and the pointing mode target the current
page's blocks.

### Exported types

- `WidgetConfig` — configuration object shape (see [Configuration](#configuration)).
- `Category` — feedback category identifier. One of:
  `'bug'`, `'typo'`, `'error'`, `'ambiguous'`, `'suggestion'`, `'other'`.
- `FeedbackWidgetHandle` — return type of `mountFeedbackWidget`.

The core package (`@benoit-bremaud/feedback-widget-core`) additionally
exports domain types (`FeedbackPayload`, `Viewport`, `TargetBlock`,
etc.) for backend implementations — use them to type the request body
server-side.

## Production disable (env gating)

The widget is intended for **dev and QA use only**. Gate the mount on
an environment flag so it is never present in production bundles. The
recommended pattern uses the bundler's build-time env:

```ts
if (import.meta.env.DEV) {
  mountFeedbackWidget({ /* ... */ });
}
```

Or via an explicit flag (Vite-style):

```ts
if (import.meta.env.VITE_FEEDBACK_WIDGET_ENABLED === 'true') {
  mountFeedbackWidget({ /* ... */ });
}
```

In a Vite/VitePress build, `import.meta.env.DEV` is a compile-time
constant: the branch is dead-code eliminated in production and the
widget's code is tree-shaken out of the final bundle.

## VitePress integration — Impropedia case

Impropedia is a VitePress site that embeds the widget in its custom
theme so contributors can report content/UX bugs while authoring.

`.vitepress/theme/index.ts`:

```ts
import DefaultTheme from 'vitepress/theme';
import { mountFeedbackWidget } from '@benoit-bremaud/feedback-widget';

export default {
  extends: DefaultTheme,
  setup() {
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      mountFeedbackWidget({
        endpoint: import.meta.env.VITE_FEEDBACK_ENDPOINT as string,
        projectId: 'impropedia',
        mailtoFallback: 'contact@impropedia.example',
      });
    }
  },
};
```

`.env.local`:

```dotenv
VITE_FEEDBACK_ENDPOINT=https://api.impropedia.example/feedback
```

`typeof window !== 'undefined'` is belt-and-braces — VitePress's dev
server already runs `setup()` in a client context, but the guard
keeps the call safe if you later run the theme in an SSR-first
context.

## Local development

### Clone + install

```sh
git clone git@github.com:benoit-bremaud/feedback-widget.git
cd feedback-widget
pnpm install
pnpm build
```

The repo is a pnpm workspace with two packages:

- `packages/core` — `@benoit-bremaud/feedback-widget-core` (pure logic,
  DOM-free, runtime-agnostic).
- `packages/web` — `@benoit-bremaud/feedback-widget` (browser
  implementation, Web Component view, fetch transport, localStorage
  outbox + rate limiter).

### Tests

```sh
pnpm test            # all packages
pnpm test:coverage   # with coverage (vitest v8 provider)
pnpm typecheck       # tsc --noEmit across packages
```

### Testing changes in a consumer project (before cutting a tag)

Use pnpm's global link, making sure the **workspace package** is linked
(not the root private package):

```sh
# In this repo — link the web package, not the workspace root
pnpm install
pnpm build
pnpm --filter @benoit-bremaud/feedback-widget link --global
```

Alternative (equivalent): `cd packages/web && pnpm link --global`.

Do NOT run `pnpm link --global` at the workspace root — that links the
root `feedback-widget` private package, not `@benoit-bremaud/feedback-widget`,
and the next consumer-side link then fails with a broken-link warning.

Then in the consumer project:

```sh
pnpm link --global @benoit-bremaud/feedback-widget
```

Rebuild with `pnpm --filter @benoit-bremaud/feedback-widget build`
after changes; the consumer picks up the new `dist/` automatically
on its next import.

### Contributing

Contribution conventions (branch naming, commit style, review
protocol, PROJECT_LOG update rule) will be documented in
`CONTRIBUTING.md` when that file lands — tracked as issue
[#5](https://github.com/benoit-bremaud/feedback-widget/issues/5).

## Roadmap

- **v0.1.0** — initial extraction from Impropedia (released, see
  [`CHANGELOG.md`](CHANGELOG.md)).
- **v0.2.0** — Foundations (in progress): README, CONTRIBUTING,
  branch protection, PROJECT_LOG, security CI baseline, ESLint +
  Prettier, coverage thresholds, release workflow. Track milestone
  [v0.2.0 — Foundations](https://github.com/benoit-bremaud/feedback-widget/milestone/1).
- **v0.3.0+** — React Native adapter for mobile-first projects
  (design tracked in issue
  [#15](https://github.com/benoit-bremaud/feedback-widget/issues/15)).
  The `core` package is already RN-ready (DOM-free); only the
  adapters need to be written.

## Related docs

- [CHANGELOG.md](CHANGELOG.md) — semver release notes.
- [PROJECT_LOG.md](PROJECT_LOG.md) — operational logbook
  (PRs merged, decisions, backlog events).
- [.github/branch-protection.md](.github/branch-protection.md) —
  canonical reference for the `main`-branch protection config.
- [Impropedia — feedback-widget-spec.md](https://github.com/benoit-bremaud/impropedia/blob/main/docs/feedback-widget-spec.md) —
  historical context on why the widget was built and the requirements
  it answers.

## License

UNLICENSED — private. See [`LICENSE`](LICENSE).
