# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.7.0] - 2026-11-02

**Deploy the consumer pipeline first**: `feedback-pipeline-worker` accepts the
v0.7.0 taxonomy since its PR #44 (deployed 2026-10-30, migration `0003`
applied). The Worker selects the allowlist from `widgetVersion`, so the new
pairs are only accepted once this package is released as 0.7.0.

### Changed

- **BREAKING — six families, 26 sub-families (#128).** A new `display` family
  (second tile) takes visual defects off `bug`; every family but `praise` ends
  with an `other` escape; new sub-families `bug/form-rejected`,
  `bug/wrong-data`, `bug/personal-data`, `display/mobile`,
  `display/missing-media`, `content/outdated`, `unclear/question`,
  `suggestion/design`. `bug/broken-display` becomes `display/broken-layout`
  and `bug/too-slow` becomes `display/too-slow`: both leave the
  `SubCategory` type. `bug` now lists `no-effect` first. Spec:
  `docs/architecture/specs/feedback-taxonomy.md`.
- The precision step asks a guided question with a matching placeholder per
  family/sub-family pair instead of one generic prompt.
- **BREAKING (port)** — `View.showConfirmation` and `View.showMailtoFallback`
  are removed: the controller reaches the `confirmed` and `error` steps through
  `render`, so `WidgetState.step` is the single source of the screen shown.

### Added

- Going back keeps the typed message and name. Closing (button, backdrop or
  `Escape`) with a non-blank message asks for confirmation on a new
  `discard-confirm` step; `Escape` there means "keep editing". New
  `UserAction` kinds `keep-editing` and `discard`.
- A `family › sub-family` breadcrumb on the sub-category and precision steps;
  its last link goes back one step.

### Fixed

- Closing the widget while a report was sending reset it, then the late result
  re-opened it. `close` is now ignored during `sending`.

### Migration

- Hosts that pass an explicit `categories` list must add `display`, otherwise
  their reporters lose every visual-defect slot.
- TypeScript consumers matching on `SubCategory` must replace
  `broken-display` and `too-slow` under `bug` (see above).

## [0.6.0] - 2026-09-23

Breaking release: the feedback taxonomy is reworked around what the reporter
means, not how a developer would classify the defect. **Deploy the consumer
pipeline before this widget bundle** — see the migration note below.

### Changed

- **BREAKING — feedback taxonomy reworked.** A category now names the
  reporter's _intent_, not the technical nature of the defect: the technical
  detail is derived downstream from the auto-captured context instead of being
  asked of the user. Six categories × five sub-categories (25 in total) become
  five categories × three-to-four sub-categories (13 in total).
  - `typo`, `error` and `ambiguous` are gone. They overlapped (`bug/visual-glitch`
    vs `error`, `bug/wrong-output` vs `error` vs `ambiguous`) and `error` mixed
    wrong _content_ with purely technical failures. Their cases move to `content`
    (what is written is wrong) and `bug` (what is broken).
  - `unclear` replaces `ambiguous`, phrased from the reader's point of view.
  - `praise` is new — the widget was defect-only and had no way to report that
    something works well.
  - `other` is removed: `unclear` and `suggestion` absorb the vague cases, and
    the free-text message is required anyway. `praise` is now the only category
    carrying a `null` sub-category.
  - Developer vocabulary is gone from the UI (`js-console`, `http-5xx`,
    `regression`, `content-refactor`, …).

  New table: `bug` (crash · no-effect · broken-display · too-slow), `content`
  (typo · wrong-info · dead-link), `unclear` (wording · missing-info ·
  navigation), `suggestion` (new-feature · improvement · accessibility),
  `praise` (no sub-category).

  **Migration** — hosts passing `categories` must update the values; unknown
  names are now dropped by `resolveConfig` rather than rendered, and a config
  where nothing survives falls back to the built-in defaults instead of showing
  an empty picker. Consumers storing or routing on `category` / `subCategory`
  (notably the `feedback-pipeline-worker`, which duplicates these tables) must
  be updated **in lockstep, and deployed first**, or they will reject every new
  payload. Rows already stored carry the old vocabulary.

- `SUB_CATEGORIES_BY_CATEGORY` is now the single source of truth: the category
  types are derived from it, so the unions and the runtime table can no longer
  drift apart.

### Fixed

- `buildFeedbackPayload` returns a normalized `target` on sub-categorized
  payloads. It passed the raw input, so an omitted target became `undefined`
  and `JSON.stringify` dropped the key entirely — sending a payload with no
  `target` at all on the majority path.

### Removed

- The `codeql` and `dependency-review` workflows, and the SonarCloud CI step.
  None could run on a private repo on GitHub's and SonarCloud's free plans, so
  all three reported nothing while appearing to gate every pull request. The
  public release checklist tracks restoring them. Verification moved to a local
  gate (`pnpm verify`) with a pre-push hook — see `CONTRIBUTING.md`.

## [0.5.2] - 2026-06-04

Security-hardening release. A multi-lens security audit found **no XSS /
injection / RCE vulnerabilities**; the changes below are defense-in-depth and
robustness fixes for embedding the widget on arbitrary, possibly hostile hosts.

### Security

- **Lifecycle teardown** — the widget element now implements
  `disconnectedCallback`: on unmount (SPA navigation, dynamic removal) it
  removes the shadow-root `keydown` listener and tears the viewport detector
  down (document capture listeners, the `IntersectionObserver`, and the
  injected `<style>` node) via the new `ViewportDetector.destroy()`. Prevents
  leaked document listeners that could swallow host-page clicks.
- **Runtime config hardening** in `resolveConfig`: numeric options
  (`maxTransportAttempts`, `transportTimeoutMs`, `rateLimit*`, `minFormOpenMs`,
  `maxMessageLength`) are clamped into safe bounds (NaN-safe); `theme` and
  `position` fall back to a valid value when unknown; an empty `categories`
  array falls back to the defaults; and `endpoint` must be an absolute http(s)
  URL (unsafe schemes such as `javascript:` / `data:` are rejected).
- **Bounded resources** — the localStorage outbox is capped (oldest entries
  dropped) so a long offline streak can't fill the host origin's storage;
  `findParentHeading` is now iterative and depth-capped; `cssEscape` and
  `normalizeLocale` cap their input length (cheap DoS guards).
- **Packaging** — source maps (`*.map`) are no longer published to the
  registry; the `files` allowlist ships only `*.js` + `*.d.ts`.
- **Dependencies** — patched transitive `ws` (≥ 8.20.1) and `brace-expansion`
  (≥ 5.0.6) pinned via pnpm overrides; `pnpm audit` is clean.

## [0.5.1] - 2026-06-04

### Fixed

- **Locale normalization** — a region-tagged `locale` (e.g. `en-US`, `fr-FR`,
  as commonly produced by `navigator.language`) no longer resolves to
  `undefined` messages and crash the controller on submit. The value is
  coerced to its base language subtag (`en-US` → `en`) and falls back to the
  default (`fr`) when unsupported, via the new `normalizeLocale` guard in
  `resolveConfig`.

### Changed

- `Locale` is now derived from a single `SUPPORTED_LOCALES` source so the
  runtime list and the compile-time union cannot drift apart (internal).

## [0.5.0] - 2026-06-03

### Added

- **Multi-project configuration** — four optional `WidgetConfig` fields so
  the widget drops into any host without code changes:
  - `rootSelector` — CSS selector for the pointing-mode picker's root, to
    reach reportable elements rendered outside `<main>` (e.g. modals or
    portals). The detector keeps its `'main'` default when unset.
  - `theme` (`'dark' | 'light'`) — drives the Shadow-DOM palette via
    `--fw-*` CSS custom properties; absent keeps the light scheme.
  - `locale` (`'fr' | 'en'`) — selects the widget's own UI language;
    defaults to `'fr'`. Every string now lives in a `LOCALES` dictionary.
  - `storageNamespace` — localStorage key prefix for the rate-limit and
    outbox state; defaults to `'feedback-widget'`.

### Changed

- The widget no longer hardcodes any consumer's name. The localStorage
  namespace default changed from the legacy `impropedia.feedback-widget`
  to a neutral `feedback-widget` (overridable via `storageNamespace`), and
  the mailto-fallback subject is now a generic, localized string instead of
  `[Impropedia] …`. No payload field changed, so the ingest contract is
  unaffected. No storage migration is performed.

## [0.4.0] - 2026-05-23

### Added

- **Feedback on any element + targeted element transmitted** — in
  pointing mode (« Choisir un autre ») the user can now point at **any**
  element (a button, link, input, image…), not just content blocks. The
  activating events (`pointerdown`, `mousedown`, `click`) are intercepted
  in the capture phase so the element's own behavior (navigation, form
  submit, `onclick`) never fires while it is being selected. The picked
  element is described by a new `FeedbackTarget` and **carried in the
  payload** (`target`), so the consumer pipeline knows which element a
  report is about.

