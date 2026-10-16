# Local review — feedback-widget (branch diff main...HEAD)

- Date: 2026-10-16
- Commit: `d808ef3` on `docs/T-110-tsdoc-coverage`
- Scope: `git diff origin/main...HEAD` — TSDoc on 21 files of `packages/*/src` (comments only), `scripts/doc-coverage.sh`, a `verify.sh` step, CONTRIBUTING § Documentation coverage
- Checks run: docs (doc-auditor, every new block checked against its code) · correctness (diff grep: zero non-comment line in `packages/`) · security (gitleaks) · design (one script, no dependency added) · tests n/a (no behaviour change, suites rerun)
- Verdict: ship · Must 0 · Should 4 (resolved in-branch) · Nice 3 (filed as #111)

## Pre-merge gate (head SHA `d808ef3`)

| Step        | Result                                                                                                                 |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1 Tests     | ✅ core 68 · web 134                                                                                                   |
| 2 Coverage  | tests: core 96.3 / 93.9 / 91.3 / 96.0 · web 88.8 / 78.0 / 85.7 / 91.9 · docs **100 %** (70/70, floor 90)               |
| 3 SonarQube | ✅ scan run by `pnpm verify` (quality-gate wait lands with #109)                                                       |
| 4 Secrets   | ✅ gitleaks clean · no tracked `.env*` · diff read: nothing sensitive                                                  |
| 5 QA pass   | ✅ smoke on the built bundle: widget mounts, panel opens, console clean · `docs/architecture/qa/2026-10-16-T110-*.jpg` |

- Gate: **GREEN** once the owner approves

## 🔴 Must Have

_None._

## 🟡 Should Have

- `packages/web/src/adapters/HttpTransport.ts:23` `[docs]` · "5xx are retried" — any non-2xx/non-4xx is retried · reworded — fixed
- `packages/core/src/ports/Transport.ts:3` `[docs]` · same precision on `server` · reworded — fixed
- `packages/web/src/adapters/LocalStorageRateLimiter.ts:3` `[docs]` · restated field names · trimmed — fixed
- `scripts/doc-coverage.sh:18` `[correctness]` · `xargs` without `-r` reads stdin on an empty file list (false 100 %) · `xargs -r` — fixed

## 🔵 Nice to Have

- Thin one-line blocks on helper types, `/**`-opener strictness of the counter, `.d.ts` exclusion — filed as #111

## ⚪ Disagree / Intentional

_None._

## Per-dimension summary

- Design: one script, no new dependency · Docs: 2 % → 100 %, blocks verified against code · Tests: unchanged, green · Security: clean · Correctness: comment-only diff in source
