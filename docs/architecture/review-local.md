# Local review — feedback-widget (branch diff main...HEAD)

- Date: 2026-10-30
- Commit: `03c8fc5` on `feat/128-richer-feedback-taxonomy` (base `4895728`)
- Scope: `git diff main...HEAD` — `docs/architecture/specs/feedback-taxonomy.md`, `docs/architecture/diagrams/feedback-taxonomy/04-class.md`, `05-state-widget-session.md` (docs only, no code touched)
- Checks run: docs (doc-auditor) · correctness (two adversarial passes against `Feedback.ts`, `View.ts`, `widget.ts`, `i18n.ts`, `WidgetConfig.ts`, the Worker allowlist and migration 0002) · security (gitleaks + diff read) · design and tests n/a (conception documents)
- Verdict: ship · Must 0 · Should 0 · Nice 2 (deferred to the PR body / the code PR)

## Pre-merge gate (head SHA `03c8fc5`, `--push` mode)

| Step        | Result                                                                                                                                                                                       |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Tests     | ✅ core 68/68 (6 files) · ✅ web 134/134 (10 files) · no E2E suite in the repo                                                                                                               |
| 2 Coverage  | core 96.29 % stmts / 93.93 % branches / 91.3 % funcs / 96 % lines · web 88.8 % / 77.97 % / 85.71 % / 91.93 % (runner floors enforced, unchanged by this diff) · docs 100 % (70/70, floor 90) |
| 3 SonarQube | ✅ `QUALITY GATE STATUS: PASSED` (local SonarQube, project `feedback-widget`, global analysis token)                                                                                         |
| 4 Secrets   | ✅ gitleaks clean (`main..HEAD`, 2 commits) · no tracked `.env*` · diff read: field names only, no token, no personal data                                                                   |
| 5 QA pass   | — skipped (`--push` mode, docs-only diff)                                                                                                                                                    |

- Gate: **GREEN for push** (merge gate step 5 not required for a docs PR).

## 🔴 Must Have

_None._ (Two found by the doc audit — `Sending`/`Error` nested inside the `Reporting` composite, `keep-editing` from `Error` undrawn — fixed in `03c8fc5`. Six found by the first adversarial pass — impossible `Error → Precision: retry`, `close` missing from four states, discard guard narrower than D5, "0 rows / no migration" ignoring the legacy chain and deployed 0.6 widgets, 24 vs 26 sub-families, ambiguous prompt keys — fixed in `8cd5834`.)

## 🟡 Should Have

_None._ (All applied: `requiresSubCategory` guards, new `UserAction` kinds listed, view-driven outcomes reworded against `widget.ts:394-445`, `WidgetConfig.categories` migration note, enumeration cannot own a composition, `Status` / `Decisions captured` headers, code-name mapping, prompt fallback order.)

## 🔵 Nice to Have

- `docs/architecture/diagrams/feedback-taxonomy/` `[docs]` · diagrams 01–03 (use case, sequence, component) are absent · state in the PR body that they are unchanged by #128.
- `packages/core/src/domain/Feedback.ts:1-22` `[docs]` · the header ("`other` was dropped…") becomes stale once the table changes · update it in the code PR.

## ⚪ Disagree / Intentional

- `05-state-widget-session.md` `[correctness]` · `Precision --> SubCategory: submit [requiresSubCategory and no sub-family]` is practically unreachable · kept: it mirrors the defensive re-route in `preparePayload` (`widget.ts:336`) and the diagram must cover every (state, event) pair.
- `05-state-widget-session.md` `[docs]` · test list kept in the Notes rather than a traceability matrix · the repo has none.

## Per-dimension summary

- Design: n/a (no code) · Docs: template-conformant, links resolve, no trailing fence, counts verified (5/13 → 6/26) · Tests: n/a · Security: clean · Correctness: every transition and guard traced to `widget.ts`; D2 now states the Worker compatibility window instead of "no migration".