### Changed

- **BREAKING (type API)** — `TargetBlock` is renamed to `FeedbackTarget`
  and restructured: `blockTag` → `tag` (now non-null), added `label`
  (accessible name) and `selector` (bounded CSS path), dropped
  `headingId` and `blockIndex`. `FeedbackPayload` gains a
  `target: FeedbackTarget | null` field; `buildFeedbackPayload` takes a
  `target` input.

### Security

- The target descriptor never captures a form field's entered `value`
  (only its accessible label / placeholder / text), so no user-entered
  data leaks into the payload.

## [0.3.1] - 2026-05-22

### Added

- **Public bundle build** — `packages/web` gains a `build:bundle` script
  (esbuild) that emits a self-contained, minified ESM bundle
  (`dist-bundle/feedback-widget.js`) with the private
  `@benoit-bremaud/feedback-widget-core` **inlined**. No sourcemap is
  emitted — a public artifact must not ship a map that re-exposes the
  private TypeScript source. This lets a
  build-less static site load the widget via a single
  `<script type="module" src="…">` tag — no package registry auth, no
  bundler on the consumer side. Source stays private; only the compiled
  artifact is meant to be published. A node-env smoke test
  (`bundle.test.ts`) asserts the bundle exposes `mountFeedbackWidget` +
  `createBrowserContextCollector` and leaves no bare workspace import.

