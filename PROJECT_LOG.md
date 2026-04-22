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
  `.github/publish.md`, and wired `publishConfig.registry =
  https://npm.pkg.github.com` plus `repository`/`homepage`/`bugs`
  fields into both packages' `package.json`. All third-party actions
  are SHA-pinned (`actions/checkout@v4`, `pnpm/action-setup@v4`,
  `actions/setup-node@v4`). Updated `README.md` Installation section
  to promote GitHub Packages as the recommended path while keeping
  the git-URL methods as fallbacks. Consumers install with a
  committable `.npmrc` (`${GITHUB_TOKEN}` resolved from env) and a
  PAT scoped `read:packages` only.
- **Why:** The whole point of the standalone project — `pnpm add
  @benoit-bremaud/feedback-widget` in any consumer (Impropedia
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
  duplicate match). Ruleset activated post-merge via `POST
  /rulesets` — live ID `15413164`, enforcement `active`, owner
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

### PR — add PR description template at `.github/pull_request_template.md`

- **What:** Created `.github/pull_request_template.md` so GitHub
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
  merge commit: *to be updated post-merge*
