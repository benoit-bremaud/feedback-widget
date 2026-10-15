# Local review — feedback-widget (branch diff main...HEAD)

- Date: 2026-10-15
- Commit: 44b383c (after fixes; reviewed at 1a04618 + 8fda0c4)
- Scope: `git diff origin/main...HEAD` — 14 files: governance docs (CLAUDE.md, SECURITY.md, CONTRIBUTING, PROJECT_LOG), `.github/dependabot.yml` replacing `renovate.json`, `permissions` on ci/lint workflows, dev-dependency patch bumps, 3 Prettier-reformatted files
- Checks run: design · docs · tests · security · correctness
- Verdict: ship — every Must Have resolved in the same branch · Must 4 · Should 5 · Nice 7

No code behaviour changed. Every Must was a factual error in the new documentation
or a convention breach in the dependency override; all were fixed before push and
folded into their respective commits.

## 🔴 Must Have

- `PROJECT_LOG.md:1108` `[docs|correctness]` · #89 called a PR while it is the
  tracking issue (the Ref line itself said "PR number to follow") · **Fixed**:
  "This change (issue #89, under epic #81)".
- `CLAUDE.md:46-50` `[docs]` · Worker-coupling trap pointed only to `Feedback.ts`
  for the bounds; message limits live in `WidgetConfig.ts`, the reporter-name limit
  only as `maxlength` in `WebComponentView.ts` · **Fixed**: the three real
  locations are listed.
- `README.md:5` `[docs]` · SonarCloud badge contradicted CLAUDE.md / CONTRIBUTING
  ("no SonarCloud") · **Fixed**: badge removed. README `v0.5.2` text left to PR #67
  (see Disagree).
- `package.json:41` `[security]` · `vite@^8.0.0: 8.0.16` exact pin froze a
  transitive dep Dependabot cannot bump, and broke the floor-range convention of
  the existing overrides · **Fixed**: `vite@>=8.0.0 <8.0.16: >=8.0.16`; lockfile
  resolves to 8.0.16, `pnpm audit` down to node-forge only.

## 🟡 Should Have

- `CLAUDE.md:35-42` `[docs|design]` · "Three gates" restated CONTRIBUTING § Working
  method (three copies of one process incl. common.md) · **Fixed**: collapsed to one
  line + link.
- `CONTRIBUTING.md:105-114` `[docs]` · Gate 3 duplicated the `pr-review-procedure`
  skill step by step · **Fixed**: principle + link only.
- `CONTRIBUTING.md:694` `[docs]` · "GitHub Actions digest bumps" was inaccurate
  (Dependabot bumps versions and refreshes SHA pins) · **Fixed**.
- `PROJECT_LOG.md:1064-1101` `[docs|correctness]` · Four new Ref lines without the
  terminating period and layout of neighbours; #65 entry had no Why · **Fixed**.
- `CONTRIBUTING.md:700` `[correctness]` · "see #43" implied a closed issue while #43
  is open · **Fixed**: "tracked in #43"; close #43 at merge.

## 🔵 Nice to Have

- `SECURITY.md:23` `[docs|security]` · "Gitleaks runs locally" is conditional on the
  binary being installed · **Fixed**: wording.
- `SECURITY.md:45` `[security]` · node-forge waiver had no re-check cadence ·
  **Fixed**: re-run `pnpm audit` at each release.
- `CONTRIBUTING.md:430` `[docs]` · conception-gate DoD item lacked the
  proportionality note · **Fixed**: "N/A for fixes and chores".
- `CLAUDE.md:57,66` `[design]` · lines repeating global private-first rule and
  PR metadata · **Fixed**: trimmed to the repo-specific part + link.
- `CONTRIBUTING.md § Coverage` `[tests]` · could point to `packages/*/vitest.config.ts`
  as the threshold source · Deferred (pre-existing section, out of scope).
- happy-dom 20.9 → 20.14 changelog not read line by line `[tests]` · Deferred:
  patch/minor inside the major, 134/134 tests green, adapters mocked at the boundary.
- PR body should mention the Prettier-driven reformat of 3 files `[correctness]` ·
  To do in the PR description.

## ⚪ Disagree / Intentional

- `README.md:18,188` `[docs]` · "Currently at v0.5.2" / `widget-0.5.2.js` · Owned by
  the open release PR #67, which already moves them to 0.6.0; changing them here
  would conflict. Tracked in #82.
- `packages/core/src/use-cases/SubmitFeedback.ts:18` `[design]` · union type folded
  on one line · Formatter-owned (Prettier 3.9.10); `pnpm verify` fails without it.
- `.github/workflows/gitleaks.yml` `security-events: write` `[security]` ·
  Pre-existing, needed if SARIF upload ever works; out of scope.

## Per-dimension summary

- Design: no over-engineering; DRY drift CLAUDE.md ↔ CONTRIBUTING fixed · Docs: 3
  factual errors fixed, all commands/paths/anchors verified · Tests: no semantic
  change, no deprecated vitest API, 68 + 134 green · Security: workflows
  least-privilege and SHA-pinned, dependabot.yml valid, SECURITY.md claims verified,
  override convention restored · Correctness: package.json/lockfile consistent and
  frozen-installable, YAML valid, TOC and anchors resolve.
