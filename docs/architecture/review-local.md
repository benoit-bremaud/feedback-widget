# Local review — feedback-widget (branch diff main...HEAD)

- Date: 2026-10-16
- Commit: `5894c05` + fixes, rebased on `d01a278` (after #112, #108) on `chore/T-109-local-only-gate`
- Scope: `git diff origin/main...HEAD` — `scripts/verify.sh`, `sonar-project.properties`, `CONTRIBUTING.md`, `CLAUDE.md`, `.github/workflows/{ci,lint,gitleaks}.yml` (manual trigger only, reviewed by hand: trigger block only, jobs unchanged)
- Checks run: design · docs · security · correctness (one combined reviewer agent; tests assessed as not applicable: no source file changed)
- Verdict: ship · Must 2 (resolved in-branch) · Should 2 (resolved in-branch) · Nice 2 (filed in #111)

## Pre-merge gate (after rebase on `d01a278`)

| Step        | Result                                                                                                                 |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1 Tests     | ✅ core 68 · web 134                                                                                                   |
| 2 Coverage  | docs 100 % (70/70) · tests core 96.3 / 93.9 / 91.3 / 96.0 · web 88.8 / 78.0 / 85.7 / 91.9 (stmts/branches/funcs/lines) |
| 3 SonarQube | ✅ `QUALITY GATE STATUS: PASSED` (now enforced by `sonar.qualitygate.wait=true`)                                       |
| 4 Secrets   | ✅ gitleaks clean on `origin/main..HEAD` · no tracked `.env*` · diff read: nothing sensitive                           |
| 5 QA pass   | n/a — tooling and docs only; strict mode checked by hand (`verify` exits 1 without `SONAR_TOKEN`)                      |

- Gate: **GREEN — merge authorised** once the owner approves

## 🔴 Must Have

- `CONTRIBUTING.md:613` `[docs]` · still said missing gitleaks / `SONAR_TOKEN` are only announced as skipped · reworded: they fail the gate, `VERIFY_ALLOW_SKIP=1` for emergencies, red quality gate fails verify — fixed
- `CONTRIBUTING.md:698` `[docs]` · Dependabot merge gate still required "automated review posted" · replaced by the `review-local` report — fixed

## 🟡 Should Have

- `scripts/verify.sh:27` `[correctness]` · `--offline` fails on a cold pnpm store (fresh clone, pruned store) · fall back to a networked `--frozen-lockfile` install — fixed: offline first, networked fallback
- `sonar-project.properties:22` `[docs]` · `qualitygate.wait` also blocks plain `pnpm sonar` up to 300 s · documented in § Local verification gate — fixed

## 🔵 Nice to Have

- `scripts/verify.sh:17` `[correctness]` · only the literal `1` enables `VERIFY_ALLOW_SKIP`; failure line goes to stdout, not stderr
- `CLAUDE.md:38` `[docs]` · "no Copilot / Codex credits" is a temporary fact

## ⚪ Disagree / Intentional

_None._

## Per-dimension summary

- Design: smallest escape hatch, nothing over-engineered · Docs: two stale spots fixed · Tests: n/a · Security: clean · Correctness: `exit 1` in `skip()` ends the script as intended
