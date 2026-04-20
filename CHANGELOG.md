# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- `HttpTransport` now aborts each fetch attempt after a configurable
  `timeoutMs` (required dep). An aborted request is treated as a network
  error and retried until `maxAttempts` is exhausted. Prevents the widget
  from being stuck in the `sending` step when the backend never responds.
- `WidgetConfig` gains an optional `transportTimeoutMs` (defaults to
  10 000 ms). The composition root wires it into `createHttpTransport`.

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
