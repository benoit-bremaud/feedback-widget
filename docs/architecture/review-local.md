# Local review — feedback-widget (branch diff main...HEAD)

- Date: 2026-10-16
- Commit: working tree on `docs/T-111-tsdoc-sharpen` (base `c426c10`)
- Scope: `git diff origin/main` — `scripts/doc-coverage.sh` (`/**` opener, `.d.ts` excluded), `scripts/verify.sh` (stderr), 4 TSDoc blocks in `packages/core`, `CLAUDE.md`, `PROJECT_LOG.md`
- Checks run: correctness (awk cases traced: single-line, multi-line, code between doc and export, `// … */`, blank lines; probe file with `/* */` counted as undocumented) · docs (claims checked against `IntersectionViewportDetector.ts`) · security (gitleaks) · design · tests n/a (comment-only diff in `packages/`)
- Verdict: ship · Must 0 · Should 0 · Nice 4 (2 fixed, 2 accepted)

## Pre-merge gate

| Step        | Result                                                                                  |
| ----------- | --------------------------------------------------------------------------------------- |
| 1 Tests     | ✅ core 68 · web 134                                                                    |
| 2 Coverage  | docs 100 % (70/70) · tests unchanged (core 96.3 % stmts, web 88.8 % stmts)              |
| 3 SonarQube | ✅ `QUALITY GATE STATUS: PASSED`                                                        |
| 4 Secrets   | ✅ gitleaks clean · no tracked `.env*` · diff read: nothing sensitive                   |
| 5 QA pass   | n/a — no runtime change since the #112 smoke (`docs/architecture/qa/2026-10-16-T110-*`) |

- Gate: **GREEN** once the owner approves

## 🔴 Must Have

_None._

## 🟡 Should Have

_None._

## 🔵 Nice to Have

- `scripts/doc-coverage.sh:31` `[correctness]` · `prev` no longer read · removed — fixed
- `PROJECT_LOG.md` `[docs]` · "this PR" has no number yet · number added after opening — fixed
- `scripts/doc-coverage.sh:20` `[correctness]` · a trailing `code; /** doc */` above an export is not counted · accepted: Prettier never emits that layout
- `packages/core/src/domain/Feedback.ts:35` `[docs]` · long one-line block · accepted: Prettier owns formatting

## ⚪ Disagree / Intentional

_None._

## Per-dimension summary

- Design: counter stays one awk pass · Docs: thin blocks now state the frame or the why · Tests: n/a · Security: clean · Correctness: `/**` tracking verified case by case
