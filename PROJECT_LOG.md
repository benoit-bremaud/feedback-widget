# Project Log

Chronological logbook of all significant project activity — PRs merged,
architectural decisions, backlog reorganisations, deliverables produced.

This file is complementary to [CHANGELOG.md](./CHANGELOG.md): the changelog
records published versions; this log records the day-to-day operational
journal behind them.

New entries are appended to the bottom as events occur.

---

## 2026-04-20

### Initial commit

- **What:** Created the repository with a README placeholder.
- **Why:** Bootstrap the standalone `feedback-widget` project, extracted
  from Impropedia for reuse outside the original application.
- **Ref:** commit [`b8ddd8d`](https://github.com/benoit-bremaud/feedback-widget/commit/b8ddd8d)

### Monorepo scaffold

- **What:** Initialised the pnpm workspace with two packages
  (`packages/core`, `packages/web`), shared TypeScript base config,
  Vitest setup (node env for `core`, happy-dom for `web`), and a CI
  workflow running typecheck + build + test.
- **Why:** Separate pure-logic code from browser adapters so the core can
  be reused across runtimes (browser today, React Native later) and so
  every package can be tested in isolation.
- **Ref:** commit [`9659f7e`](https://github.com/benoit-bremaud/feedback-widget/commit/9659f7e)

### Extraction from Impropedia

- **What:** Ported the feedback widget's domain, ports, use-cases, and
  config to `packages/core`, and moved adapters + the widget entry point
  to `packages/web`. 24 core tests and 16 web tests carried over.
- **Why:** Complete the hexagonal split started by the scaffold — `core`
  stays DOM-free and runtime-agnostic, web-specific code lives in its
  own package with a single public entry point (`mountFeedbackWidget`).
- **Ref:** commit [`dec890d`](https://github.com/benoit-bremaud/feedback-widget/commit/dec890d)

### v0.1.0 release

- **What:** Recorded the initial extraction in `CHANGELOG.md` and tagged
  `v0.1.0`.
- **Why:** Mark the project's first snapshot as a reusable baseline for
  downstream work and future releases.
- **Ref:** commit [`c64120f`](https://github.com/benoit-bremaud/feedback-widget/commit/c64120f),
  tag [`v0.1.0`](https://github.com/benoit-bremaud/feedback-widget/releases/tag/v0.1.0)

## 2026-04-21

### PR #2 merged — HTTP transport timeout + AbortController guard

- **What:** Added a per-attempt fetch timeout in `HttpTransport` backed
  by `AbortController`, exposed `transportTimeoutMs` in `WidgetConfig`
  (default 10 000 ms), and wired it through the web composition root.
  The `AbortController` instantiation is feature-detected so legacy
  environments (older Safari/WebView with `fetch` but no
  `AbortController`) fall back to a plain fetch without throwing. Added
  4 unit tests covering distinct signal per attempt, abort-on-timeout,
  retry after timeout, and all-attempts-timeout. Reordered the CI
  workflow so `build` runs before `typecheck` and workspace `.d.ts`
  files resolve.
- **Why:** A stalled backend request previously left the widget stuck in
  `step: 'sending'` indefinitely. The timeout guard aborts such requests
  and retries them through the normal retry path, falling back to the
  outbox and mailto once attempts are exhausted.
- **Ref:** PR [#2](https://github.com/benoit-bremaud/feedback-widget/pull/2),
  merge commit [`9334f8f`](https://github.com/benoit-bremaud/feedback-widget/commit/9334f8f)

### PR #18 merged — initialise PROJECT_LOG.md

- **What:** Added `PROJECT_LOG.md` at the repo root with five initial
  entries reconstituted from `git log` (initial commit, monorepo
  scaffold, extraction from Impropedia, v0.1.0 release, PR #2 merge).
  Established the `What / Why / Ref` format and the convention that new
  entries are appended at the bottom.
- **Why:** The global governance policy requires a day-to-day operational
  logbook for every project, distinct from `CHANGELOG.md` (releases
  only). Closes issue [#6](https://github.com/benoit-bremaud/feedback-widget/issues/6)
  (`prio:P0`).
- **Ref:** PR [#18](https://github.com/benoit-bremaud/feedback-widget/pull/18),
  merge commit [`004ee35`](https://github.com/benoit-bremaud/feedback-widget/commit/004ee35)

### PR #19 merged — branch protection policy + activation on `main`

- **What:** Added `.github/branch-protection.md` as the canonical,
  committed reference for the `main`-branch protection config: PR
  required before merge, strict status checks (`build-test` +
  `SonarCloud Code Analysis`), linear history, force-pushes blocked,
  deletions blocked, `required_approving_review_count: 0` (solo-dev
  pragmatism), `enforce_admins: false` (owner bypass kept as an
  emergency escape hatch). The `gh api` command was applied on `main`
  after the PR merged; the protection payload was read back to confirm
  the declared policy is active.
- **Why:** Prevent accidental destructive operations on `main`
  (direct pushes, force-pushes, deletions) and require the CI gates
  to pass before any merge, while staying practical for a solo-dev
  workflow. Closes issue [#9](https://github.com/benoit-bremaud/feedback-widget/issues/9)
  (`prio:P1`).
- **Ref:** PR [#19](https://github.com/benoit-bremaud/feedback-widget/pull/19),
  merge commit [`caa99e0`](https://github.com/benoit-bremaud/feedback-widget/commit/caa99e0)

### PR #20 merged — security CI baseline (Gitleaks, CodeQL, Dependency Review)

- **What:** Added the three mandatory security workflows under
  `.github/workflows/`: `gitleaks.yml` (secret detection on push, PR,
  and weekly schedule; full git history audit via `fetch-depth: 0`),
  `codeql.yml` (SAST for `javascript-typescript` on push to `main`,
  PRs into `main`, and weekly schedule), and `dependency-review.yml`
  (CVE review on PRs, `fail-on-severity: high`). All third-party
  actions pinned by commit SHA. `codeql.yml` and `dependency-review.yml`
  are gated on `github.event.repository.visibility == 'public'`
  because both require GitHub Advanced Security on private repos —
  they are SKIPPED today and auto-activate if the repo becomes public.
  Gitleaks runs unconditionally (SARIF upload is handled by the action
  itself and silently skipped on private without GHAS).
- **Why:** The global CLAUDE.md security baseline requires Gitleaks +
  CodeQL + Dependency Review on every project. The GHAS gating is the
  pragmatic trade-off for a private repo without Advanced Security:
  workflows stay committed and ready, infrastructure investment is
  preserved, and no further change is needed the day the repo becomes
  public or GHAS is enabled. Closes issue
  [#4](https://github.com/benoit-bremaud/feedback-widget/issues/4)
  (`prio:P0`, `security`).
- **Note:** This PR also updated the PROJECT_LOG convention — entries
  are now added by the PR that introduces the change (pre-merge) rather
  than deferred to the next PR, after user feedback to record
  everything in the logbook as work happens.
- **Ref:** PR [#20](https://github.com/benoit-bremaud/feedback-widget/pull/20),
  merge commit [`193d37a`](https://github.com/benoit-bremaud/feedback-widget/commit/193d37a)

### PR #21 merged — comprehensive README

- **What:** Replaced the 2-line stub `README.md` with a full integration
  guide: status banner, badges (CI, Gitleaks, SonarCloud, Node, pnpm,
  License), quickstart, mermaid diagram of the widget UX flow,
  installation with two auth flavours (git+HTTPS+PAT, git+SSH) including
  consumer-CI examples, configuration table for the 10 `WidgetConfig`
  fields, minimal + full TypeScript examples, API reference for
  `mountFeedbackWidget` + `FeedbackWidgetHandle` + exported types,
  production-disable pattern via `import.meta.env.DEV`, VitePress
  integration example (Impropedia case), local development workflow
  including `pnpm link`, roadmap, related docs cross-links, and a link
  to the historical Impropedia `feedback-widget-spec.md`.
- **Why:** An integrator (future-me in 6 months, or a new collaborator)
  should be able to mount the widget in under 10 minutes. Closes issue
  [#3](https://github.com/benoit-bremaud/feedback-widget/issues/3)
  (`prio:P0`).
- **Ref:** PR [#21](https://github.com/benoit-bremaud/feedback-widget/pull/21),
  merge commit: *to be updated post-merge*