## [0.3.0] - 2026-05-21

First release of the two-level feedback taxonomy and automatic
context capture. The widget now asks for a top-level category, then a
sub-category (progressive disclosure), and enriches every submission
with ten browser-context fields so the downstream pipeline can route
and label feedback with maximum granularity at minimum click cost.

**Breaking change** — the `FeedbackPayload` shape changed from the
nested `{ schemaVersion, meta, identity, context, content }` (v0.2.0)
to a **flat** object: `{ projectId, url, referrer, userAgent,
viewport: { w, h }, locale, timestamp, widgetVersion, scrollDepth,
sessionId, category, subCategory, message, reporterName }`. Consumers
parsing the posted body must update to the flat shape. The `Category`
type is renamed `TopLevelCategory`. `buildFeedbackPayload`'s input is
now the flat `BuildPayloadInput`. The free-text `message` is now always
required (10–2000 chars) rather than only for the `other` category. The
optional `reporterName` is retained (was `identity.reporterName` in
v0.2.0), now a top-level field.

### Added

- **Two-level taxonomy** — six top-level categories, each with five
  sub-categories (25 total), locked by the Phase B debrief Q9. New
  types `TopLevelCategory`, `BugSubCategory` / `TypoSubCategory` /
  `ErrorSubCategory` / `AmbiguousSubCategory` / `SuggestionSubCategory`,
  the `SubCategory` umbrella, the `CategorizedFeedback` discriminated
  union, and the `SUB_CATEGORIES_BY_CATEGORY` lookup. Helpers
  `requiresSubCategory` and `isValidSubCategory`.
