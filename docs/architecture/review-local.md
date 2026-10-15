# Local review — feedback-widget (branch diff main...HEAD)

- Date: 2026-10-15
- Commit: working tree on `chore/T-105-deps-majors` (reviewed before the first commit)
- Scope: `git diff origin/main` — `package.json`, `pnpm-lock.yaml`, `PROJECT_LOG.md`, `.github/dependabot.yml` (dependency majors #96–#99 + `@eslint/js` 10, dead `pnpm.overrides` dropped, log entry for #105)
- Checks run: security · correctness · docs (design · tests assessed inline as not applicable: no source file changed)
- Verdict: ship · Must 0 · Should 1 · Nice 1 — the Should resolved in-branch

## 🔴 Must Have

_None._

## 🟡 Should Have

- `.github/dependabot.yml:13` `[correctness]` · `eslint` and `@eslint/js` share a major line but were not grouped, so Dependabot proposed eslint 10 alone (#96) and will do it again · Fixed: `eslint-major` group (`patterns: eslint, @eslint/*`, `update-types: [major]`).

## 🔵 Nice to Have

- `PROJECT_LOG.md:1184` `[docs]` · Long entry · Kept: the log is the audit trail (precedent: #86/#87 entry).

## ⚪ Disagree / Intentional

_None._

## Per-dimension summary

- Design: not applicable (no source change) · Docs: PROJECT_LOG entry cross-checked against GitHub (#91–#95 merged, alert #1 dismissed as tolerable risk, issue #105 under epic #81) · Tests: 68 + 134 pass under happy-dom 21 / typescript 6 · Security: every lockfile source is `registry.npmjs.org`, `pnpm audit` unchanged (node-forge only, accepted risk), no secrets · Correctness: `pnpm verify` green through tests (format, lint zero-warning under eslint 10 / globals 17, build, typecheck TS 6 without deprecation); the SonarQube step failed with 401 on an invalid local token, unrelated to the change.
