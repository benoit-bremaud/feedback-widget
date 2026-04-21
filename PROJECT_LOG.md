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