- **Auto-capture** — new `ContextCollector` port (core) and
  `BrowserContextCollector` adapter (web) producing the ten
  `BrowserContext` fields from `window` / `navigator` / `document`,
  each read defensively so a missing global degrades the field rather
  than blocking submission.
- **Progressive-disclosure UX** — a `sub-category` step between the
  category picker and the free-text precision step (skipped for
  `other`), with a contextual `back` action. New `WidgetState`
  fields `selectedSubCategory` and the `select-sub-category` / `back`
  user actions.
- **Tests** — `BrowserContextCollector.test.ts`, plus expanded
  `widget.test.ts` (sub-category flow, `back` navigation, flat-payload
  shape assertion) and `WebComponentView.test.ts` (sub-category render,
  emission, breadcrumb). 143 tests total (41 core + 102 web).

### Changed

- **`FeedbackPayload`** flattened (see breaking change above); the
  v0.2.0 `TargetBlock` remains a runtime artefact of the viewport
  detector but is no longer part of the payload contract.
- **`buildFeedbackPayload`** now validates the category/sub-category
  invariant (`other` ⟺ null sub-category) and throws on violation —
  treated as a programming error, guarded at the composition root so
  a failure surfaces as an error step, never a stuck "sending" state.
- **Submit resilience** — `outbox.enqueue` failures are caught and the
  user is no longer told their feedback was queued when it was not.

### Fixed

- Returning to the category picker via `back` clears any stale
  sub-category so it cannot outlive a category change.
- Background `drainOutbox` failures are logged instead of surfacing as
  a silent unhandled rejection.

## [0.2.0] - 2026-04-23

First `latest` release. Closes the foundations phase started with
`0.1.0` (extraction) and iterated on `0.1.1-rc1` / `0.1.1-rc2`
(publish pipeline). This release is governance-, quality-, and
security-complete: every convention documented, every workflow
gated, every module unit-tested, no weak PRNG anywhere.

**Breaking change** — `LocalStorageOutbox`'s default id generator
no longer falls back to `Math.random()` when the Web Crypto API is
absent. It now requires either `crypto.randomUUID` or
`crypto.getRandomValues` and throws otherwise. Every target runtime
(Node ≥ 20, evergreen browsers Chrome 92+ / Firefox 95+ / Safari
15.4+ / Edge 92+) satisfies this. Consumers on unsupported runtimes
can inject a custom `generateId` via `createLocalStorageOutbox`
options.

### Added

- **Governance** — repo-root `CONTRIBUTING.md` (single source of
  truth for branch / commit / PR / issue conventions, DoD, merge
  gate, AI attribution ban, public-release checklist, changelog +
  project-log distinction, release workflow); GitHub issue
  templates (bug / feature / docs / task) with auto-labels and
  mandatory Goal / Scope / DoD / Notes body;
  `.github/PULL_REQUEST_TEMPLATE.md` mirroring the CONTRIBUTING template.
- **Tag protection** — repository ruleset scoped to `refs/tags/v*`
  with `creation` / `update` / `deletion` all blocked and an Admin
  bypass (`.github/tag-protection.md`). Full cross-project
  convention codified in `~/.claude/CLAUDE.md` §Tag Conventions and
  mirrored in this repo's `CONTRIBUTING.md` §Tag conventions
  (naming, lifecycle, protection, progressive signing, release
  notes, monorepo lockstep, failed-publish handling).
- **Lint + format** — ESLint 9 flat config (`eslint.config.js`)
  with `typescript-eslint/strict` + custom rules
  (`no-explicit-any: error`, `no-restricted-syntax` banning
  default exports).
  Prettier 3 (`prettier.config.js`) with the repo style
  (`singleQuote`, `semi: false`, `trailingComma: 'all'`,
  `proseWrap: 'preserve'`). Workspace scripts `lint` / `lint:fix` /
  `format` / `format:check` and a dedicated
  `.github/workflows/lint.yml`. `.editorconfig` and
  `.prettierignore` at repo root.
