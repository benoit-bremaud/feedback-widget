# Contributing to feedback-widget

Thank you for opening this file. Whether you are future-me coming back to the
project after six months or a new collaborator trying to ship a first PR, this
document is the single source of truth for how change happens in this repo.

It covers **what** to do, **how** to do it, and — most importantly — **why**.
Read it once end-to-end. After that, use it as a reference.

> **Authoritative scope.** This file governs contribution conventions for
> `benoit-bremaud/feedback-widget`. Cross-repo policy (e.g. private-first
> release, AI attribution ban) is mirrored here verbatim so the rule lives in
> git and remains enforceable without external context.

---

## Table of contents

1. [Workflow overview](#workflow-overview)
2. [Issue conventions](#issue-conventions)
3. [Branch naming](#branch-naming)
4. [Commit conventions](#commit-conventions)
5. [Pull Request metadata (mandatory)](#pull-request-metadata-mandatory)
6. [Pull Request description template](#pull-request-description-template)
7. [Definition of Done](#definition-of-done)
8. [Testing requirements](#testing-requirements)
9. [Security](#security)
10. [AI attribution — strictly forbidden](#ai-attribution--strictly-forbidden)
11. [Public release checklist](#public-release-checklist)
12. [Changelog and project log](#changelog-and-project-log)
13. [Release workflow](#release-workflow)
14. [Tag conventions](#tag-conventions)
15. [Cross-links](#cross-links)

---

## Workflow overview

```text
Issue (Conventional Commits title)
  └─► Branch (<type>/T-<issue-number>-<kebab-description>)
        └─► Commits (Conventional Commits)
              └─► Pull Request (metadata + template + linked issue)
                    └─► Review (automated reviewer + any human reviewer) + CI green
                          └─► Explicit merge approval from the owner
                                └─► Squash merge to main + branch deletion
                                      └─► Post-merge cleanup + PROJECT_LOG update
```

**One issue = one PR.** Keep changes atomic and reviewable. If work grows
beyond the original issue, split it into a follow-up issue rather than
inflating the current PR.

**Why this matters.** A strict issue→branch→PR→merge chain keeps the audit
trail readable. Every change on `main` can be traced back to an issue with
rationale, a PR with review history, and a commit with a conventional
message. Skipping a step breaks that chain forever.

---

## Issue conventions

### Issue titles

All issue titles follow **Conventional Commits** format:

```text
<type>(<scope>): <short description>
```

**Types** (lowercase, singular):

| Type       | Use for                                                     |
| ---------- | ----------------------------------------------------------- |
| `feat`     | New user-visible capability                                 |
| `fix`      | Bug fix (behaviour was wrong or broken)                     |
| `chore`    | Infra, tooling, maintenance — no feature and no fix         |
| `docs`     | Documentation only                                          |
| `test`     | Tests added or reworked without changing behaviour          |
| `refactor` | Internal restructuring, no behaviour change, no test change |
| `ci`       | CI/CD pipeline change                                       |
| `release`  | Version bump + changelog cut (release PRs only)             |

**Scopes** — match the affected area:

- `core` — `packages/core` (pure logic, DOM-free)
- `web` — `packages/web` (browser adapters + entry point)
- `ci` — GitHub Actions, workflow files
- `governance` — repo policies, templates, process docs
- `testing` — tests, coverage, test infra
- `docs` — README, CONTRIBUTING, PROJECT_LOG, other committed docs
- `release` — changelog, version bumps, publish workflow
- `security` — security-related work
- `react-native` — future RN package (reserved)

**Good examples:**

```text
feat(web): add bottom-sheet animation on feedback trigger
fix(core): correct rate-limit window on day boundary
chore(ci): pin actions/checkout to SHA
docs(contributing): write CONTRIBUTING.md with conventions and DoD
test(core): cover outbox drain retry on transport failure
```

**Anti-patterns — never:**

```text
[FEAT] Add bottom-sheet animation          ← bracketed prefixes
T-42: add rate-limit fix                   ← the issue number is the identifier
EPIC-06 — governance foundations           ← free-form prefix
Fix bug                                    ← no scope, no specificity
```

Do not duplicate the issue number in the title. GitHub already surfaces it.

### Issue labels

Every issue must carry the **triptych**: exactly one `type:*`, at least one
`area:*`, exactly one `prio:*`.

- **Type** (exactly one):
  `type:feature` · `type:bug` · `type:docs` · `type:task`
- **Area** (one or more):
  `area:core` · `area:web` · `area:ci` · `area:react-native` ·
  `area:governance` · `area:testing` · `area:docs` · `area:release`
- **Priority** (exactly one):
  `prio:P0` (foundation, blocks everything) ·
  `prio:P1` (high) · `prio:P2` (medium) · `prio:P3` (nice to have)
- **Cross-cutting** (when relevant):
  `security` · `tech-debt` · `epic`
- **Sprint queue** (active work only):
  `next:1` through `next:5` — reassigned after each merge

**Why P0/P1/P2/P3 instead of simple high/medium/low.** The numeric scale
forces a stack-ranked backlog and makes "blocks everything" (P0) explicit.
`P0` means the project cannot progress without it — use sparingly.

### Issue milestones

Every issue must target the current release milestone unless it is genuinely
deferred. Milestones mirror the semver release you are aiming the work at
(e.g. `v0.2.0 — Foundations`).

Leave the milestone blank only if:

- The issue is an epic parent whose children drive the milestones, or
- The issue is cross-cutting discovery with no committed release yet.

### Issue body — mandatory sections

**For `feat` / `docs` / `task` issues** (every issue that proposes new
work), the body must follow this structure:

```markdown
## Goal

<One paragraph — what outcome this issue achieves and who benefits.>

## Scope

**IN:** <bulleted list of what is explicitly included>
**OUT:** <bulleted list of what is explicitly excluded>

## Acceptance criteria (DoD)

- [ ] <testable, checkable criterion>
- [ ] <...>

## Notes & Links

<References, parent epic, related PRs, external links.>
```

**Why this template.** The Scope IN/OUT section kills scope creep before it
starts. The DoD checklist turns "done" from a judgement call into a
verifiable checkbox list — reviewers (and automated checks) can use it
literally.

**Required vs optional sections.** `Goal`, `Scope (IN/OUT)`, and
`Acceptance criteria (DoD)` are **required** on every `feat` / `docs` /
`task` issue — the issue forms under `.github/ISSUE_TEMPLATE/` enforce
this by marking those fields `validations: required: true`.
`Notes & Links` is **optional** — it captures references, parent
epics, and related PRs when they exist, but forcing authors to type
`N/A` for issues without external context would be busywork without
value.

**Bug reports use a distinct format** — a bug is a report of what
broke, not a proposal of work, so the Goal / Scope / DoD / Notes
structure does not fit naturally. The
[`.github/ISSUE_TEMPLATE/bug_report.yml`](./.github/ISSUE_TEMPLATE/bug_report.yml)
form defines the canonical shape: Description, Steps to reproduce,
Expected behavior, Actual behavior, Area, Priority, Version/commit,
Evidence. Use that template for every `type:bug` issue.

---

## Branch naming

```text
<type>/T-<issue-number>-<short-kebab-description>
```

`<type>` matches the commit type: `feat` · `fix` · `chore` · `docs` · `test` · `refactor` · `ci` · `release`

**Examples:**

```text
feat/T-42-bottom-sheet-animation
fix/T-57-rate-limit-day-boundary
chore/T-10-tag-protection
docs/T-5-contributing
```

**Why include the issue number.** The branch name alone tells you what issue
drives the work, without opening GitHub. When you have five branches checked
out across two machines, that matters.

**Never commit directly to `main`.** The branch is protected: direct pushes
by collaborators are rejected, force-pushes are blocked, and deletions are
blocked. The owner retains an emergency bypass
(`enforce_admins: false` in the current policy — see
[.github/branch-protection.md](./.github/branch-protection.md)), but that
bypass is treated as an emergency escape hatch only. Every routine change
on `main` must come from a reviewed PR.

---

## Commit conventions

Use **Conventional Commits** — `<type>(<scope>): <short description>`.

The commit format matches the issue title format. A well-scoped PR typically
contains one commit whose message is identical to the PR title.

**Good examples:**

```text
feat(web): add bottom-sheet animation on feedback trigger
fix(core): correct rate-limit window on day boundary
docs(contributing): write CONTRIBUTING.md with conventions and DoD
ci(publish): run build before typecheck to resolve workspace .d.ts
```

**Scope granularity.** The scope is ideally one of the canonical areas
above, but a **narrower qualifier** is acceptable when it identifies the
precise surface being changed — e.g. `ci(publish)` for work on
`publish.yml`, `ci(security)` for security workflows, `chore(release)` for
a version bump. The narrower form is preferred over cramming several
commits under a generic `ci(ci):` or `chore(chore):`.

**Rules:**

- **Type and scope are mandatory.** No freestyle commits.
- **Subject line ≤ 72 characters.** Longer explanations go in the body.
- **Imperative mood** ("add" not "added" or "adds").
- **No period at the end of the subject line.**
- **Body** (optional): wrap at 72 columns, separate from subject by a blank
  line, explain the _why_ — the diff already shows the _what_.
- **Never amend a published commit.** If the commit is on a remote branch
  that others might have pulled, create a new commit instead.

---

## Pull Request metadata (mandatory)

Every PR must carry the full GitHub sidebar populated:

| Field         | Value                                                              |
| ------------- | ------------------------------------------------------------------ |
| **Assignees** | `benoit-bremaud` (always)                                          |
| **Reviewers** | `copilot-pull-request-reviewer` (automated reviewer)               |
| **Labels**    | Same triptych as the linked issue — `type:*` + `area:*` + `prio:*` |
| **Project**   | `feedback-widget` (node ID `PVT_kwHOB8rwIc4BVJlN`)                 |
| **Milestone** | **Set explicitly** to match the linked issue's milestone           |
| **Body**      | Follows the Markdown template below, ends with `Closes #<issue>`   |

**Setting these via gh CLI / API.** Because `gh pr edit --add-project` is
broken for Projects v2, use the GraphQL mutation. **Note:** `Closes #xx`
in the PR body links and closes the issue on merge, but it does **not**
copy the issue's milestone onto the PR. The PR milestone must be set
explicitly.

```bash
# After gh pr create, run:
PR_NUMBER=<n>

# 1. Add the PR to the feedback-widget project (GraphQL — v2)
PR_ID=$(gh api repos/benoit-bremaud/feedback-widget/pulls/$PR_NUMBER --jq '.node_id')
gh api graphql -f query='mutation($p:ID!,$c:ID!){addProjectV2ItemById(input:{projectId:$p,contentId:$c}){item{id}}}' \
  -f p="PVT_kwHOB8rwIc4BVJlN" -f c="$PR_ID"

# 2. Set the milestone explicitly (replace <N> with the milestone number)
gh api repos/benoit-bremaud/feedback-widget/issues/$PR_NUMBER \
  -X PATCH -F milestone=<N>

# 3. Request the automated reviewer
#    (best-effort — 422 if the bot is not yet a collaborator; add via UI then retry)
gh api repos/benoit-bremaud/feedback-widget/pulls/$PR_NUMBER/requested_reviewers \
  -X POST --input - <<'EOF'
{"reviewers": ["copilot-pull-request-reviewer"]}
EOF
```

**Why this much metadata.** Future-you will scan closed PRs through the
GitHub Project board, not through raw issue search. Without `type`/`area`/
`prio` labels and a milestone, a merged PR becomes unfindable.

---

## Pull Request description template

```markdown
## Summary

<One or two sentences — what the PR does and why, written for a human reviewer.>

### <Area — e.g. Core / Web / CI>

- <Key change>
- <Key change>

## Tests

| Package                   | New tests       | Total      |
| ------------------------- | --------------- | ---------- |
| `core` (Vitest, node env) | N (description) | **X pass** |
| `web` (Vitest, happy-dom) | N (description) | **X pass** |

`tsc --noEmit` clean on all affected packages.

## Checklist

- [ ] Happy path + sad path + edge cases covered
- [ ] `tsc --noEmit` passes
- [ ] Build passes
- [ ] Existing tests still green
- [ ] No `any`, no inline styles introduced

Closes #<issue-number>
```

**Rules:**

- `Closes #<issue-number>` goes **at the end** (GitHub processes it anywhere,
  but the convention keeps bodies scannable).
- **Skip sections that do not apply** — a docs-only PR has no Tests section.
- **The Checklist must always be present** with items honestly checked or
  unchecked. Do not tick boxes you did not actually satisfy.

---

## Definition of Done

A PR is Done — and eligible for merge — when **all** of the following hold:

- [ ] Code and/or docs updated to satisfy the issue's acceptance criteria.
- [ ] Tests added covering happy path, sad path, and edge cases — no
      exceptions for behavioural code changes.
- [ ] `tsc --noEmit` passes on all affected packages.
- [ ] `pnpm -r build` passes.
- [ ] All existing tests still green (`pnpm -r test`).
- [ ] All security scans green — Gitleaks must pass; CodeQL and
      Dependency Review are gated on `repository.visibility == 'public'`
      and skip silently on private.
- [ ] No `any` TypeScript type introduced. No default exports introduced.
      No inline styles introduced (if touching `packages/web`).
- [ ] PR description follows the template and ends with `Closes #<issue>`.
- [ ] All automated-reviewer comments addressed inline (Must Have fixed,
      Should Have fixed or justified, Nice to Have acknowledged,
      Disagreements explained with reasoning).
- [ ] Merge approval given explicitly by the repo owner.

**Merge gate — non-negotiable.** Never merge a PR without explicit owner
approval. `--auto`, `--admin`, and other bypass flags are forbidden unless
the owner explicitly requests them.

---

## Testing requirements

### Test runner — Vitest in both packages

| Package         | Environment | Command                                                   | Notes                |
| --------------- | ----------- | --------------------------------------------------------- | -------------------- |
| `packages/core` | `node`      | `pnpm --filter @benoit-bremaud/feedback-widget-core test` | No DOM, pure logic   |
| `packages/web`  | `happy-dom` | `pnpm --filter @benoit-bremaud/feedback-widget test`      | Light DOM, not jsdom |

Do not mix. Do not import `happy-dom` in `core` tests. Do not run `core`
tests in a DOM environment.

### Test requirements per PR

**Every behavioural change ships with tests.** This is a hard rule.

- **Happy path** — the feature works as specified.
- **Sad path** — the feature fails gracefully when preconditions are not met
  (invalid input, missing config, transport error).
- **Edge case** — boundary conditions (empty arrays, zero counts, day
  boundaries, network timeouts, rate-limit window edges).

Docs-only PRs obviously do not need tests. Refactors that change no
behaviour do not need _new_ tests but must not break existing ones.

### Coverage

Coverage is measured with `@vitest/coverage-v8`. Each `vitest.config.ts`
emits `lcov` and `text` reporters, so coverage reports land as
`packages/core/coverage/lcov.info` and `packages/web/coverage/lcov.info`.

Run locally from the repo root:

```bash
pnpm test:coverage
```

CI runs `pnpm test:coverage` on every push and PR and uploads the
LCOV files as a `coverage-lcov` workflow artifact. On internal PRs
and on pushes to `main`, it also feeds those reports to SonarCloud
via `SonarSource/sonarqube-scan-action` so the SonarCloud Quality
Gate check reports a real coverage percentage. The SonarCloud
project is configured for CI-based analysis (not Automatic
Analysis) so LCOV data is read directly; the scan step relies on
the `SONAR_TOKEN` repository secret.

**Forked PRs do not run the SonarCloud scan** — GitHub does not
expose repository secrets to workflows triggered from forks, so the
scan would fail with an authentication error. The workflow step is
guarded with `if: github.event.pull_request.head.repo.fork != true`
and simply skips on fork PRs, keeping the rest of CI (build,
typecheck, tests, LCOV artifact upload) green for external
contributors. Quality Gate decoration then only appears when the PR
is rerun in a trusted context (e.g. by a maintainer pushing the
branch to the upstream repo).

#### Enforced thresholds

Each `vitest.config.ts` declares minimum coverage thresholds under
`test.coverage.thresholds`. `pnpm test:coverage` exits non-zero if
any metric falls below its threshold, which fails CI.

| Package         | Statements | Branches | Functions | Lines |
| --------------- | ---------- | -------- | --------- | ----- |
| `packages/core` | 90         | 85       | 80        | 90    |
| `packages/web`  | 80         | 70       | 80        | 80    |

Thresholds are set a few points below the current baseline to catch
real regressions without flapping on small refactors. Baselines at
the time of wiring (2026-04-24): core 96 / 95.1 / 86.7 / 95.7, web
85.1 / 72.9 / 83.8 / 88.5.

#### Bump policy

Ratchet thresholds upward whenever new tests raise a baseline by
more than 3 points on any metric. Do the bump in the same PR that
introduced the tests so the threshold stays anchored to the real
baseline. Never lower a threshold to "make a PR pass" — write the
missing test instead.

`packages/web/src/index.ts` (barrel re-export) is excluded from
coverage measurement because it is exercised indirectly through the
public API tests, so direct unit coverage would double-count. This
mirrors the existing `sonar.coverage.exclusions` entry.

---

## Linting and formatting

Code style is enforced by ESLint (correctness + repo conventions) and
Prettier (whitespace, quotes, semicolons, line wrapping). Both run on
every push and PR via the `.github/workflows/lint.yml` workflow.

### Commands

```bash
# Check for lint errors (zero-warnings policy).
pnpm lint

# Auto-fix the lint errors that ESLint can fix.
pnpm lint:fix

# Rewrite every source file to match Prettier's style.
pnpm format

# Verify every file is already formatted — non-destructive.
pnpm format:check
```

`pnpm lint` and `pnpm format:check` are both required to pass before
a PR is merge-eligible (gated by the `Lint` check). `pnpm format`
rewrites files in place and is the command to run before committing
once you have made changes.

### Rules enforced

- **No `any`** — `@typescript-eslint/no-explicit-any: error`. Mirror of
  the CLAUDE.md preference; use `unknown` with a narrowing type guard
  instead.
- **No default exports** — `no-restricted-syntax` with an
  `ExportDefaultDeclaration` selector. Named exports only; the rule
  matches the CLAUDE.md preference and keeps imports consistent with
  the repo's barrel style.
- **Base TypeScript strict rules** — `typescript-eslint/strict`
  preset, includes rules like `no-unsafe-assignment`,
  `prefer-as-const`, `no-unnecessary-type-assertion`, etc.
- **Prettier compatibility** — `eslint-config-prettier` is applied
  last so formatting rules live in Prettier only, never duplicated
  in ESLint.

### Configuration files

- **`eslint.config.js`** — ESLint 9 flat config with per-package
  blocks (`packages/core/src/**/*.ts` for Node env,
  `packages/web/src/**/*.ts` for browser env + DOM globals)
- **`prettier.config.js`** — `singleQuote: true`, `semi: false`,
  `trailingComma: 'all'`, `printWidth: 80`, `arrowParens: 'always'`
- **`.editorconfig`** — UTF-8, LF, 2-space indent, trim trailing
  whitespace (except in Markdown where trailing spaces are semantic)
- **`.prettierignore`** — skip `dist/`, `coverage/`, `node_modules/`,
  and `pnpm-lock.yaml`

### Editor integration

This repo does not commit editor configuration beyond `.editorconfig`.
To get auto-format on save:

- **VS Code** — install the Prettier and ESLint extensions; set
  `editor.formatOnSave: true` and
  `editor.defaultFormatter: "esbenp.prettier-vscode"` in your user
  settings (not the workspace).
- **JetBrains** — enable `Prettier` and `ESLint` under Languages &
  Frameworks → JavaScript; set the actions to run on save.

Husky pre-commit hooks are intentionally out of scope — CI is the
single source of truth, local tooling is your choice.

---

## Security

### No secrets in git — ever

- Never commit `.env`, credential files, tokens, API keys, PAT, OAuth
  secrets, webhook IDs, chat IDs, bot tokens, or any other secret value.
- If and when environment variables are introduced, ship a `.env.example`
  at the repo root with **placeholder** values (never real values) — it
  becomes the canonical template for contributors. The project currently
  has no runtime env vars, so there is no `.env.example` yet.
- Gitleaks runs on every push, every PR, and weekly — any finding fails the
  build.

### If a secret is ever committed

1. **Rotate the secret immediately.** Assume it is compromised the moment
   it hit GitHub, even if removed.
2. **Remove it from history** — not just the tip — via `git filter-repo` or
   a fresh repo. Removing it from the latest commit is not enough: the
   history still contains it.
3. **Open a `security`-labelled issue** documenting the incident, rotation,
   and recovery steps.

### Dependency security

- Dependency changes are reviewed via GitHub's Dependency Review workflow
  (gated on public visibility + GHAS).
- Renovate runs on this repo (configured by `renovate.json` at the root).
  It opens one grouped PR per week (Monday before 6am Europe/Paris) for
  all `minor` + `patch` updates, and one PR per `major` update. Every PR
  auto-applies the `type:task` + `area:ci` labels, assigns
  `benoit-bremaud`, and follows the `chore(deps):` commit convention.
  Security updates flagged by GitHub vulnerability alerts bypass the
  schedule and carry a `prio:P1` label.
- **Auto-merge is disabled** — every Renovate PR requires manual review
  and the same merge gate as any other PR (CI green, automated review
  posted, explicit owner approval). This matches the global "never merge
  autonomously" rule.
- The Renovate dependency dashboard (auto-created issue) is the canonical
  view of pending updates; use it to throttle noise or trigger specific
  packages ahead of schedule.
- Renovate itself is a GitHub App and must be installed once on the repo
  via [github.com/apps/renovate](https://github.com/apps/renovate) —
  config lives in git, install state lives on GitHub; both are required.

---

## AI attribution — strictly forbidden

**Never attribute or credit work to AI anywhere in this repository.**

The rule targets _attribution and credit_, not the naming of tools in
policy. This section itself necessarily names the forbidden patterns in
order to define them — that is an explicit exemption for policy and
governance docs. Everywhere else, the following are banned:

- **No `Co-Authored-By`** lines mentioning any AI agent in commits.
- **No `claude-code-assisted`**, `copilot-assisted`, `codex-assisted` or
  similar labels on issues or PRs.
- **No "Generated with Claude Code"**, "Generated with AI", "Made with
  Copilot" or equivalent phrases in PR bodies, issue bodies, or code
  comments.
- **No AI/Claude/GPT/Copilot mentions** as credit, signature, or
  byline in code comments, docs, commit messages, or CHANGELOG entries.
- **No "Resolves review comment from <ai-agent>"** framing in commit
  messages — credit the substance of the review, not the reviewer's
  nature.

**Exemptions (documentation only, no credit implied).** The following are
allowed because they describe the workflow without attributing work:

- The governance documents themselves (`CONTRIBUTING.md`,
  `.github/branch-protection.md`, `.github/publish.md`) may name AI
  tooling when defining rules or documenting workflow steps. If an
  `AGENTS.md` or equivalent multi-agent guidance file is added later,
  it is covered by this exemption.
- GitHub technical identifiers — the bot username
  `copilot-pull-request-reviewer` is a collaborator handle, not credit.
- `PROJECT_LOG.md` entries describing review cycles may name the
  reviewer actor (human or bot) as factual metadata.

**Why.** The project is authored by humans regardless of tooling. The
value of the work stands on its own; leaking tool identity as credit
dilutes authorship and invites review bias. Naming tools in a policy
that governs them does neither.

This policy applies to: commits, PRs, issues, comments, README,
`CHANGELOG.md`, and every other file tracked by git — with the narrow
exemptions above.

---

## Public release checklist

The repo is **private-first**. It will stay private until a complete
security audit passes. Before making this repo (or the packages on
GitHub Packages) public, every item below must be satisfied:

- [ ] `gitleaks detect --source . --verbose` passes on the **full
      history** (not just the working tree).
- [ ] Zero secrets in any tracked file: no tokens, API keys, chat IDs,
      credential IDs, instance IDs, webhook IDs, OAuth secrets, or
      passwords — current or historical.
- [ ] Zero secrets **in git history** — if secrets were ever committed
      then removed, they still live in the history. Rewriting history
      or starting a fresh repo is mandatory in that case.
- [ ] `.env.example` exists with placeholder values only.
- [ ] All secrets used during private development are **rotated** — bot
      tokens, OAuth credentials, API keys, passwords.
- [ ] CI includes a secret-detection job (Gitleaks already does; CodeQL
      and Dependency Review activate automatically once the repo is
      public and GHAS is available).
- [ ] The public-facing README reflects the current install flow (no
      stale references to private-only endpoints).

Until every item is satisfied, the repo stays private. There is no
shortcut.

---

## Changelog and project log

Two complementary files track change over time.

### `CHANGELOG.md` — registry of published versions

Follows the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
format. Every published version gets one section with categorised
changes (`Added` / `Changed` / `Fixed` / `Removed` / `Security`).

- Update `CHANGELOG.md` **when cutting a release** — move unreleased
  entries into a versioned section, bump semver, tag.
- During ongoing work, accumulate entries under `[Unreleased]`.
- Chore-only PRs and dependency bumps do not need changelog entries
  unless they carry user-visible impact.

### `PROJECT_LOG.md` — day-to-day operational journal

Chronological logbook of all significant project activity — PRs
merged, architectural decisions, backlog reorganisations, deliverables
produced.

- Update `PROJECT_LOG.md` **after every significant PR merge**,
  architectural decision, or backlog change.
- Each entry: date, **What / Why / Ref** (PR or commit link).
- This is not the changelog. This is the narrative of how the project
  actually evolved.

**Why both.** The changelog serves consumers (what changed between
versions). The project log serves contributors and future-you (what
happened and why, at the granularity of individual PRs).

---

## Release workflow

Releases are **tag-driven**. The canonical reference is
[`.github/publish.md`](./.github/publish.md).

**Short version:**

1. Update `CHANGELOG.md` — move `[Unreleased]` entries into a new
   versioned section, write the section header with date.
2. Bump `packages/core/package.json` and `packages/web/package.json`
   versions in lockstep. Workspace releases stay aligned.
3. Open a release PR (`release/vX.Y.Z`) with a `type:task` +
   `area:release` label set and the changelog diff.
4. After merge, tag from `main`:
   ```bash
   git checkout main && git pull
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```
   Matches the canonical command in
   [.github/publish.md](./.github/publish.md). Annotated tags
   (`git tag -a`) are also accepted — the workflow reads the tag name,
   not the tag type.
5. The `publish.yml` workflow fires on `v*` tags: it verifies the
   tagged commit is on `main`, builds, typechecks, auto-detects the
   dist-tag (`vX.Y.Z` → `latest`, `vX.Y.Z-rc*` → `rc`, etc.) and
   publishes both packages to GitHub Packages under
   `@benoit-bremaud`.

**Never tag a commit that is not on `main`.** The publish workflow
enforces this — do not try to work around the check.

**Tag protection.** Release tags matching `v*` are protected via a
GitHub ruleset: creation, update, and deletion are blocked for
non-admin collaborators. The owner keeps a bypass to cut routine
releases. Policy and apply/verify commands live in
[.github/tag-protection.md](./.github/tag-protection.md).

**Failed publishes.** If a publish workflow fails partway, document
the failure in `CHANGELOG.md` (reconcile the version entry to say
explicitly nothing shipped) and move to the next rc. The failed tag
stays as an audit marker; the version stays reserved.

---

## Tag conventions

Quick-reference policy for `v*` release tags. Complementary to the
step-by-step §Release workflow above and to the repo-level protection
policy in [.github/tag-protection.md](./.github/tag-protection.md).
Mirrors the cross-project tag conventions every project in this
ecosystem shares.

### Naming — strict semver, `v` prefix

- **Stable**: `vMAJOR.MINOR.PATCH` — always prefixed `v`
- **Prereleases**: `vX.Y.Z-rcN`, `vX.Y.Z-betaN`, `vX.Y.Z-alphaN` —
  undotted counter matching the existing `v0.1.1-rc1` and
  `v0.1.1-rc2` tags in this repo
- **Never reuse a number** — a failed publish keeps its tag as an audit
  marker; bump to the next rc/version (see §Failed publishes below)

### Lifecycle — who / where / how

- Cut from `main` only, after a release PR has merged (`CHANGELOG.md`
  moved to a versioned section, package versions bumped)
- Owner-only — the admin bypass on the tag-protection ruleset is the
  only path to create, move/update, or delete `v*` tags; the ruleset
  enforces that restriction on every other collaborator
- CLI-only: `git tag vX.Y.Z && git push origin vX.Y.Z`. Never create
  a release tag through the GitHub web UI (the commands must stay
  reproducible and scriptable)
- Lightweight or annotated — the publish workflow reads the tag name,
  not the tag type; both are accepted

### Protection — ruleset active

Repository ruleset scoped to `refs/tags/v*`:

- Rules: `creation`, `update`, `deletion` — all blocked
- Bypass: `RepositoryRole: Admin` (`actor_id: 5`), mode `always` —
  mirrors the `enforce_admins: false` escape-hatch pattern used on
  `main`
- Canonical policy, apply/update commands, and verification commands:
  [.github/tag-protection.md](./.github/tag-protection.md)

### Signing — progressive (optional today → mandatory before public)

- **Today (private repo)**: signing is **optional**. GitHub displays
  `Unverified` next to each tag. Accept it.
- **Before the repo goes public**: tags must be signed. Configure a
  GPG or SSH signing key once (`user.signingkey` in `git config`),
  then use `git tag -s vX.Y.Z` instead of `git tag`. GitHub will
  display `Verified`.
- Signing becomes a hard item on the §Public release checklist the
  day the repo visibility changes — no repo goes public with
  unsigned release tags going forward.

### Release notes — `CHANGELOG.md` first, GitHub auto-list as complement

- The primary body of the GitHub release description is the matching
  `[X.Y.Z]` section of `CHANGELOG.md` — deterministic, human-written,
  consistent with the audit trail. (`CHANGELOG.md` headings follow
  the Keep a Changelog convention without the `v` prefix; the tag
  itself keeps the `v`.)
- GitHub's auto-generated PR list is allowed **below** the CHANGELOG
  content as complementary context
- Never let GitHub auto-generate alone — the CHANGELOG stays the
  canonical consumer-facing narrative

### Monorepo — lockstep versioning

- `packages/core` and `packages/web` bump versions in lockstep under a
  single tag — one tag = one release for both packages
- Cross-package versions must stay identical forever; any drift is a
  bug and blocks publish

### Failed publishes

- Keep the failed tag as an audit marker — **never delete it**
- Reconcile the failed `[X.Y.Z-rcN]` entry in `CHANGELOG.md` to state
  explicitly that nothing shipped under that tag (see the
  `[0.1.1-rc1]` section for the template)
- Bump to the next rc number (e.g. from `v0.1.1-rc1` go to
  `v0.1.1-rc2`) — never reuse the failed number

---

## Cross-links

- [README.md](./README.md) — user-facing quickstart, install, API, integration
- [PROJECT_LOG.md](./PROJECT_LOG.md) — operational logbook
- [CHANGELOG.md](./CHANGELOG.md) — published versions
- [.github/branch-protection.md](./.github/branch-protection.md) — branch
  protection policy on `main`
- [.github/tag-protection.md](./.github/tag-protection.md) — tag
  protection policy for `v*` release tags (apply/update/verify
  commands); see also §Tag conventions above for the broader policy
  covering naming, lifecycle, signing, release notes, and monorepo
  lockstep
- [.github/publish.md](./.github/publish.md) — release and publish workflow,
  consumer `.npmrc` setup, PAT rotation

---

_This CONTRIBUTING.md is committed and tracked in git. Changes to it
follow the same PR process as any other change._
