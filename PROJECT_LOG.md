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

### PR #21 — comprehensive README

- **What:** Replaced the 2-line stub `README.md` with a full integration
  guide: status banner, badges (CI, Gitleaks, SonarCloud, Node, pnpm,
  License), quickstart, mermaid diagram of the widget UX flow,
  installation with two auth flavours (git+HTTPS+PAT, git+SSH) including
  consumer-CI examples, configuration table for the 12 `WidgetConfig`
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
  merge commit [`d87cea0`](https://github.com/benoit-bremaud/feedback-widget/commit/d87cea0)

### PR #23 — publish to GitHub Packages on tag

- **What:** Added `.github/workflows/publish.yml` (tag-driven, triggers
  on `push.tags: ['v*']`), the canonical policy doc
  `.github/publish.md`, and wired
  `publishConfig.registry = https://npm.pkg.github.com` plus
  `repository`/`homepage`/`bugs`
  fields into both packages' `package.json`. All third-party actions
  are SHA-pinned (`actions/checkout@v4`, `pnpm/action-setup@v4`,
  `actions/setup-node@v4`). Updated `README.md` Installation section
  to promote GitHub Packages as the recommended path while keeping
  the git-URL methods as fallbacks. Consumers install with a
  committable `.npmrc` (`${GITHUB_TOKEN}` resolved from env) and a
  PAT scoped `read:packages` only.
- **Why:** The whole point of the standalone project —
  `pnpm add @benoit-bremaud/feedback-widget` in any consumer (Impropedia
  first, others later) without git-URL boilerplate and without ever
  embedding a PAT in a URL. Stays on the private-first policy
  (GitHub Packages private registry) while unlocking the real npm
  DX. Closes issue
  [#22](https://github.com/benoit-bremaud/feedback-widget/issues/22)
  (`prio:P1`, `security`). Complements the broader release-workflow
  doc tracked in issue
  [#13](https://github.com/benoit-bremaud/feedback-widget/issues/13).
- **Ref:** PR [#23](https://github.com/benoit-bremaud/feedback-widget/pull/23),
  merge commit [`3c8c70f`](https://github.com/benoit-bremaud/feedback-widget/commit/3c8c70f)

## 2026-04-22

### PR #24 — v0.1.1-rc1 release attempt (failed publish)

- **What:** Bumped both packages to `0.1.1-rc1` and tagged `v0.1.1-rc1`
  to trigger the first GitHub Packages publish. The workflow crashed
  at the `Typecheck` step because it ran before `Build`, leaving
  workspace `.d.ts` files unresolvable across packages. Neither package
  was published. The tag was kept as an audit marker and the version
  is considered reserved/unusable.
- **Why:** First real-world exercise of `publish.yml` end-to-end —
  revealed the step-order bug that CI never caught because `ci.yml`
  already ran `build` before `typecheck`.
- **Ref:** PR [#24](https://github.com/benoit-bremaud/feedback-widget/pull/24),
  merge commit [`35d0680`](https://github.com/benoit-bremaud/feedback-widget/commit/35d0680),
  tag [`v0.1.1-rc1`](https://github.com/benoit-bremaud/feedback-widget/releases/tag/v0.1.1-rc1)

### PR #25 — rc2 publish-workflow fix + version bump

- **What:** Reordered `publish.yml` so `Build` runs before `Typecheck`
  (mirroring the fix applied in `ci.yml` via PR #2). Bumped both
  packages to `0.1.1-rc2` and reconciled the `[0.1.1-rc1]`
  `CHANGELOG.md` entry to state explicitly that nothing was published
  under that tag. Copilot review flagged the CHANGELOG contradiction
  (Should Have) — addressed inline in commit [`68f82cf`](https://github.com/benoit-bremaud/feedback-widget/commit/68f82cf).
- **Why:** Unblock the first GitHub Packages publish and keep the
  public release history truthful about the rc1 failure.
- **Ref:** PR [#25](https://github.com/benoit-bremaud/feedback-widget/pull/25),
  merge commit [`b0f4331`](https://github.com/benoit-bremaud/feedback-widget/commit/b0f4331)

### v0.1.1-rc2 published to GitHub Packages

- **What:** Tagged `v0.1.1-rc2` on `b0f4331` and pushed. The
  `publish.yml` workflow completed in 27s (build → typecheck →
  determine dist-tag → publish). Both `@benoit-bremaud/feedback-widget-core`
  and `@benoit-bremaud/feedback-widget` are now on
  `https://npm.pkg.github.com` under dist-tag `rc`. The repo and
  packages remain private — only collaborators with a PAT scoped
  `read:packages` can install.
- **Why:** First successful end-to-end release of the standalone
  widget. Validates the tag-driven publish pipeline and the
  main-ancestor guard. Stays on the private-first policy until
  conformance and security audits are complete.
- **Ref:** tag [`v0.1.1-rc2`](https://github.com/benoit-bremaud/feedback-widget/releases/tag/v0.1.1-rc2),
  workflow run [`24785834759`](https://github.com/benoit-bremaud/feedback-widget/actions/runs/24785834759)

### PR #27 merged — CONTRIBUTING.md with full conventions and DoD

- **What:** Added the repo-root `CONTRIBUTING.md` in tutorial tone
  (≈590 lines after review fixes): workflow overview, Conventional
  Commits for issues and commits, triptych label rules
  (`type:*` + `area:*` + `prio:*`), branch naming
  (`<type>/T-<issue-number>-<kebab>`), mandatory PR sidebar including
  explicit milestone + project + automated reviewer, PR description
  template, Definition of Done with explicit merge gate, Vitest
  testing requirements (happy + sad + edge per behavioural change),
  secret-handling and rotation rules, AI-attribution policy
  (attribution/credit banned, policy-doc exemption carved out),
  private-first public-release checklist, `CHANGELOG.md` vs
  `PROJECT_LOG.md` distinction, and release workflow cross-linked to
  `.github/publish.md`. Reviewed by Codex (1 comment) and Copilot
  (two passes, 6 comments total) — all 7 addressed inline: milestone
  no longer claims auto-inherit from `Closes #xx`, branch-protection
  wording clarified for the owner bypass, scope-granularity note
  added for narrower qualifiers like `ci(publish)`, AI-attribution
  section rewritten around attribution/credit with explicit
  exemptions, release tag command aligned with the canonical
  lightweight form in `.github/publish.md`, `.env.example` rephrased
  as future-conditional, and `AGENTS.md` removed from the exemption
  list until such a file actually exists.
- **Why:** Closes issue
  [#5](https://github.com/benoit-bremaud/feedback-widget/issues/5)
  (`prio:P0`) and unblocks the rest of the governance backlog —
  `#7` issue templates, `#8` PR template, and `#10` tag protection
  all depend on the conventions pinned down here.
- **Ref:** PR [#27](https://github.com/benoit-bremaud/feedback-widget/pull/27),
  merge commit [`00aad68`](https://github.com/benoit-bremaud/feedback-widget/commit/00aad68)

### PR #28 merged — tag protection policy for `v*` release tags

- **What:** Added `.github/tag-protection.md` as the canonical,
  committed reference for the `v*` tag protection ruleset: rule
  scope (`refs/tags/v*`), rules enforced (creation + update +
  deletion all blocked), enforcement `active`, bypass for
  `RepositoryRole: Admin` (`actor_id: 5`) mode `always` mirroring
  the owner escape-hatch pattern used on `main`. The doc ships the
  apply/update `gh api` flow (one-time POST bootstrap create, then
  idempotent PUT against the ruleset ID once it exists — explicitly
  split after review to avoid the non-idempotent POST being run
  twice), verification commands (list + fetch by ID + existing-tag
  integrity check + non-admin rejection tests on a disposable
  `v-protection-test-existing` tag, never on real release tags),
  and remove command. `CONTRIBUTING.md` §Release workflow gained a
  one-paragraph pointer and a new entry in the Cross-links footer.
  Copilot review posted 4 inline comments — all addressed in
  commit `7a1e722`: (1) Must Have — destructive verification
  commands no longer target `v0.1.0`, they use a disposable test
  tag with an explicit WARNING about admin bypass; (2/4) Should
  Have — "idempotent" wording in both `tag-protection.md` and the
  PROJECT_LOG entry now distinguishes one-time POST bootstrap from
  idempotent PUT; (3) Should Have — `RULESET_ID` extraction adds
  defensive count-and-validate step (fails fast on empty or
  duplicate match). Ruleset activated post-merge via
  `POST /rulesets` — live ID `15413164`, enforcement `active`, owner
  (current user) `can_bypass: always`. Existing tags `v0.1.0`,
  `v0.1.1-rc1`, `v0.1.1-rc2` all intact.
- **Why:** Closes issue
  [#10](https://github.com/benoit-bremaud/feedback-widget/issues/10)
  (`prio:P1`, `area:governance`). Prevents accidental creation,
  force-overwrite, or deletion of release tags by any non-admin
  collaborator, and hardens the tag-driven publish pipeline against
  version-number collision on GitHub Packages.
- **Ref:** PR [#28](https://github.com/benoit-bremaud/feedback-widget/pull/28),
  merge commit [`acd9938`](https://github.com/benoit-bremaud/feedback-widget/commit/acd9938),
  ruleset ID `15413164`

### Tag conventions adopted across projects

- **What:** Codified a cross-project tag-conventions policy in
  `~/.claude/CLAUDE.md` (new §Tag Conventions — All Projects) with
  seven pillars: strict-semver naming with `v` prefix, owner-only
  CLI-only lifecycle cut from `main`, mandatory ruleset protection
  mirroring `main` branch protection, progressive signing (optional
  on private repos, mandatory before any repo goes public), release
  notes authored from `CHANGELOG.md` with the GitHub auto-list
  allowed as a complement below, monorepo lockstep versioning
  (workspace packages bump together under a single tag), and a
  failed-publish rule that keeps the failed tag as an audit marker
  and bumps to the next version (never reuses the number).
- **Why:** Every project in the ecosystem already relies on tags to
  drive publication; without a shared rule set, each repo drifts
  independently and audit trails diverge. The global section is
  read by Claude on every project so the convention travels with
  the contributor, not with the repo. Propagation to individual
  `CONTRIBUTING.md` files keeps the rule enforceable without
  depending on external context.
- **Ref:** chosen 2026-04-22 during the PR #28 tag-protection work,
  no dedicated PR for the global update (owner config file).

### PR #30 — propagate full tag conventions into CONTRIBUTING.md

- **What:** Added a new §Tag conventions section in
  `CONTRIBUTING.md` mirroring the seven pillars of the global
  policy (naming, lifecycle, protection, signing, release notes,
  monorepo lockstep, failed publishes). The section acts as a
  quick-reference policy doc complementary to the step-by-step
  §Release workflow above and to the committed policy in
  `.github/tag-protection.md`. Signing stance documented as
  progressive — optional today on the private repo (`Unverified`
  accepted), mandatory before going public (configure
  `user.signingkey` + use `git tag -s`). Release-notes rule made
  explicit: the GitHub release description pulls its primary body
  from the matching `[vX.Y.Z]` section of `CHANGELOG.md`, with
  GitHub's auto-generated PR list allowed as a complement below.
  Cross-links footer gained an annotation on the tag-protection
  entry pointing to the new section.
- **Why:** Closes issue
  [#29](https://github.com/benoit-bremaud/feedback-widget/issues/29)
  (`prio:P2`, `area:governance` + `area:release`). A new
  contributor reading only `CONTRIBUTING.md` now has the complete
  tag policy without needing to load external context. Also
  discharges the bundle cadence for PR #28 by finalising its
  merge-commit SHA (`acd9938`) and recording the ruleset
  activation.
- **Ref:** PR [#30](https://github.com/benoit-bremaud/feedback-widget/pull/30),
  merge commit [`0024e71`](https://github.com/benoit-bremaud/feedback-widget/commit/0024e71)

### PR follow-up — Copilot corrections on tag conventions

- **What:** Applied Copilot's five inline review comments on PR #30
  (merged before fixes could land). (1) Lifecycle bullet "no other
  collaborator can" completed to enumerate create / move/update /
  delete and attribute the restriction to the ruleset. (2) Prerelease
  format aligned to the undotted `rcN` counter used by the existing
  `v0.1.1-rc1` and `v0.1.1-rc2` tags (`rc.N` / `beta.N` / `alpha.N`
  replaced by `rcN` / `betaN` / `alphaN`). (3) `CHANGELOG.md` heading
  reference changed from `[vX.Y.Z]` to `[X.Y.Z]` to match the Keep a
  Changelog convention the CHANGELOG already uses (no `v` prefix on
  section headers). (4) Failed-publishes bullet gained a concrete
  bump example (`v0.1.1-rc1` → `v0.1.1-rc2`) in place of the
  ambiguous `rc.N+1` notation. (5) Table of contents gained a new
  entry `14. Tag conventions` between `Release workflow` and
  `Cross-links`. `~/.claude/CLAUDE.md` §Tag Conventions — All
  Projects also updated to the undotted form so the global policy
  stays consistent with repo practice.
- **Why:** Closes issue
  [#32](https://github.com/benoit-bremaud/feedback-widget/issues/32)
  (`prio:P2`). Keeps the §Tag conventions policy in `CONTRIBUTING.md`
  aligned with the actual repo state (existing tags, CHANGELOG
  format) and removes the mid-sentence truncation + ambiguous bump
  notation flagged by Copilot.
- **Ref:** PR [#33](https://github.com/benoit-bremaud/feedback-widget/pull/33),
  merge commit [`453e92a`](https://github.com/benoit-bremaud/feedback-widget/commit/453e92a)

### PR — add PR description template at `.github/PULL_REQUEST_TEMPLATE.md`

- **What:** Created `.github/PULL_REQUEST_TEMPLATE.md` so GitHub
  auto-loads a consistent structure on every new PR opened against
  this repo. The template mirrors the `CONTRIBUTING.md` §Pull
  Request description template (Summary with per-Area sub-blocks,
  optional Tests table for `core` + `web`, Checklist, `Closes #N`),
  with HTML comments at the top and inside each section to guide the
  author (e.g. \"Docs-only PRs may drop the entire Tests section\").
  The Checklist adds two items not previously listed in
  `CONTRIBUTING.md` but mandated by repo policy: \"No secrets
  committed (Gitleaks clean)\" and \"No AI attribution anywhere in
  this PR\". A final checklist item reminds the author to populate
  the full GitHub sidebar (assignees, reviewers, label triptych,
  project, milestone) since the API steps are documented but easy
  to forget.
- **Why:** Closes issue
  [#8](https://github.com/benoit-bremaud/feedback-widget/issues/8)
  (`prio:P1`, `area:governance`). Removes the reliance on the
  author remembering the `CONTRIBUTING.md` format by hand —
  GitHub now pre-fills the correct structure on every new PR.
  The duplication between `CONTRIBUTING.md` and this template is
  intentional: `CONTRIBUTING.md` is the policy reference, the
  template is the runtime enforcement of that policy at PR-open
  time.
- **Ref:** PR [#34](https://github.com/benoit-bremaud/feedback-widget/pull/34),
  merge commit [`dbaca34`](https://github.com/benoit-bremaud/feedback-widget/commit/dbaca34)

### PR — add issue templates (bug, feature, docs, task)

- **What:** Added five YAML issue forms under
  `.github/ISSUE_TEMPLATE/`: `config.yml` (disables blank issues and
  points to `CONTRIBUTING.md` + `README.md`), `bug_report.yml`
  (auto-label `type:bug`, title `fix(<area>): <desc>`, fields
  Description / Steps to reproduce / Expected / Actual / Area /
  Priority / Version-commit / Evidence), `feature_request.yml`
  (auto-label `type:feature`, title `feat(<area>): <desc>`, fields
  User story / Goal / Scope IN-OUT / Acceptance criteria / Area /
  Priority / Notes), `docs_request.yml` (auto-label `type:docs`,
  title `docs(<area>): <desc>`, fields Goal / Scope / Acceptance /
  Area / Priority / Notes), `task.yml` (auto-label `type:task`,
  title `chore(<area>): <desc>`, fields Goal / Scope / Acceptance /
  Area / Priority / Notes). Each form ships the repo's full Area
  dropdown (`core` / `web` / `ci` / `react-native` / `governance` /
  `testing` / `docs` / `release`) and the full Priority dropdown
  (`prio:P0` through `prio:P3`, default P2). Every template closes
  with a two-item pre-submission checklist: confirm no duplicate,
  and a sidebar-reminder that the author must set assignee, label
  triptych, project, and milestone after opening the issue. Codex
  review flagged that `bug_report.yml` uses bug-specific fields
  (Description / Steps to reproduce / Expected / Actual / …) rather
  than the Goal / Scope / DoD / Notes structure that `CONTRIBUTING.md`
  §Issue body — mandatory sections declares mandatory for every
  issue — a direct policy conflict once blank issues are disabled.
  Resolved by scoping the Goal-/Scope-/DoD-/Notes rule in
  `CONTRIBUTING.md` to `feat` / `docs` / `task` issues and adding an
  explicit clause stating that bug reports use the bug-report
  template's field layout instead. A bug is a report of what broke,
  not a proposal of work, so the work-proposal structure does not
  fit naturally — policy now matches reality.
- **Why:** Closes issue
  [#7](https://github.com/benoit-bremaud/feedback-widget/issues/7)
  (`prio:P1`, `area:governance`). Machine-enforces the Goal / Scope
  IN-OUT / Acceptance / Notes body format for work-proposal issues,
  and pre-applies the `type:*` label so the triptych is one click
  closer to complete on every new issue. Blank issues are disabled
  so the format cannot be bypassed.
- **Ref:** PR [#35](https://github.com/benoit-bremaud/feedback-widget/pull/35),
  merge commit [`af1d946`](https://github.com/benoit-bremaud/feedback-widget/commit/af1d946)

### PR — wire LCOV coverage into CI and feed SonarCloud

- **What:** Added a `coverage` block to both `packages/core/vitest.config.ts`
  and `packages/web/vitest.config.ts` (provider `v8`, reporters `text`
  and `lcov`, includes `src/**/*.ts`, excludes `*.test.ts` / `dist/**` /
  `*.d.ts`). Created `sonar-project.properties` at the repo root with
  the monorepo layout: `sonar.sources` and `sonar.tests` both point at
  `packages/{core,web}/src` with `test.inclusions=**/*.test.ts` to
  disambiguate; `sonar.javascript.lcov.reportPaths` enumerates the two
  per-package `lcov.info` outputs; `sonar.typescript.tsconfigPath`
  points at `packages/core/tsconfig.json,packages/web/tsconfig.json`
  (per-package, so SonarCloud sees package-specific `lib` settings);
  `packages/web/src/index.ts` is excluded from coverage requirements
  as the public barrel. Updated
  `.github/workflows/ci.yml` to run `pnpm test:coverage` instead of
  `pnpm test`, upload the LCOV files as a `coverage-lcov` workflow
  artifact (`actions/upload-artifact@v4`, SHA-pinned), and run the
  SonarCloud scan (`SonarSource/sonarqube-scan-action@v4`, SHA-pinned)
  with `SONAR_TOKEN` from repo secrets. Rewrote `CONTRIBUTING.md`
  §Coverage to reflect the new CI-enforced flow (LCOV emitted, artifact
  uploaded, fed to SonarCloud, `SONAR_TOKEN` secret required).
  Verified locally — `pnpm test:coverage` produces
  `packages/core/coverage/lcov.info` (2.6 KB) and
  `packages/web/coverage/lcov.info` (14 KB), and prints the coverage
  summary: core at 96% statements, web at 19% statements (low because
  `widget.ts`, `WebComponentView.ts`, and `IntersectionViewportDetector.ts`
  have no direct unit tests; a follow-up issue will cover the
  view-layer tests). Review cycle added six fixes: (1/2) Codex + Copilot
  flagged that the Sonar scan would break forked PRs (secrets are not
  exposed to forks) — gated the step with
  `if: ${{ secrets.SONAR_TOKEN != '' && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.fork == false) }}`;
  (3) `sonar.typescript.tsconfigPath` switched from `tsconfig.base.json`
  to the per-package configs `packages/core/tsconfig.json,packages/web/tsconfig.json`
  so SonarCloud sees the package-specific `lib` (e.g. `DOM` in web);
  (4) SHA-pinned the remaining actions in `ci.yml`
  (`actions/checkout`, `pnpm/action-setup`, `actions/setup-node`) to
  match the convention used in every other workflow, and added
  `fetch-depth: 0` on checkout so SonarCloud has full SCM history
  for blame data; (5) removed `**/*.test.ts` from `sonar.exclusions`
  because it cancelled `sonar.test.inclusions` (tests must be
  classified as tests, not excluded); (6) grammar fix in the
  PROJECT_LOG entry (`feed` → `fed`).
- **Why:** Closes issue
  [#31](https://github.com/benoit-bremaud/feedback-widget/issues/31)
  (`prio:P1`, `area:ci` + `area:testing`). SonarCloud was running in
  Automatic Analysis mode, which ignores LCOV — every PR Quality Gate
  showed a blank coverage percentage and the UI surfaced a setup
  banner. Wiring LCOV + CI-based analysis unblocks the coverage
  metric on every PR and establishes the baseline that issue #12
  (coverage thresholds) needs before it can enforce anything.
- **Note:** Three SonarCloud UI actions remain as the owner-side
  one-time setup (documented in the PR body): switch the project from
  Automatic Analysis to CI-based analysis, set the New Code
  definition to reference branch `main`, and confirm the
  `SONAR_TOKEN` repo secret exists.
- **Ref:** PR [#36](https://github.com/benoit-bremaud/feedback-widget/pull/36),
  merge commit [`7eb3c25`](https://github.com/benoit-bremaud/feedback-widget/commit/7eb3c25)

### PR — set up ESLint + Prettier with shared config

- **What:** Added ESLint 9 flat config at the repo root
  (`eslint.config.js`) with two scoped blocks — `packages/core/src/**/*.ts`
  (Node env) and `packages/web/src/**/*.ts` (browser + DOM globals) —
  extending `@eslint/js` recommended and `typescript-eslint` strict.
  Two CLAUDE.md preferences enforced as rules:
  `@typescript-eslint/no-explicit-any: error` and
  `no-restricted-syntax` with an `ExportDefaultDeclaration` selector
  so named exports are the only accepted form. Prettier 3 added at
  the root (`prettier.config.js`) with the style already present in
  the code (`singleQuote: true`, `semi: false`, `trailingComma: 'all'`,
  `printWidth: 80`, `arrowParens: 'always'`); `eslint-config-prettier`
  is the last extends in the ESLint config so formatting rules live
  in Prettier only. `.editorconfig` at the root for cross-IDE
  defaults (UTF-8, LF, 2-space indent, trim trailing whitespace).
  `.prettierignore` skips `dist/`, `coverage/`, `node_modules/`, and
  the lockfile. Added four scripts at the workspace root: `lint`,
  `lint:fix`, `format`, `format:check`. New
  `.github/workflows/lint.yml` runs `pnpm lint` and
  `pnpm format:check` on every push and PR, SHA-pinned like the
  other workflows. Reformatted 45 existing files through
  `pnpm format` — single baseline commit so future diffs stay
  focused. `CONTRIBUTING.md` gained a new §Linting and formatting
  section between §Testing requirements and §Security, covering
  the four commands, the rules enforced, the config files, and
  editor integration notes. Husky pre-commit hooks are out of
  scope (CI enforces; local tooling is the contributor's choice).
- **Why:** Closes issue
  [#11](https://github.com/benoit-bremaud/feedback-widget/issues/11)
  (`prio:P2`, `area:ci`). Establishes the style and correctness
  baseline the repo needed before the codebase grows further —
  every future PR gets caught on `any` usage or a default export
  at PR-open time rather than at review time. Verified locally:
  `pnpm lint` returns zero errors / zero warnings,
  `pnpm format:check` is clean, all 40 tests still pass.
- **Scope expansion during review:** Two follow-up pieces landed on
  this same branch after the first Quality-Gate failure:
  - **View-layer tests** — `IntersectionViewportDetector.test.ts`,
    `widget.test.ts`, `WebComponentView.test.ts` (60 new tests, all
    happy + sad + edge). Lifts `packages/web` coverage from 19% to
    ~85% statements / ~88% lines, clearing the SonarCloud 80%
    new-code gate. Partially closes issue #38 opened specifically
    for this scope carve-out.
  - **Security Hotspot fix (breaking change)** —
    `defaultGenerateId()` in `LocalStorageOutbox.ts` previously
    fell back to `Math.random()` when `crypto.randomUUID` was
    unavailable. SonarCloud flagged the PRNG as
    Weak-Cryptography (`typescript:S2245`). Replaced the fallback
    with `crypto.getRandomValues()` for environments that expose
    `crypto` without `randomUUID`, and made the function throw
    when neither is available rather than fall back to a weak
    PRNG. **This is a behavioral / breaking change** vs the
    previous pre-PR #37 implementation — runtimes without Web
    Crypto (ancient browsers, restricted sandboxes) that
    previously worked silently will now error at enqueue-time.
    Supported runtimes (Node ≥ 20, evergreen browsers) are
    unaffected. Documented inline in the function's JSDoc. Rule
    of thumb: security/quality gates are not negotiated — fix the
    code, do not mark the Hotspot Safe.
- **Ref:** PR [#37](https://github.com/benoit-bremaud/feedback-widget/pull/37),
  merge commit [`1ebde5c`](https://github.com/benoit-bremaud/feedback-widget/commit/1ebde5c)

### PR — release v0.2.0 (foundations complete)

- **What:** Bumped `packages/core` and `packages/web` versions from
  `0.1.1-rc2` to `0.2.0` in lockstep (monorepo convention). Rewrote
  `CHANGELOG.md` — moved the previously-empty `[Unreleased]` block
  into a full `[0.2.0] — 2026-04-23` section with a narrative
  covering everything merged since `0.1.1-rc2`: governance
  (CONTRIBUTING, issue templates, PR template, tag protection,
  tag conventions), quality (ESLint + Prettier, coverage + SonarCloud
  wiring, view-layer tests), security (the breaking
  `defaultGenerateId` change, PRNG removed), and CI hardening
  (SHA-pinning, fork guard, `fetch-depth: 0`). Sections follow
  Keep a Changelog format — Added / Changed / Fixed — with the
  breaking-change intent called out at the top of the release
  block.
- **Why:** First `latest` release. Every foundations issue from the
  `v0.2.0 — Foundations` milestone is closed (#5, #7, #8, #10, #11,
  #29, #31, #32, #38) or becomes a nice-to-have follow-up (#12
  coverage thresholds, #13 release doc, #14 Renovate — all P2, none
  blocking a stable tag). Releasing now unblocks the consumer-side
  roadmap (Phase B — n8n pipeline, Phase C — first real integration
  in Impropedia) that the widget was built for.
- **Ref:** PR [#39](https://github.com/benoit-bremaud/feedback-widget/pull/39),
  merge commit [`b3d1db1`](https://github.com/benoit-bremaud/feedback-widget/commit/b3d1db1)
- **Follow-up:** After merge, tag `v0.2.0` from `main` and push —
  `publish.yml` fires, both packages land on GitHub Packages under
  the `latest` dist-tag for the first time.

## 2026-04-24

### Backlog reorganisation — v0.2.0 closed, v0.2.1 + v0.3.0 opened

- **What:** Closed the `v0.2.0 — Foundations` milestone after PR #39
  shipped (32 closed / 0 open) and closed the parent epic issue #1
  with a wrap-up summary. Opened two successor milestones: `v0.2.1 —
Hardening` (#2, 4 issues) for CI/quality hardening and `v0.3.0
— Multi-project pipeline` (#3, due 2026-05-15) for the n8n
  consumer pipeline + widget v0.3.0 sub-category taxonomy +
  auto-capture work. Re-assigned the six open issues carried over
  from v0.2.0: #12 (coverage thresholds), #13 (release workflow
  doc), #14 (Renovate), and #17 (MEMORY.md) → v0.2.1; #15 (v0.3.0+
  roadmap doc), #16 (n8n pipeline doc) → v0.3.0. Created a dedicated
  GitHub Project v2 for `audit-nvnc` (#54, node ID
  `PVT_kwHOB8rwIc4BVe-g`) to track feedback routed by the pipeline
  once the widget integration lands, aligning with the existing
  `feedback-widget` (#52) and `Impropedia` (#47) project boards.
- **Why:** The foundations phase ended with v0.2.0 shipping; the
  remaining P2/P3 items are either hygiene (v0.2.1) or directly tied
  to the new pipeline work (v0.3.0), so collapsing them into the now-
  closed foundations milestone would have muddled the narrative.
  Phase B (defined in `project_vision.md`) needs a dedicated track
  with a deadline; the 3-week `v0.3.0` window reflects the expected
  scope (widget release + n8n workflow + 3-site integration). The
  audit-nvnc project board is needed before the widget can route
  issues there.

### PR — enforce coverage thresholds in vitest

- **What:** Added `test.coverage.thresholds` to both
  `packages/core/vitest.config.ts` and
  `packages/web/vitest.config.ts`. Per-package thresholds sit a few
  points below the current baseline, so today's code passes while
  real regressions fail the build: core `90 / 85 / 80 / 90` (against
  baseline `96 / 95.1 / 86.7 / 95.7`) and web `80 / 70 / 80 / 80`
  (against `85.1 / 72.9 / 83.8 / 88.5`). Excluded
  `packages/web/src/index.ts` (public-API barrel) from the web
  measurement to avoid double-counting code already exercised
  through the public-API tests — mirrors the existing
  `sonar.coverage.exclusions` entry.
  Rewrote the `Coverage` subsection of `CONTRIBUTING.md`: dropped
  the "not yet enforced" paragraph, added an `Enforced thresholds`
  table and a `Bump policy` stating that thresholds ratchet upward
  when baselines rise by more than 3 points and never get lowered
  to make a PR pass.
- **Why:** Closes issue
  [#12](https://github.com/benoit-bremaud/feedback-widget/issues/12)
  (`prio:P2`, `area:testing`, v0.2.1 milestone). Coverage was wired
  to CI + SonarCloud in PR #36 but the thresholds themselves were
  left for this follow-up. Enforcing them now prevents silent
  regressions during the v0.3.0 work (new widget code for sub-
  categories + auto-capture) where adding untested code paths would
  otherwise slip through unnoticed.
- **Ref:** PR [#40](https://github.com/benoit-bremaud/feedback-widget/pull/40),
  merge commit [`d684ccb`](https://github.com/benoit-bremaud/feedback-widget/commit/d684ccb)

### PR — configure Renovate for weekly dependency updates

- **What:** Added `renovate.json` at the repo root. Renovate runs on
  Monday before 6am Europe/Paris and opens a single grouped PR for all
  `minor` + `patch` updates plus one PR per `major` update. Extends
  `config:recommended` + `:semanticCommits` (produces `chore(deps):`
  commits) + `:dependencyDashboard` (auto-created tracking issue) +
  `helpers:pinGitHubActionDigests` (SHA-pins Actions updates, matching
  the repo convention). Every Renovate PR auto-applies
  `type:task` + `area:ci`, assigns `benoit-bremaud`, and routes through
  the same merge gate as any other PR. Vulnerability alerts bypass the
  weekly schedule and carry `prio:P1`. **Auto-merge is disabled** —
  explicit choice to keep every dependency change under manual review,
  matching the `never merge autonomously` rule in the global Claude
  configuration. Updated `CONTRIBUTING.md` §Dependency security with
  the cadence, labels, auto-merge stance, dashboard behaviour, and the
  one-time Renovate GitHub App install step.
- **Why:** Closes issue
  [#14](https://github.com/benoit-bremaud/feedback-widget/issues/14)
  (`prio:P2`, `area:ci`, v0.2.1 milestone). With coverage thresholds
  locked in (#12) and v0.3.0 work about to land, stale transitive
  dependencies (`typescript-eslint`, `vitest`, `happy-dom`, SHA-pinned
  Actions) become a friction multiplier — the weekly grouped PR keeps
  them fresh without burying the reviewer in noise. Renovate is
  preferred over Dependabot because the grouped-PR config is
  finer-grained and it natively supports GitHub Actions SHA digest
  pinning, which the repo relies on across every workflow.
- **Follow-up:** Install the Renovate GitHub App on the repo
  (one-click at [github.com/apps/renovate](https://github.com/apps/renovate));
  the first grouped PR appears the following Monday.
- **Ref:** PR [#41](https://github.com/benoit-bremaud/feedback-widget/pull/41),
  merge commit [`6db588b`](https://github.com/benoit-bremaud/feedback-widget/commit/6db588b)

### PR — n8n pipeline architecture + `projects.yaml` schema design docs

- **What:** Added two design documents under `.github/design/`
  before any code lands for Phase B. `n8n-pipeline.md` fixes the
  end-to-end architecture: five abstract ports (`ConfigSource`,
  `LLMGateway`, `IssueTracker`, `NotificationChannel`, plus the
  widget-side payload contract), their MVP adapters
  (`YamlFromGitHub`, `TemplateLLMGateway`, `GitHubIssueTracker`,
  `TelegramChannel`), and the future adapters they make pluggable
  (Claude/Mistral/Ollama, Linear/Jira, Discord/Slack/Email/Webhook,
  Postgres). Includes an ASCII dataflow diagram and the error-
  handling strategy (widget outbox retries on the user side; n8n
  retry-on-error with 2/30s on each adapter node).
  `projects-yaml-schema.md` defines the contract the `ConfigSource`
  port returns: YAML committed at `pipelines/projects.yaml`, fetched
  by n8n via
  raw URL + fine-grained PAT, validated against a draft-07 JSON
  schema at commit time and at fetch time. Ships a starter example
  for the three POC projects (brasse-bouillon, Impropedia,
  audit-nvnc) with label mappings per top-level category and per
  sub-category, plus an evolution table distinguishing non-
  breaking additions from breaking renames/removals.
- **Why:** Closes issue
  [#16](https://github.com/benoit-bremaud/feedback-widget/issues/16)
  (`type:docs`, `area:governance`, `prio:P3`, v0.3.0 milestone) and
  bundles the `projects.yaml` schema work (plan T1.5) in the same
  PR since the two docs are tightly coupled — the YAML file is the
  concrete input to the `ConfigSource` port, and divorcing them
  would have scattered the contract across two discussions. Having
  the ports + adapters + data contract pinned before any widget or
  n8n code lands means the v0.3.0 sprint starts with agreed
  interfaces, and any future LLM / tracker / channel swap lands as
  a configuration change rather than a refactor. The only question
  this doc can't answer is the concrete homelab infra (Q1-Q7 from
  the Phase B debrief) — those values get wired into n8n
  credentials once the user finishes auditing `n8n-kaggle-watcher`.
- **Ref:** PR [#42](https://github.com/benoit-bremaud/feedback-widget/pull/42),
  merge commit [`98fcb12`](https://github.com/benoit-bremaud/feedback-widget/commit/98fcb12)

## 2026-05-21

### PR — widget v0.3.0: sub-category taxonomy + auto-capture

- **What:** Implemented the two-level feedback taxonomy and automatic
  browser-context capture across both packages (single coherent PR
  after the 2-PR core/web split proved leaky — the discriminated
  `category + subCategory` union forces the web side to supply a real
  sub-category as soon as it builds a payload). **Core**: replaced the
  nested `FeedbackPayload` with a flat shape; added `TopLevelCategory`
  (renamed from `Category`), five per-category sub-category unions, the
  `SubCategory` umbrella, the `CategorizedFeedback` discriminated
  union, `BrowserContext`, the `ContextCollector` port, helpers
  `requiresSubCategory` / `isValidSubCategory` /
  `SUB_CATEGORIES_BY_CATEGORY`; rewrote `buildFeedbackPayload` to
  validate the `other` ⟺ null-sub-category invariant. **Web**: new
  `BrowserContextCollector` adapter (10 fields, defensively read), a
  `sub-category` progressive-disclosure step in `WebComponentView`
  with a contextual `back` action, and composition-root wiring that
  collects context + builds the flat payload inside a guard.
  **Resilience**: payload-build and `outbox.enqueue` throws are caught
  so a failure surfaces as an error step (never a stuck spinner), and
  the user is no longer falsely told their feedback was queued.
  Lockstep version bump `0.2.0 → 0.3.0`, CHANGELOG `[0.3.0]` with the
  breaking-change callout. 143 tests (41 core + 102 web), coverage
  core 93/92/88/93 and web 84/73/84/87 — both above thresholds.
- **Why:** Closes issue
  [#44](https://github.com/benoit-bremaud/feedback-widget/issues/44)
  (`type:feature`, `area:core`, `area:web`, `prio:P1`, v0.3.0
  milestone). Delivers the Q9 taxonomy + auto-capture decided in the
  Phase B debrief so the n8n pipeline (Sprint 5) can route and label
  feedback with full granularity, and so brasse-bouillon can integrate
  the richer widget (Strategy B — integrate after v0.3.0 ships). Two
  review agents (type-design-analyzer, silent-failure-hunter) ran
  pre-PR; their Must-Fix findings (unguarded throws, stale
  sub-category on `back`, silent drain rejection, unvalidated DOM
  cast) are all addressed in this PR.
- **Follow-up:** Live-browser E2E (chrome-devtools) deferred to
  Sprint 5 / J4, where the widget is integrated into the real
  brasse-bouillon VitePress site against the real n8n endpoint — the
  meaningful place to verify CSS / Shadow-DOM rendering, z-index over
  the host site, mobile responsive, and the POST reaching the
  pipeline. After merge, tag `v0.3.0` → `publish.yml` ships both
  packages to GitHub Packages under `@latest`.
- **Ref:** PR [#45](https://github.com/benoit-bremaud/feedback-widget/pull/45),
  merge commit [`7df2ee1`](https://github.com/benoit-bremaud/feedback-widget/commit/7df2ee1),
  tag [`v0.3.0`](https://github.com/benoit-bremaud/feedback-widget/releases/tag/v0.3.0)
  (published to GitHub Packages under `@latest`)

## 2026-05-21 (later)

### PR — UML diagrams for the feedback consumer pipeline

- **What:** After a full design debrief of the enriched Phase B vision
  (staging-gated delivery + agentic Telegram triage), added the UML
  deliverables under
  `docs/architecture/diagrams/feedback-pipeline/`: `01-use-case.md`
  (Reviewer submits feedback; Operator triages — accept/reformulate/
  refuse — and consults history), `02-sequence.md` (end-to-end flow
  making the edge-buffer + outbound-pull boundary and the
  human-in-the-loop explicit), and `03-component.md` (structural
  boundaries across the 3 repos + edge + homelab, ports/adapters
  mapping, secrets boundary). Added a "superseded orchestration" banner
  to `.github/design/n8n-pipeline.md`: the ports/adapters design holds,
  but the orchestrator is now a dedicated Docker service on the
  bb-homelab Pi fronted by an edge Cloudflare Worker (the Pi is
  Tailscale-only, no public ingress → it pulls outbound), with a single
  Claude API call for reformulation (no agent loop). Back-fills PR #45's
  merge SHA + v0.3.0 tag.
- **Why:** The user's global UML-conformance rule requires Mermaid
  diagrams for any substantial new feature before/at build start. This
  pipeline spans three repos + the edge + the homelab, so the use-case
  (who wants what), sequence (what happens in time), and component
  (where it runs) diagrams pin the contracts and the egress/ingress
  boundary before any code. Locks the design (decisions Q1–Q8) into a
  reviewable, diffable visual index that the build phases (V1 then V2)
  follow.
- **Ref:** PR [#46](https://github.com/benoit-bremaud/feedback-widget/pull/46),
  merge commit [`6a54c2e`](https://github.com/benoit-bremaud/feedback-widget/commit/6a54c2e)

## 2026-05-22

### PR — public bundle build (V1 chantier 1)

- **What:** Added a `build:bundle` esbuild script to `packages/web` that
  emits a self-contained minified ESM bundle
  (`dist-bundle/feedback-widget.js`, ~34 kb) with the private
  `@benoit-bremaud/feedback-widget-core` inlined. No sourcemap — a
  public artifact must not ship a map that re-exposes private source.
  Added
  `esbuild ^0.28.0` devDep, gitignored `packages/*/dist-bundle/`, and a
  node-env smoke test (`bundle.test.ts`) asserting the bundle exposes
  `mountFeedbackWidget` + `createBrowserContextCollector` with no
  leftover bare workspace import. Backfills PR #46's merge SHA.
- **Why:** First build chantier of the V1 feedback pipeline. The
  brasse-bouillon target is a build-less static HTML site on GitHub
  Pages (debrief Q2/Q4) — it can't `npm add` a private scoped package,
  so it needs a public self-contained `<script type="module">` bundle.
  This produces that artifact; the source stays private (only the
  compiled bundle is published). The hosting decision (where the public
  URL lives) is the immediate next step, tracked separately.
- **Ref:** PR [#47](https://github.com/benoit-bremaud/feedback-widget/pull/47),
  merge commit [`89f1b29`](https://github.com/benoit-bremaud/feedback-widget/commit/89f1b29)

### PR — Worker ingestion build spec (V1 chantier 2 prep)

- **What:** Added `docs/architecture/specs/feedback-pipeline-worker.md`
  — a copy-paste-ready build spec for the V1 chantier-2 Cloudflare
  Worker (the pipeline's only public surface): serves the widget bundle
  (`GET /widget.js` via Workers Static Assets), ingests feedback
  (`POST /ingest` — origin allowlist + rate-limit + payload validation →
  KV buffer → 204), and lets the Pi drain outbound
  (`GET /drain` + `/drain/ack`, bearer `DRAIN_TOKEN`). Covers
  wrangler.toml + `src/index.ts` skeletons, secrets/config boundary,
  the bundle-coupling strategy (commit the built bundle into the Worker
  repo for V1), CI, vitest-pool-workers tests, and DoD. Backfills
  PR #47's merge SHA.
- **Why:** The hosting decision (2026-05-22) is that the ingestion
  Worker also serves the public bundle — free on Cloudflare's Free tier,
  no GitHub Pro needed (Pages on a private repo is paid). The Worker
  lives in its own repo (`feedback-pipeline-worker`) per the
  one-session-per-project rule, so this spec lets that dedicated session
  scaffold fast without re-deriving the design. Security baked into the
  spec's defense-in-depth layers: CORS origin filter (never `*` — a
  filter, not authentication, since `Origin` is forgeable), rate-limit,
  size cap, input validation, and secrets via Wrangler (never in code or
  the public site).
- **Ref:** PR [#48](https://github.com/benoit-bremaud/feedback-widget/pull/48),
  merge commit [`f96236b`](https://github.com/benoit-bremaud/feedback-widget/commit/f96236b)

## 2026-05-22

### Release v0.3.1 — formalize the public bundle

- **What:** Cut `v0.3.1`. Moved the `CHANGELOG` `[Unreleased]` "Public
  bundle build" entry into a dated `[0.3.1]` section, bumped
  `packages/core` + `packages/web` to `0.3.1` in lockstep, and bumped
  `WIDGET_VERSION` to `0.3.1` (the `version.test.ts` drift guard keeps it
  in sync with `package.json`).
- **Why:** The public bundle tooling (PR #47) had shipped to `main` but
  was never released, so the `feedback-pipeline-worker` was about to
  serve an untagged artifact whose feedback reports `widgetVersion`
  `0.3.0`. Cutting `0.3.1` before the Worker's first deploy means its
  bundle refresh pulls a tagged build — clean provenance, no later
  re-refresh. No API change (packaging only), hence a patch bump.
- **Ref:** PR [#49](https://github.com/benoit-bremaud/feedback-widget/pull/49),
  merge commit [`a014cf4`](https://github.com/benoit-bremaud/feedback-widget/commit/a014cf4),
  tag `v0.3.1`.

## 2026-05-23

### v0.4.0 — feedback on any element + targeted element transmitted

- **What:** Pointing mode (« Choisir un autre ») now lets the user point
  at **any** element — a button, link, input, image — not just content
  blocks. The activating events (`pointerdown`, `mousedown`, `click`) are
  intercepted in the capture phase (`preventDefault` + `stopPropagation`)
  so the element's own behavior never fires while it is being selected.
  The picked element is described by a new `FeedbackTarget` (renamed from
  `TargetBlock`; adds `label` + `selector`) and **carried in the
  payload** (`target`).
- **Why:** A reviewer could not give feedback on an interactive element:
  clicking a button to select it triggered the button instead. And even
  the auto-detected target was never transmitted, so the consumer could
  not tell which element a report was about. Now the payload says WHICH
  element — a button with `selector: "#cta"`, etc.
- **Contract impact:** `FeedbackPayload` gains `target`, so the
  feedback-pipeline-worker must accept the new field in lockstep (it
  hand-validates the payload) — see
  [the Worker contract](docs/architecture/specs/feedback-pipeline-worker.md).
  Privacy: the descriptor never carries a form field's entered value.
- **Ref:** PR [#50](https://github.com/benoit-bremaud/feedback-widget/pull/50),
  merge commit [`749ccd9`](https://github.com/benoit-bremaud/feedback-widget/commit/749ccd9), tag `v0.4.0`.

## 2026-05-24

### feedback dashboard — needs + UML conception (edge-centric pivot)

- **What:** Design documentation for a **centralized feedback dashboard** (a
  single place to consult every feedback, all projects). Adds the needs/decision
  spec [`feedback-dashboard.md`](docs/architecture/specs/feedback-dashboard.md)
  (decisions D1–D9) and seven UML diagrams under
  [`docs/architecture/diagrams/feedback-dashboard/`](docs/architecture/diagrams/feedback-dashboard/)
  (use-case, 2× sequence, component, class, state, data-flow). All Mermaid blocks
  render cleanly (verified with `mmdc`).
- **Why:** The dashboard need surfaced an **edge-centric pivot** of the pipeline:
  **Cloudflare D1 = primary store**, the **Pi = backup copy**, a **single triage
  service on the Worker** triggered by both the dashboard and a Telegram webhook,
  and auth via **Cloudflare Access** (operator-owned domain). This avoids
  duplicating triage logic and removes the unstable Pi from the critical path.
- **Impact:** Supersedes parts of `feedback-pipeline-pi.md` (Pi = source of
  truth) and `feedback-digest.md` (KV-cursor counting) — those two docs are on
  separate branches and will be reconciled in a follow-up PR. The
  widget→Worker payload contract is unchanged.
- **Ref:** issue [#51](https://github.com/benoit-bremaud/feedback-widget/issues/51);
  PR [#52](https://github.com/benoit-bremaud/feedback-widget/pull/52).

### Reconcile pipeline docs with the edge-centric pivot

- **What:** Brought the digest + Pi specs into consistency with the pivot and
  applied the deferred PR #52 review fixes. `feedback-digest.md` +
  `04-sequence-digest.md` now count from **D1** (`created_at`), not a KV cursor;
  `feedback-pipeline-pi.md` is rewritten as a **backup mirror of D1** (no longer
  the source of truth / KV-drain). Added a "superseded" banner to the original
  `feedback-pipeline/02-sequence.md` + `03-component.md`. Applied the four
  deferred review nits (seven-diagram count, PII edge flag, `createdAt`/
  `created_at` mapping, state-label ↔ status mapping) and re-linked the now-on-
  main specs from `feedback-dashboard.md`.
- **Why:** the dashboard pivot (#52) left the digest/Pi specs and two pipeline
  diagrams describing the old Pi-as-brain model — a misleading architecture
  trail. This makes the docs internally consistent.
- **Ref:** issue [#53](https://github.com/benoit-bremaud/feedback-widget/issues/53);
  follows #51/#52. PR [#54](https://github.com/benoit-bremaud/feedback-widget/pull/54).

---

## 2026-06-03

### v0.5.0 — multi-project widget configuration

- **What:** Added four optional `WidgetConfig` fields — `rootSelector`,
  `theme`, `locale`, `storageNamespace` — so the widget embeds in any host
  without code changes. Threaded through `resolveConfig`; introduced a
  single-source i18n seam (`LOCALES` fr/en derived from one `SOURCE`), CSS
  `--fw-*` theming with a `data-theme` dark/light override, and namespaced
  localStorage keys. Purged the remaining "Impropedia" coupling. UML (class +
  sequence) added under `docs/architecture/diagrams/widget-config-v0.5.0/`.
- **Why:** The widget is a standalone project (SOLID) that integrates into
  other projects but never depends on them. V-SEA was the first external host,
  needing `theme` / `locale` / `rootSelector:'body'` (to reach modals outside
  `<main>`).
- **Ref:** PR [#57](https://github.com/benoit-bremaud/feedback-widget/pull/57).

## 2026-06-04

### v0.5.1 — locale normalization fix

- **What:** A region-tagged `locale` (`en-US`, `fr-FR`, as produced by
  `navigator.language`) resolved to `undefined` messages and crashed the
  controller on submit. Added `normalizeLocale` (base language subtag +
  fallback) in `resolveConfig`, and derived `Locale` from a single
  `SUPPORTED_LOCALES` source. Dropped a storage-migration a reviewer had added
  — it reintroduced legacy coupling, and the widget stays independent.
- **Why:** Robustness for real-world hosts that pass BCP-47 tags; keeps the
  widget dependency-free.
- **Ref:** PR [#58](https://github.com/benoit-bremaud/feedback-widget/pull/58).

### v0.5.2 — security-hardening release

- **What:** Ran a multi-lens adversarial security audit (OWASP) + automated
  scans (`pnpm audit`, `gitleaks` — 0 leaks) + real-browser E2E. **No XSS /
  injection / RCE found** (87 defenses confirmed). Shipped defense-in-depth:
  element `disconnectedCallback` tearing the detector down via the new
  `ViewportDetector.destroy()` (no leaked document listeners on unmount);
  runtime config clamps/validation (`theme` / `position` / `endpoint` /
  empty `categories`, NaN-safe numerics); bounded localStorage outbox,
  iterative depth-capped `findParentHeading`, and input-length caps
  (`cssEscape` / `normalizeLocale`) as DoS guards; source maps excluded from
  the published package (`files` glob ships only `*.js` + `*.d.ts`); patched
  transitive `ws` / `brace-expansion` via pnpm overrides. +15 tests
  (core 62, web 132); `pnpm audit` clean.
- **Why:** The widget will be embedded across many projects on arbitrary,
  possibly hostile hosts — harden before wider rollout.
- **Ref:** PR [#59](https://github.com/benoit-bremaud/feedback-widget/pull/59),
  merge commit [`a110358`](https://github.com/benoit-bremaud/feedback-widget/commit/a110358).

## 2026-06-05

### C.2 — README static `<script>` embed guide

- **What:** Added a third installation path to the widget README — an
  "Option C — Static HTML via the self-hosted CDN" section under
  `Installation`, showing the copy-pastable `<script type="module">`
  import from the project's own Worker
  (`feedback-pipeline-worker.bbd-concept.workers.dev/widget.js`) with
  a 2-line `mountFeedbackWidget` call. Fixed the README status line
  that still claimed `v0.1.0` (project is at v0.5.2). Deliberately
  did NOT promote `packages/web/dist-bundle/demo.html` to a tracked
  `examples/demo.html` in this PR — the existing demo carries
  pre-existing SonarLint findings (`<aside role="dialog">` instead of
  `<dialog>`, minified inline `if`, `window` vs `globalThis`) whose
  cleanup belongs in its own follow-up PR rather than expanding the
  scope of this docs-only change.
- **Why:** The integrability-tier audit (2026-05-28) flagged "no
  static-`<script>` embed guide" as one of three 🛑 blockers for
  embedding the widget in third-party projects without a Node
  toolchain (Jekyll, Hugo, plain HTML, WordPress, etc.). This closes
  the first of those three; remaining are C.1 (i18n) and C.3
  (versioned bundle URLs).
- **Note:** The new section adds a 🔒 caveat that the integrator's
  origin must be added to the Worker's `ALLOWED_ORIGINS` before
  `POST /ingest` accepts requests — flags this is today still a
  manual operator action in `feedback-pipeline-worker/wrangler.toml`.
- **Ref:** PR [#61](https://github.com/benoit-bremaud/feedback-widget/pull/61),
  merge commit [`4bd7c4c`](https://github.com/benoit-bremaud/feedback-widget/commit/4bd7c4c).

### C.3 — Versioned bundle URLs + retroactive close on C.1

- **What:** `packages/web/build:bundle` now emits two files into
  `dist-bundle/` — the legacy mutable `feedback-widget.js` and a new
  pinned `widget-X.Y.Z.js` (version sourced from
  `$npm_package_version`). README's Option C section rewritten to
  recommend the pinned URL for production, keep the unversioned
  `widget.js` as a quick-test option with an explicit warning
  against shipping it to prod.
- **Why:** Without immutable per-version URLs, every consumer site
  picks up every Worker redeploy silently — a breaking widget
  change would propagate to all consumers at once. Versioned URLs
  let each integrator pin a tested release and bump deliberately.
- **Retroactive close on C.1 — already shipped in v0.5.0:** Tonight's
  inspection confirmed `packages/web/src/i18n.ts` defines `Messages`
  for both `fr` and `en` via the `t(fr, en)` brace pattern, and
  `WebComponentView.ts` consumes the locale-aware dict (no residual
  hardcoded French strings). The 2026-05-28 integrability-tier
  audit flagged C.1 as a 🛑 blocker, but was overtaken by
  PR [#57](https://github.com/benoit-bremaud/feedback-widget/pull/57)
  (v0.5.0 multi-project config) and never re-validated. C.1 is
  retroactively marked closed.
- **Worker pairing (out of scope here):** This PR ships the widget
  artifact only. The Worker must commit `public/widget-0.5.2.js` (a
  copy of the freshly built bundle) for the recommended URL to
  resolve; companion brief delivered alongside this PR. Until the
  Worker companion ships, the new versioned URL returns 404 — the
  unversioned `/widget.js` keeps serving the latest deployed bundle.
- **Ref:** PR [#63](https://github.com/benoit-bremaud/feedback-widget/pull/63),
  merge commit [`9dacfb9`](https://github.com/benoit-bremaud/feedback-widget/commit/9dacfb9).

## 2026-09-23

### PR #66 merged — verification moved to a local gate

- **What:** Added `scripts/verify.sh` (`pnpm verify`: format → lint →
  gitleaks → build → typecheck → tests+coverage → SonarQube) wired as a
  pre-push hook through `.githooks/`. Removed the SonarCloud, CodeQL and
  Dependency Review workflows, which failed or skipped on every PR because
  the repo is private on the free plan.
- **Why:** A check that is red on every PR teaches reviewers to ignore red
  checks. The local gate gives the same coverage before the push, with
  skipped checks announced rather than silently passed.
- **Ref:** PR [#66](https://github.com/benoit-bremaud/feedback-widget/pull/66),
  merge commit [`02ac022`](https://github.com/benoit-bremaud/feedback-widget/commit/02ac022).

### PR #65 merged — AI attribution policy aligned

- **What:** CONTRIBUTING § AI attribution rewritten from "forbidden" to
  "allowed, sober, never replacing authorship of decisions", matching the
  2026-07-02 reversal of the global policy.
- **Why:** Transparency about AI assistance matters more than hiding it;
  the repo text had to stop contradicting the global rule.
- **Ref:** PR [#65](https://github.com/benoit-bremaud/feedback-widget/pull/65),
  merge commit [`6779997`](https://github.com/benoit-bremaud/feedback-widget/commit/6779997).

### PR #64 merged — BREAKING feedback taxonomy rework (v0.6.0 code)

- **What:** Categories now name the reporter's intent, not the technical
  nature of the defect: `bug` · `content` · `unclear` · `suggestion` ·
  `praise` (13 sub-categories, down from 25). `typo`, `error`, `ambiguous`,
  `other` removed; `praise` is the only `null` sub-category. Package versions
  and `WIDGET_VERSION` bumped to 0.6.0 in the same change because the
  version is a payload field.
- **Why:** The old table overlapped (`bug/visual-glitch` vs `error`), mixed
  wrong content with technical failures, and exposed developer vocabulary
  in the UI. Technical detail is now derived downstream from the auto-captured
  context instead of being asked of the user.
- **Worker-breaking:** `feedback-pipeline-worker` duplicates the tables; it
  must be updated and deployed before any consumer loads the new bundle.
  Tracked in [#83](https://github.com/benoit-bremaud/feedback-widget/issues/83).
- **Ref:** PR [#64](https://github.com/benoit-bremaud/feedback-widget/pull/64),
  merge commit [`10be9fe`](https://github.com/benoit-bremaud/feedback-widget/commit/10be9fe).

### PR #67 opened — release v0.6.0 (CHANGELOG + README)

- **What:** Cuts `[Unreleased]` into `[0.6.0] - 2026-09-23`, points the README
  embed snippet at `widget-0.6.0.js`. Still open on 2026-10-15; merge, tag and
  the deployment order are tracked in [#82](https://github.com/benoit-bremaud/feedback-widget/issues/82).
- **Ref:** PR [#67](https://github.com/benoit-bremaud/feedback-widget/pull/67).

## 2026-10-15

### Backlog audit — epics restored, working method embedded

- **What:** Audit of the backlog found 4 stale issues, a board with no
  statuses, a PROJECT_LOG stopped on 2026-06-05 and the whole roadmap living
  only in session memory. Six epics now carry it: release process (#76),
  dashboard V1 (#77), staging-gated distribution (#78), client review loop
  (#79), V2 resolution loop (#80), backlog hygiene (#81). This change
  (issue #89, under epic #81) adds a root `CLAUDE.md` (project specifics, pointer to the global
  rules), a `SECURITY.md`, a CONTRIBUTING § Working method (conception gate,
  pre-push review gate, PR-review Q&A), explicit least-privilege
  `permissions` in `ci.yml` / `lint.yml`, `.github/dependabot.yml` replacing
  the never-activated `renovate.json` (#43), Dependabot alerts + security
  updates enabled on the repo, and the five pending "backfilled post-merge"
  markers above resolved.
- **Security review:** Gitleaks clean on the full history, all actions
  SHA-pinned, zero production advisories, user strings HTML-escaped. 29
  dev-only advisories were all patchable within the declared ranges
  (`pnpm update`, separate commit); `node-forge` via `sonarqube-scanner` has
  no fixed version and is recorded as an accepted risk in `SECURITY.md`.
- **Why:** The method the global rules require was nowhere in git; an agent
  or a human opening the repo had to rely on memory. Dependabot gives the
  repo its first automated CVE signal.
- **Ref:** issue [#89](https://github.com/benoit-bremaud/feedback-widget/issues/89), PR [#90](https://github.com/benoit-bremaud/feedback-widget/pull/90),
  merge commit [`1a64276`](https://github.com/benoit-bremaud/feedback-widget/commit/1a64276).

### PR #67 merged — v0.6.0 released, tag pushed

- **What:** Merged the release PR (CHANGELOG `[0.6.0] - 2026-09-23`, README
  embed snippet on `widget-0.6.0.js`) and tagged `v0.6.0` on the merge commit;
  `publish.yml` publishes both packages to GitHub Packages. The root
  `package.json` (private, never published) still said 0.1.0 and is aligned to
  0.6.0 in the follow-up PR that carries this entry, which also completes
  CONTRIBUTING § Release workflow (deployment order Worker → bundle →
  consumers with a coordinated cutover on contract changes, consumer
  notification, version bump rule, hotfix flow without backports) and
  closes #13.
- **Why:** The code had been at 0.6.0 on `main` since 2026-09-23 (#64) with no
  tag; consumers could not pin the release and the Worker lockstep (#83) needs
  a tagged bundle to copy. Tagging deploys nothing to any site — only the
  Worker update (#83) and the bundle load are production-affecting, in that
  order.
- **Ref:** issue [#82](https://github.com/benoit-bremaud/feedback-widget/issues/82), PR [#67](https://github.com/benoit-bremaud/feedback-widget/pull/67),
  merge commit [`ac6c677`](https://github.com/benoit-bremaud/feedback-widget/commit/ac6c677),
  tag [`v0.6.0`](https://github.com/benoit-bremaud/feedback-widget/releases/tag/v0.6.0).

### PR #103 merged — legacy taxonomy remap decision recorded (#84)

- **What:** Adds the decision spec and sequence diagram for the D1 rows that
  still carried the taxonomy retired by #64. Option C was chosen: remap the
  legacy rows once with a D1 migration instead of a tolerant read path. Review
  finding (Codex, P2) fixed: the DDL in `feedback-dashboard-build.md` now
  matches the as-built schema. The implementation lives in
  [feedback-pipeline-worker#39](https://github.com/benoit-bremaud/feedback-pipeline-worker/pull/39),
  deployed as Version `e1e79acd`, D1 migration `0002` applied, 0 legacy rows
  left.
- **Why:** A tolerant read would have kept two taxonomies alive in every
  consumer; a one-shot remap keeps the Worker contract single-sourced. The
  decision had to live in git, next to the diagrams, not in session memory.
- **Ref:** issue [#84](https://github.com/benoit-bremaud/feedback-widget/issues/84), PR [#103](https://github.com/benoit-bremaud/feedback-widget/pull/103),
  squash commit [`468a0df`](https://github.com/benoit-bremaud/feedback-widget/commit/468a0df).

### Backlog hygiene — stale issues, milestones and board statuses (#86, #87)

- **What:** Closed #15 (roadmap v0.3.0+, superseded by epics #76–#81), #17
  (memory entry, done locally months ago) and epic #76 (all children done:
  #13, #82, #83, #84); #43 had already been closed by #90 (Dependabot replaced
  Renovate). Closed the three milestones left open without live work:
  v0.2.1 — Hardening, v0.3.0 — Multi-project pipeline, v0.6.0 — Feedback
  taxonomy rework. On Project 52, every item now has a Status (Done on every
  closed issue and merged PR, Backlog on every open issue); PRs #64–#67 and
  the widget bug reports #68–#75 and #88 are attached to the board. This PR
  carries this entry plus the #103 entry above; no code change.
- **Why:** The board could not pilot the project while 68 items had no
  Status and three milestones pointed at shipped work. Only live milestones
  and epics remain open, which is epic #81's definition of done for these
  two children.
- **Ref:** issues [#86](https://github.com/benoit-bremaud/feedback-widget/issues/86), [#87](https://github.com/benoit-bremaud/feedback-widget/issues/87),
  PR [#104](https://github.com/benoit-bremaud/feedback-widget/pull/104),
  squash commit [`06c1f0b`](https://github.com/benoit-bremaud/feedback-widget/commit/06c1f0b).

### Dependabot majors triaged — #91–#99 cleared, npm lockfile PRs unblocked (#105)

- **What:** First Dependabot backlog, nine MAJOR bumps. The five workflow
  PRs (#91 pnpm/action-setup 6, #92 actions/checkout 7, #93 gitleaks-action
  3, #94 actions/setup-node 7, #95 actions/upload-artifact 7) were green and
  independent: merged as-is. The four npm PRs (#96 eslint 10, #97 globals 17,
  #98 happy-dom 21, #99 typescript 6) all failed at
  `pnpm install --frozen-lockfile`: Dependabot regenerates `pnpm-lock.yaml`
  without the root `pnpm.overrides` block, so the lockfile never matches
  `package.json`. Those three overrides (`ws`, `brace-expansion`, `vite`)
  were dead: the lockfile resolves the patched versions without them and
  `pnpm audit` is unchanged. This PR drops them and lands the four majors
  plus `@eslint/js` 10 (the eslint pair Dependabot did not propose) in one
  change validated by `pnpm verify`; #96–#99 are closed with a reason, and
  `.github/dependabot.yml` now groups `eslint` + `@eslint/*` majors. The
  high alert #1 (`node-forge` ≤ 1.4.0 via `sonarqube-scanner`) is dismissed
  as tolerable risk: dev-only, no patched version, already recorded in
  `SECURITY.md`.
- **Why:** Merging the npm PRs one by one would have failed on every rebase
  for the same lockfile reason, and every future Dependabot npm PR with it.
  Removing the dead overrides fixes the cause; one combined PR keeps the
  decision and the verification in a single place.
- **Ref:** issue [#105](https://github.com/benoit-bremaud/feedback-widget/issues/105)
  under epic [#81](https://github.com/benoit-bremaud/feedback-widget/issues/81),
  PRs [#91](https://github.com/benoit-bremaud/feedback-widget/pull/91)–[#95](https://github.com/benoit-bremaud/feedback-widget/pull/95)
  merged, [#96](https://github.com/benoit-bremaud/feedback-widget/pull/96)–[#99](https://github.com/benoit-bremaud/feedback-widget/pull/99)
  closed, Dependabot alert [#1](https://github.com/benoit-bremaud/feedback-widget/security/dependabot/1).

### Epic #81 wrap-up — #85 closed, orphan issues routed, coverage doc points at vitest (#101)

- **What:** #85 closed as completed after checking its DoD on main
  (`73ed160`): #64–#67 are logged and the only `backfilled` hit is the
  narrative sentence in the #90 entry. The audit for #81's last DoD box
  found ten open issues without an epic: #68–#75 and #88 now sit under the
  new epic #107 (widget pick-mode and outbox hardening), and #102 under
  #78 (distribution). CONTRIBUTING § Coverage drops its copy of the
  threshold table and names the two `vitest.config.ts` files as the
  source of truth. This PR also bundles the Ref of the #105 entry above:
  combined PR #106, squash commit `73ed160`.
- **Why:** A duplicated threshold table drifts at the first ratchet, and
  #81 cannot close while open issues have no epic.
- **Ref:** issues [#85](https://github.com/benoit-bremaud/feedback-widget/issues/85),
  [#101](https://github.com/benoit-bremaud/feedback-widget/issues/101),
  epics [#81](https://github.com/benoit-bremaud/feedback-widget/issues/81),
  [#107](https://github.com/benoit-bremaud/feedback-widget/issues/107),
  PR [#106](https://github.com/benoit-bremaud/feedback-widget/pull/106).

### Everything local — doc coverage 100 %, hosted CI and reviewer retired (#110, #109)

- **What:** PR #112 documents all 70 exported declarations of
  `packages/*/src` (2 % → 100 %, comment-only diff) and adds
  `scripts/doc-coverage.sh` as a `pnpm verify` step with a 90 % floor. PR
  #113 makes `pnpm verify` the CI of record: a frozen-lockfile step, a
  missing scanner fails the gate unless `VERIFY_ALLOW_SKIP=1`,
  `sonar.qualitygate.wait=true` turns a red SonarQube gate into a failure,
  the `review-local` report replaces the hosted Copilot review, and
  `ci.yml` / `lint.yml` / `gitleaks.yml` only run on `workflow_dispatch`.
  New epic #107 groups the widget hardening issues and #114 (33 legacy
  SonarQube issues). This PR closes the last child of epic #81 (#111):
  sharper TSDoc on thin blocks, the counter now requires a `/**` opener and
  skips `.d.ts`, the strict-mode failure line goes to stderr.
- **Why:** No hosted reviewer is available (Copilot credits exhausted,
  Codex quota hit) and GitHub Actions refuses to start jobs on this account
  (billing). The owner's 2026-10-16 pre-merge gate (tests, test and doc
  coverage, SonarQube, secrets, QA pass) therefore runs entirely on the
  developer machine.
- **Ref:** issues [#109](https://github.com/benoit-bremaud/feedback-widget/issues/109),
  [#110](https://github.com/benoit-bremaud/feedback-widget/issues/110),
  [#111](https://github.com/benoit-bremaud/feedback-widget/issues/111),
  PRs [#112](https://github.com/benoit-bremaud/feedback-widget/pull/112) `da53f4d`,
  [#108](https://github.com/benoit-bremaud/feedback-widget/pull/108) `d01a278`,
  [#113](https://github.com/benoit-bremaud/feedback-widget/pull/113) `c426c10`,
  epics [#81](https://github.com/benoit-bremaud/feedback-widget/issues/81),
  [#107](https://github.com/benoit-bremaud/feedback-widget/issues/107).

## 2026-10-30

### Richer feedback taxonomy — conception, Worker, widget (#128)

- **What:** PR #129 (`26d7fb0`) merged the spec
  `docs/architecture/specs/feedback-taxonomy.md` and its class and state
  diagrams: six families, 26 sub-families, guided prompts, draft-preserving
  navigation. `feedback-pipeline-worker` PR #44 (`dc2ae2c`) added a v0.6.x
  compatibility tier and migration `0003`; it was deployed and `0003` applied
  in production the same day (0 rows touched). The widget PR implements the
  spec, moves the success and mailto outcomes into the controller and fixes
  a closed widget re-opening after a late send result.
- **Why:** Production data (16 rows) showed 75 % of reports filed as
  `suggestion/improvement` or `unclear/missing-info` and none as `bug` or
  `content`: testers lacked precise slots and an `other` escape.
- **Ref:** issue [#128](https://github.com/benoit-bremaud/feedback-widget/issues/128),
  PR [#129](https://github.com/benoit-bremaud/feedback-widget/pull/129) `26d7fb0`,
  follow-ups [#130](https://github.com/benoit-bremaud/feedback-widget/issues/130),
  [#131](https://github.com/benoit-bremaud/feedback-widget/issues/131),
  [#132](https://github.com/benoit-bremaud/feedback-widget/issues/132) (coverage floor 95 %).

## 2026-11-02

### Six-family taxonomy shipped in the widget (#128, PR #133)

- **What:** PR #133 (squash `9d63417`) implements the #128 spec: six
  families and 26 sub-families, a guided question and placeholder per pair,
  a `family › sub-family` breadcrumb, a `discard-confirm` step when closing
  with a typed message, and focus return to the launcher. The QA pass filed
  issues #135–#148 (#135 and #136 at P1).
- **Why:** Give testers precise slots and an `other` escape so reports stop
  piling into two catch-all sub-families.
- **Ref:** issue [#128](https://github.com/benoit-bremaud/feedback-widget/issues/128),
  PR [#133](https://github.com/benoit-bremaud/feedback-widget/pull/133) `9d63417`.

### Release v0.7.0 (#149)

- **What:** Bumped every package to 0.7.0, cut the changelog and rebuilt
  `widget-0.7.0.js`; the bundle is then copied to `feedback-pipeline-worker`
  (`public/widget.js` + `public/widget-0.7.0.js`) and deployed.
- **Why:** The Worker only accepts the new taxonomy pairs from
  `widgetVersion` 0.7.0, so the feature is live only once this release is
  served.
- **Ref:** issue [#149](https://github.com/benoit-bremaud/feedback-widget/issues/149).

### Pointing mode swallows outside-root clicks (#135, PR #154)

- **What:** PR #154 (squash `66fcc4f`) swallows every activation outside the
  widget in pointing mode, picks only inside the root, and makes `body` the
  default `rootSelector`. Review follow-ups filed as #151–#153 and #155.
- **Why:** Header and footer links navigated away mid-pick (dropping the
  draft) and page CTAs ran their own action.
- **Ref:** issue [#135](https://github.com/benoit-bremaud/feedback-widget/issues/135),
  PR [#154](https://github.com/benoit-bremaud/feedback-widget/pull/154) `66fcc4f`.

### Form field text kept out of the target descriptor (#136, PR #161)

- **What:** PR #161 (squash `d16b99a`) strips form field text from the
  captured target `label`, `excerpt` and `headingText`. Review follow-ups
  filed as #156–#160.
- **Why:** A reporter's typed input must never leave the page inside the
  target descriptor.
- **Ref:** issue [#136](https://github.com/benoit-bremaud/feedback-widget/issues/136),
  PR [#161](https://github.com/benoit-bremaud/feedback-widget/pull/161) `d16b99a`.

### Worker payload contract pinned by a shared schema (#118)

- **What:** Added `contract/feedback-payload.v1.schema.json` (JSON Schema
  2020-12) with valid / invalid fixtures, and a core test that checks the
  schema against `SUB_CATEGORIES_BY_CATEGORY` and the message / reporter-name
  bounds; `MAX_REPORTER_NAME_LENGTH` is now a core constant instead of a
  literal `maxlength`. The Worker adopts the same artefact in a follow-up.
- **Why:** The Worker re-implements the payload shape, tables and bounds;
  a drift now fails a test instead of rejecting submissions in production.
- **Ref:** issue [#118](https://github.com/benoit-bremaud/feedback-widget/issues/118).

## 2026-11-07

### Every check moved to the local CI, one tag-triggered workflow left (#163)

- **What:** Installed the `local-ci` layout — `justfile` (`fast` / `check` /
  `gate` / `nightly`, plus `setup`, `merge`, `rehearse`, `attest staging`,
  `publish`), `lefthook.yml`, `mise.toml` + `mise.lock`, `scripts/attest.sh`,
  `scripts/check-commit-msg.sh`, the wiring tests `scripts/test-local-ci.sh`
  and `scripts/test-attest.sh`, `.github/allowed_signers`, `typos.toml`,
  `.semgrepignore`, `osv-scanner.toml` — and retired `scripts/verify.sh`,
  `.githooks/` and the `prepare` script. Removed `ci.yml`, `lint.yml` and
  `gitleaks.yml`; `publish.yml` became `prod.yml` (skill `release-tag` §
  Prod workflow): `classify` → trusted `attest.sh release` of `main` →
  publish `latest`, pre-release tags (`-rc.N`, dotted, #123) signed and on
  `main` → `rc`. Release tags are now signed; `.nvmrc` pins Node 22.21.1.
  Measured: `just fast` ≈ 3 s, `just check` ≈ 50 s. Actions minutes
  Oct + Nov 2026: 142 + 18, the table is on the issue.
- **Why:** GitHub bills the personal account for Actions minutes beyond the
  private-repo quota (agents-skills#210, model A, ADR-0004; wave 0 bis
  agents-skills#259): the only thing GitHub still runs is the publication
  of a signed stable tag, every other check is local and attested.
- **Derogations:** the widget deploys nowhere by itself, so `just attest
staging` records the QA pass of the bundle on the Worker's staging host
  (no `deploy` recipe). osv-scanner findings in six development packages
  waived until 2026-12-31 (#164): the laptop's TLS interception blocked
  `pnpm update` that day (`aikidoctl certconfig`, owner-side).
- **Ref:** issue [#163](https://github.com/benoit-bremaud/feedback-widget/issues/163),
  follow-up [#164](https://github.com/benoit-bremaud/feedback-widget/issues/164).