- **CI coverage + SonarCloud** — Vitest emits `lcov` reporters,
  `.github/workflows/ci.yml` runs `pnpm test:coverage`, uploads the
  LCOV artifact, and feeds it to SonarCloud via
  `SonarSource/sonarqube-scan-action` (SHA-pinned v6, guarded for
  forked PRs). `sonar-project.properties` at repo root with
  per-package tsconfig paths.
- **View-layer tests** — `IntersectionViewportDetector.test.ts`
  (20 tests), `widget.test.ts` (20 tests),
  `WebComponentView.test.ts` (20 tests) covering happy + sad + edge
  paths for the browser adapters that shipped in `0.1.0` without
  direct coverage. Web package coverage: 19% → 85% statements,
  88% lines.

### Changed

- **Security** — `LocalStorageOutbox.defaultGenerateId()` rewritten
  to prefer `crypto.randomUUID`, fall back to `crypto.getRandomValues`
  for environments without `randomUUID`, and throw otherwise. Fully
  documented in JSDoc. Resolves the SonarCloud Weak-Cryptography
  Hotspot on `typescript:S2245`.
- **`CONTRIBUTING.md`** — new §Linting and formatting (commands,
  rules, config files, editor integration) and §Tag conventions
  (seven pillars of the cross-project tag policy). The
  §Issue-body mandatory-sections rule now scopes Goal / Scope /
  DoD / Notes to `feat` / `docs` / `task` issues and exempts bug
  reports (which use the bug-specific fields defined by
  `.github/ISSUE_TEMPLATE/bug_report.yml`). Notes & Links marked
  explicitly as optional.
- **`PROJECT_LOG.md`** — 15 entries covering every PR merged from
  #2 through #37, each with What / Why / Ref and merge commit
  links. Single source of truth for project narrative in
  complement to this changelog.
- **`README.md`** reformatted under Prettier baseline; content
  unchanged.

### Fixed

- **Prettier + Markdown** — set `proseWrap: 'preserve'` so prose
  rewrapping does not split inline code spans across lines and
  break bullet-list continuation indentation.
- **CI SonarCloud scan** — guarded with
  `if: github.event.pull_request.head.repo.fork != true` so forked
  PRs do not fail for want of `SONAR_TOKEN` (GitHub does not expose
  secrets to forks).
- **CI action pinning** — the remaining `@v4` tag-pinned actions in
  `ci.yml` (`actions/checkout`, `pnpm/action-setup`,
  `actions/setup-node`) are now SHA-pinned to match every other
  workflow. `actions/checkout` uses `fetch-depth: 0` so SonarCloud
  has full SCM history for blame annotations.

## [0.1.1-rc2] - 2026-04-22

Retry of `0.1.1-rc1` after the first publish workflow failed at the
Typecheck step (the `packages/web` typecheck needs
`@benoit-bremaud/feedback-widget-core`'s `.d.ts`, so Build must
run first). Nothing was published to GitHub Packages in the
`rc1` attempt, so the version slot remains reserved but unused.

### Fixed

- `.github/workflows/publish.yml` now runs `Build` before
  `Typecheck`, matching the ordering already fixed in `ci.yml`
  (PR #2). Prevents TS2307 on the workspace import from
  `packages/web`.

## [0.1.1-rc1] - 2026-04-22

First release-candidate attempt. **Not published to GitHub Packages
— the publish workflow failed at the Typecheck step** before the
`Publish packages` step could run (see `[0.1.1-rc2]` above for the
fix). The `0.1.1-rc1` version slot remains reserved but unused; the
tag `v0.1.1-rc1` is kept as the audit-trail marker of the failed
attempt. Consumers should use `0.1.1-rc2` or later once it is
actually published.

The changes that this RC _would have_ published were the following
(they ship as part of `0.1.1-rc2`):

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
