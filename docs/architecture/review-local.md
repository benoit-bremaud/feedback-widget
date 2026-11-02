# Local review — feedback-widget (#128 widget taxonomy flow)

- Date: 2026-10-30
- Commit: branch `feat/128-widget-taxonomy-flow` head (this commit)
- Scope: branch diff `origin/main...HEAD` (14 files)
- Checks run: design · docs · tests · security · correctness · SonarQube · secrets
- Verdict: ship as-is · Must 0 (1 fixed) · Should 0 (4 fixed) · Nice 3 (declined)

## Pre-merge gate (pre-push mode, QA pass pending)

| Step        | Result                                                                                                                                                                                                                                                                                             |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Tests     | ✅ 71 core · 262 web (vitest, happy path / sad path / edge case per behaviour)                                                                                                                                                                                                                     |
| 2 Coverage  | changed files ≥ 95 % on all four metrics: `widget.ts` 100 / 99 / 100 / 100 · `WebComponentView.ts` 96.8 / 95.0 / 100 / 99.5 · `i18n.ts`, `Feedback.ts` 100 · package totals core 97.5 / 95.5 / 91.3 / 97.3, web 97.7 / 92.8 / 99.3 / 99.7 (global 95 % floor: #132) · docs 100 % (74/74, floor 90) |
| 3 SonarQube | ✅ PASSED (new code coverage 100 %; the one new issue, S3776 in `widget.ts`, fixed by extracting `requestClose`)                                                                                                                                                                                   |
| 4 Secrets   | ✅ gitleaks: no leaks · no tracked `.env` · diff read: nothing sensitive                                                                                                                                                                                                                           |
| 5 QA pass   | ⏳ before merge                                                                                                                                                                                                                                                                                    |

- Gate: **GREEN for push** — QA pass required before merge

## 🔴 Must Have

- `packages/web/src/adapters/WebComponentView.ts` `[design]` · Escape in `discard-confirm` emitted `keep-editing` while ✕ and the backdrop emitted an ignored `close`; the view made a state decision · **Fixed** (owner option A, 465/500): the view always emits `close`, the controller treats it as keep-editing on that step; spec D5 and the 05 note updated.

## 🟡 Should Have

- `packages/web/src/widget.ts` `[design|correctness]` · `keep-editing` / `discard` accepted in every step (a stray `discard` during `sending` would bring back the late-result bug) · **Fixed**: guarded on `discard-confirm`.
- `packages/web/src/widget.ts` `[correctness]` · after a failed send queued in the outbox, closing the error step warned that the draft would be lost · **Fixed**: `draftQueued` skips the question; spec D5 and the 05 guard updated.
- `packages/web/src/widget.ts` `[design]` · `DraftStep` type and `isDraftStep` predicate disagreed on `error` · **Fixed**: `DISCARD_RETURN` table.
- `packages/web/src/i18n.ts` `[design]` · `as CategoryPair` cast built `praise/` · **Fixed**: pair lookup only with a sub-category.

## 🔵 Nice to Have

- `packages/web/src/adapters/WebComponentView.ts` `[correctness]` · mailto fallback shown as escaped text, not a link (predates the diff) · declined.
- `packages/web/src/adapters/WebComponentView.ts` `[design]` · ten identical `if/else` branches in `bindEvents` (predates the diff) · declined.
- `packages/web/src/i18n.ts`, tests, spec D5 `[docs]` · one prompt-building form, stale test section header, breadcrumb wording · declined.

## ⚪ Disagree / Intentional

- `CategoryPair` exported from core: pure type derived from the domain table, one source of truth (04 note).
- Breadcrumb labels not escaped: i18n strings are trusted (CLAUDE.md § Code rules).
- `returnTo` / `draftQueued` live in the controller, not in `WidgetState`: the view never reads them.
- Six defensive guards in `WebComponentView.ts` and `widget.ts:547` stay uncovered rather than covered by fake tests.

## Per-dimension summary

- Design: conforms to spec D1–D5 and the 05 state diagram after the fixes · Docs: TSDoc on every new export, CHANGELOG with migration notes · Tests: 109 tests added, behaviour-level, boundaries mocked · Security: no XSS, user strings still escaped, Worker table identical · Correctness: close-during-sending bug fixed, no regression found.
