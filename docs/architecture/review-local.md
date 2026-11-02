# Local review — feedback-widget (test/118-pin-worker-payload-contract)

- Date: 2026-11-02
- Commit: eb2dd5c + review fixes (second commit)
- Scope: branch diff origin/main...HEAD (#118)
- Checks run: design · docs · tests · security · correctness
- Verdict: ship as-is (the three Must were fixed in the second commit) · Must 0 open · Should 5 · Nice 5

## Pre-merge gate

| Step        | Result                                                                                                                                             |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Tests     | ✅ core 116 · web 276 (`pnpm verify`)                                                                                                              |
| 2 Coverage  | core 97.56 % stmts / 95.45 % branches / 91.3 % funcs / 97.36 % lines · web 97.95 / 93.11 / 99.33 / 99.7 · docs 100 % (75/75)                       |
| 3 SonarQube | ✅ PASSED (local, `pnpm verify`)                                                                                                                   |
| 4 Secrets   | ✅ gitleaks clean (origin/main..HEAD) · no tracked .env · diff read: dummy fixture values only                                                     |
| 5 QA pass   | ⚠️ not run: test and contract diff; the only runtime change swaps the literal 50 for `MAX_REPORTER_NAME_LENGTH` (same value, covered by web tests) |

- Gate: **GREEN on steps 1–4**, step 5 waived for a test-only diff (owner call)

## 🔴 Must Have

- `packages/web/src/widget.ts:355` `[design]` · reporter name still truncated with a literal `50` · fixed: uses `MAX_REPORTER_NAME_LENGTH`.
- `CLAUDE.md:51` `[docs]` · trap still said the limit lives only as `maxlength` · fixed: points to the constant and the contract schema.
- `packages/core/src/contract.test.ts` `[design|tests]` · no test tied the schema to a payload the widget builds, so a renamed or added field drifted silently (issue DoD) · fixed: `required` compared with `buildFeedbackPayload` keys, every category pair built and validated, empty-fixture guard.

## 🟡 Should Have

- `contract/feedback-payload.v1.schema.json` `[security|correctness]` · `maxLength` counts code points, the Worker counts UTF-16 units (2000 emoji pass the schema, fail the Worker) · document or align in the Worker follow-up.
- `contract/feedback-payload.v1.schema.json` `[correctness]` · stricter than the Worker on `projectId` non-empty and `target` required (intended for >= 0.7.0) · document in the description.
- `contract/feedback-payload.v1.schema.json:89-108` `[design|tests]` · target caps come from the Worker, not from widget constants, and no fixture exercises them · Worker follow-up.
- `contract/` `[docs]` · no README on the versioning rule or the root `oneOf` · add with the Worker follow-up.
- `packages/core/src/index.ts:68` `[design]` · `MAX_MESSAGE_LENGTH` newly exported but unused by web · declined: harmless public constant for the contract.

## 🔵 Nice to Have

- `contract.test.ts` `[tests]` · assert the failing keyword per invalid fixture.
- `contract.test.ts` `[tests]` · category order compared strictly (button order is a contract here, see Feedback.ts).
- Schema `[correctness]` · no `additionalProperties` statement; no `format: date-time`.
- Fixtures `[docs]` · praise fixture reuses the crash message.
- Fixtures `[tests]` · no wrong-type fixture (e.g. `scrollDepth` as string).

## ⚪ Disagree / Intentional

_None._

## Per-dimension summary

- Design: proportionate, single source of truth now complete · Docs: CLAUDE.md fixed, contract README deferred · Tests: single-fault fixtures, built-payload drift now caught · Security: no issue, `maxlength` interpolates a constant · Correctness: schema matches Worker for >= 0.7.0 except the UTF-16 length nuance.
