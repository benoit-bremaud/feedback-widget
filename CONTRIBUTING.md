# Contributing to feedback-widget

Thank you for opening this file. Whether you are future-me coming back to the
project after six months or a new collaborator trying to ship a first PR, this
document is the single source of truth for how change happens in this repo.

It covers **what** to do, **how** to do it, and — most importantly — **why**.
Read it once end-to-end. After that, use it as a reference.

> **Authoritative scope.** This file governs contribution conventions for
> `benoit-bremaud/feedback-widget`. Cross-repo policy (e.g. private-first
> release, AI attribution) is mirrored here so the rule lives in git and
> remains enforceable without external context.

---

## Table of contents

1. [Workflow overview](#workflow-overview)
2. [Working method — the three gates](#working-method--the-three-gates)
3. [Issue conventions](#issue-conventions)
4. [Branch naming](#branch-naming)
5. [Commit conventions](#commit-conventions)
6. [Pull Request metadata (mandatory)](#pull-request-metadata-mandatory)
7. [Pull Request description template](#pull-request-description-template)
8. [Definition of Done](#definition-of-done)
9. [Testing requirements](#testing-requirements)
10. [Local verification gate](#local-verification-gate)
11. [Security](#security)
12. [AI attribution — allowed](#ai-attribution--allowed)
13. [Public release checklist](#public-release-checklist)
14. [Changelog and project log](#changelog-and-project-log)
15. [Release workflow](#release-workflow)
16. [Tag conventions](#tag-conventions)
17. [Cross-links](#cross-links)

---

## Workflow overview

```text
Issue (Conventional Commits title)
  └─► Branch (<type>/T-<issue-number>-<kebab-description>)
        └─► Commits (Conventional Commits)
              └─► Pull Request (metadata + template + linked issue)
                    └─► Review (local `review-local` report + any human reviewer) + CI green
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

## Working method — the three gates

These gates apply to every change, by a human or by an AI agent. They are
the repo-level expression of the cross-agent rules in
`~/.agent-rules/common.md`; the agent-facing summary lives in
[CLAUDE.md](./CLAUDE.md).

### 1. Conception gate — design before code

No new behaviour is implemented before its design is validated:

1. The need and its acceptance criteria exist as an issue.
2. The specification and the **minimum** UML views that answer the
   feature's real questions live under `docs/architecture/specs/` and
   `docs/architecture/diagrams/<feature>/` (Mermaid; use-case, sequence,
   component, class, state, data-flow — only the ones that apply).
3. The conception is reviewed for requirements traceability, dependency
   direction (core never imports web or infrastructure), KISS/YAGNI/DRY,
   and pattern fit.
4. The owner validates explicitly. Then, and only then, code.

The spec and the accepted design are the source of truth: when the
implementation reveals a design defect, the design is updated and
re-validated in the same change. Proportionality rules: a one-line fix
needs no diagram; a new use-case does.

### 2. Pre-push review gate — every branch, no trivial-diff exception

Before every `git push`, run a structured read-only review of
`origin/main...HEAD` (Claude Code: skill `review-local`). Classify every
finding **Must Have / Should Have / Nice to Have / Disagree** with a
`file:line` anchor, and answer each one (done / deferred with reason /
disagreed with rationale). The push is authorised only when every Must
Have is resolved and `pnpm verify` is green. A reviewer that could not run
is reported, never silently skipped.

`pnpm verify` is the mechanical half of this gate (format, lint, secrets,
build, types, tests, static analysis). The review is the judgement half:
reach (did the change travel everywhere it should), depth (are the new
invariants tested), and the Worker contract coupling described in
[CLAUDE.md](./CLAUDE.md).

### 3. PR-review gate — one comment at a time

There is no hosted automated reviewer: the review of record is the
`review-local` report, run again on the PR head before the merge. A PR
merges when CI is green, that report has no open Must Have, and every
human comment is answered.

Reviewer comments (local agents, humans) are handled one distinct issue
at a time: **verify each claim against the code** before relaying it, let
the owner decide, reply inline per comment. Before any merge, **re-fetch
all reviews** — later batches count. The step-by-step procedure lives in
the skill `pr-review-procedure` and is not duplicated here.

**Why three gates.** Each one catches what the others cannot: the first
catches the wrong design, the second the wrong diff, the third the wrong
assumption. Together they are cheaper than one production bug on a widget
embedded in someone else's site.

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
| **Reviewers** | None hosted: review-local report (see § PR-review gate)            |
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
- [ ] `pnpm verify` passes locally — it is the gate, and the pre-push
      hook runs it for you.
- [ ] Pre-push review done (§ Working method, gate 2): every Must Have
      resolved, each finding answered.
- [ ] New behaviour went through the conception gate (§ Working method,
      gate 1): spec + UML validated before the code was written. N/A for
      fixes and chores.
- [ ] Gitleaks green (locally via `pnpm verify`, and in CI).
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
LCOV files as a `coverage-lcov` workflow artifact.

The coverage percentage itself is read **locally**: `pnpm verify`
hands the same LCOV reports to the self-hosted SonarQube instance.
See [Local verification gate](#local-verification-gate). There is no
`SONAR_TOKEN` repository secret and no hosted Quality Gate — the
token is personal and lives only in your shell.

#### Enforced thresholds

Each `vitest.config.ts` declares minimum coverage thresholds under
`test.coverage.thresholds`. `pnpm test:coverage` exits non-zero if
any metric falls below its threshold, which fails CI.

The source of truth for the threshold values is
[`packages/core/vitest.config.ts`](packages/core/vitest.config.ts) and
[`packages/web/vitest.config.ts`](packages/web/vitest.config.ts). They
are deliberately not copied here, so this guide cannot drift from them.

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

#### Documentation coverage

`scripts/doc-coverage.sh` counts the exported declarations of
`packages/*/src` (tests, bare re-exports and `typeof` companion types
excluded) that carry a `/** */` block right above them. The floor is
**90 %**; `pnpm verify` fails below it and the script lists every
undocumented export. A block states the contract or the why, never a
restatement of the name.

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

Git hooks used to be out of scope, on the grounds that CI was the single
source of truth. That reversed once the checks moved local: see
[Local verification gate](#local-verification-gate). No hook manager is
installed — `pnpm install` points `core.hooksPath` at `.githooks/`.

---

## Local verification gate

Most checks run **on your machine, before pushing** rather than in CI.

```bash
pnpm verify
```

It runs, cheapest first so an obvious mistake fails in seconds: format
check → lint → secret detection → build → typecheck → tests with coverage
→ SonarQube analysis. It stops at the **first** failure — the point is to
fix it, not to collect a list.

`pnpm install` wires a **pre-push hook** that runs it automatically. To
push past it deliberately — a work-in-progress spike, a branch you know is
red — use `git push --no-verify`. That is a conscious choice, not a
default: `main` is not branch-protected on this repo, so the hook is the
last thing between a broken tree and a shared branch.

**Two checks fail the gate when they cannot run:** secret detection when
`gitleaks` is not installed, and static analysis when `SONAR_TOKEN` is
unset or no instance answers. `VERIFY_ALLOW_SKIP=1` turns them into a
printed skip, for emergencies only. A red SonarQube quality gate also
fails `pnpm verify` (`sonar.qualitygate.wait=true`).

**What stays in CI.** Build, typecheck, tests, lint, and Gitleaks still
run on every PR. The local gate is the fast feedback loop, not a
replacement — it cannot be trusted to have run on someone else's machine.

### Static analysis

SonarQube analysis runs **locally** — it is not a CI step.

**Why it is not in CI.** SonarCloud's free plan analyzes public projects
only, and this repo is private-first. A hosted scan could never
authenticate, so the step failed every pull request regardless of the
diff — including docs-only ones. A check that is red on every PR teaches
reviewers to ignore red checks, which costs more than the analysis was
buying. Restore a hosted scan when the repo goes public; the
[public release checklist](#public-release-checklist) already tracks it.

**Running it.**

```bash
pnpm sonar
```

That runs the test suite with coverage, then hands the LCOV reports to
`sonar-scanner`. It needs:

- a SonarQube instance reachable at `http://localhost:9000` (override
  with `-Dsonar.host.url=` for another server), and
- `SONAR_TOKEN` exported in your shell, generated from that instance.

**Never commit that token, paste it into a chat or an issue, or add it to
the repo.** It is a local credential — if it leaks anywhere, revoke it on
the instance first and generate a new one. See
[If a secret is ever committed](#if-a-secret-is-ever-committed).

**What it does not replace.** Lint, typecheck, and the test suite still
run in CI and still gate every PR. The local scan adds the quality and
security lenses those three do not cover — it does not substitute for
them, and skipping it is not a licence to push a red suite.

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

- Dependency changes are reviewed by hand at PR time. GitHub's Dependency
  Review workflow needs GHAS, which a private repo on the free plan does
  not have — it was removed rather than left skipping on every PR. Restore
  it when the repo goes public.
- **Dependabot** runs on this repo (`.github/dependabot.yml`): one grouped
  PR per week (Monday 06:00 Europe/Paris) for `minor` + `patch` npm
  updates, one PR per `major`, plus GitHub Actions version bumps (SHA pins updated). PRs carry
  `type:task` + `area:ci`, are assigned to `benoit-bremaud`, and use the
  `chore(deps):` / `chore(ci):` prefixes. Dependabot **alerts** and
  **security updates** are enabled in the repo settings, so a CVE opens its
  PR outside the weekly schedule. (Renovate was configured in April 2026
  but its GitHub App was never installed; it was replaced on 2026-10-15,
  tracked in #43.)
- **Auto-merge is disabled** — every dependency PR requires manual review
  and the same merge gate as any other PR (CI green, `review-local`
  report with no open Must Have, explicit owner approval). This matches the global "never merge
  autonomously" rule.
- `pnpm audit` runs on demand; findings without an upstream fix are recorded
  as accepted risks in [SECURITY.md](./SECURITY.md) with a review trigger,
  never silently ignored.

---

## AI attribution — allowed

**Policy reversed on 2026-07-02.** This section previously banned any
mention of AI assistance anywhere in the repository. It no longer does:
being transparent and honest about how the work was produced matters
more than hiding it.

The following are **allowed**:

- **`Co-Authored-By`** trailers naming an AI agent in commits.
- **"Generated with Claude Code"** or an equivalent line in PR bodies.
- **AI mentions in comments and docs** where they are relevant — for
  example recording that a review finding came from an automated
  reviewer.

**Allowed, not mandatory.** Attribution is a choice per commit or PR,
not a required field. Keep it sober: a trailer or a single line, never a
banner.

**What attribution does not change.** The decisions remain authored by a
human — what to build, which trade-off to take, what to reject in
review. A tool trailer records that a tool was used; it never stands in
for that authorship, and it is not a reason to merge work nobody
understands. Reviewing a diff you cannot explain is the actual problem,
with or without a trailer on it.

**Why the reversal.** The old rule optimized for how the work would be
perceived. In practice it meant the git history misrepresented how the
code was written, which is a worse trade than any review bias it was
meant to avoid.

This section is the repo-local mirror of the cross-repo policy. If the
two ever disagree, the cross-repo policy is authoritative and this file
is stale — fix it here rather than working around it.

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
- [ ] CI includes a secret-detection job (Gitleaks already does).
- [ ] **Re-add the GHAS-gated workflows** removed while private — CodeQL
      and Dependency Review — and restore a hosted SonarQube scan. They
      were deleted because they could not run on a private free-plan
      repo, not because they are unwanted.
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
6. **Deploy in this order — the only production-affecting steps.** Merging
   and tagging touch no site. Then: (a) update `feedback-pipeline-worker`
   (it duplicates the category tables and the payload bounds — see
   [CLAUDE.md](./CLAUDE.md) § Repo-specific traps), copy the fresh bundle
   to its `public/widget.js` + `public/widget-X.Y.Z.js`, and deploy it;
   (b) only then let any consumer site load `widget-X.Y.Z.js`. A bundle
   shipped before the Worker means every submission is rejected with 400.
   The Worker _code_ update is needed only when the release changed the
   payload shape, the category tables or the bounds; the bundle copy and
   deploy are needed on every release.
   **When the contract changed, the cutover is coordinated**: the Worker
   deploy and every consumer's bump happen in the same window, because a
   Worker that knows only the new tables rejects the still-pinned
   consumers just as surely. Consumers on the unversioned `widget.js`
   switch with the Worker deploy; pinned consumers must bump in that
   window. If one of them cannot, the Worker **must accept both tables**
   (old and new vocabulary) until it has migrated — plan that
   compatibility in the Worker PR before deploying.
7. **Notify consumers.** The repo owner, right after the tag is pushed,
   opens the Worker PR of step 6 and one `chore(deps)` issue (or PR) on
   each consumer repo that embeds the widget, pointing at the CHANGELOG
   section and the new `widget-X.Y.Z.js` URL. On a compatible release,
   consumers bump when they choose; on a contract change, the issue names
   the cutover window of step 6.

**Version bump rule.** Conventional Commits decide the bump: a `!` or
`BREAKING CHANGE` footer → MAJOR (MINOR while the project is `0.y.z`, as
`v0.6.0` was for the taxonomy rework), `feat` → MINOR, `fix` / `chore` /
`docs` → PATCH.

**Hotfix.** Same flow, smaller: fix on a branch from `main`, run steps 1–7.
The bump is **PATCH only when `main` is still at the last tag**; if `main`
already carries unreleased work, that work ships too and the version follows
the rule above for everything embarked (a `feat` on `main` makes the hotfix a
MINOR, not a PATCH). **Backports are not supported**: `publish.yml` refuses a
tag that is not on `main`, and every stable tag is published as `latest`, so
a `v0.6.1` cut after `v0.7.0` would downgrade `pnpm add` consumers. When an
urgent fix meets a loaded `main`, either release `main` under its honest
bump or keep the unreleased feature behind a flag until then.

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
- [CLAUDE.md](./CLAUDE.md) — agent-facing project specifics (commands, gates,
  Worker coupling, GitHub metadata); inherits the global rules
- [SECURITY.md](./SECURITY.md) — reporting policy, practices, accepted risks
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
