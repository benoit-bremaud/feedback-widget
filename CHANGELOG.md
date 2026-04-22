# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1-rc1] - 2026-04-22

First release candidate published to GitHub Packages
(`https://npm.pkg.github.com`). This is an RC — `pnpm add
@benoit-bremaud/feedback-widget` continues to resolve to the
(git-URL-only) `0.1.0` baseline; consumers who want the RC must opt
in with `pnpm add @benoit-bremaud/feedback-widget@rc`.

### Added

- Tag-driven publish workflow
  ([`.github/workflows/publish.yml`](.github/workflows/publish.yml))
  triggered on any `v*` tag. Derives the npm `--tag` from the tag
  name: stable (`vX.Y.Z`) → `latest`, prerelease (`vX.Y.Z-*`) →
  `rc`. Gates publishes on the tagged commit being an ancestor of
  `origin/main`.
- Canonical publish policy doc
  ([`.github/publish.md`](.github/publish.md)) covering the release
  flow, consumer `.npmrc` template, PAT scopes, CI auth pattern,
  90-day rotation, and end-to-end verification recipe.
- `publishConfig.registry = https://npm.pkg.github.com` plus
  `repository` / `homepage` / `bugs` metadata on both
  `packages/core/package.json` and `packages/web/package.json`.

### Changed

- `HttpTransport` now aborts each fetch attempt after a configurable
  `timeoutMs` (required dep). An aborted request is treated as a network
  error and retried until `maxAttempts` is exhausted. Prevents the widget
  from being stuck in the `sending` step when the backend never responds.
- `WidgetConfig` gains an optional `transportTimeoutMs` (defaults to
  10 000 ms). The composition root wires it into `createHttpTransport`.
- `README.md` rewritten as a comprehensive integration guide (status
  banner, badges, quickstart, mermaid UX flow, three install methods
  with safe CI auth patterns, 12-field `WidgetConfig` table, API
  reference, production-disable pattern, VitePress example, roadmap).

## [0.1.0] - 2026-04-20

### Added

- Monorepo skeleton with pnpm workspaces (`packages/core`, `packages/web`)
- TypeScript base config + per-package tsconfig
- Vitest setup (node env for `core`, happy-dom for `web`)
- CI workflow (typecheck + build + test)
- `@benoit-bremaud/feedback-widget-core` — pure-logic core (domain, ports,
  use-cases, config). Zero DOM dependencies, runs on any JS runtime.
- `@benoit-bremaud/feedback-widget` — browser implementation (Web Component view,
  IntersectionObserver viewport detector, fetch-based transport, localStorage
  outbox + rate limiter). Public API: `mountFeedbackWidget(config)`.
- 40 unit tests (24 core + 16 web).
