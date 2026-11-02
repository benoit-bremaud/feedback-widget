# Local review — feedback-widget (fix/136-strip-form-fields-from-target)

- Date: 2026-11-02
- Commit: ad33f1b
- Scope: branch diff origin/main...HEAD (#136)
- Checks run: design · docs · tests · security · correctness · QA
- Verdict: ship as-is (the one Must was fixed in ad33f1b) · Must 0 open · Should 4 · Nice 4

## Pre-merge gate (head SHA ad33f1b)

| Step        | Result                                                                                                                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Tests     | ✅ core 71 · web 276 (`pnpm verify`)                                                                                                                                                   |
| 2 Coverage  | web 97.95 % stmts / 93.11 % branches / 99.33 % funcs / 99.7 % lines; touched file 100 % lines, only new uncovered branch is the unreachable `textContent ?? ''` · docs 100 % (74/74)   |
| 3 SonarQube | ✅ PASSED (local, `pnpm verify`)                                                                                                                                                       |
| 4 Secrets   | ✅ gitleaks clean · no tracked .env · diff read: nothing sensitive (QA mock site uses a local stub only)                                                                               |
| 5 QA pass   | ✅ pass · PRI-01 PASS on 29 picks, no `SECRET` in preview, POST or outbox · #135 regression PASS · report: [2026-11-02-target-field-privacy.md](qa/2026-11-02-target-field-privacy.md) |

- Gate: **GREEN — merge authorised** (pending owner approval)

## 🔴 Must Have

- ~~`packages/web/src/adapters/IntersectionViewportDetector.ts:131` `[security|design]` · `headingText` read raw `textContent`, so an editable heading or a heading holding a field leaked · fixed in ad33f1b (`safeText(heading)`), two tests added.~~

## 🟡 Should Have

- `IntersectionViewportDetector.ts:346` `[security]` · `FIELD_CONTENT` misses `output`, `datalist`, `[role=searchbox]`, `[role=spinbutton]` · extend the selector + tests.
- `IntersectionViewportDetector.ts:354` `[security|design]` · `safeText` runs twice per pick and `cloneNode` runs custom element constructors of the host page · compute once, or walk text nodes with a `TreeWalker` that rejects field subtrees.
- `IntersectionViewportDetector.test.ts:733` `[tests]` · no case for `role=combobox`, an `input` inside a container, a field inside a field, a picked `option`; excerpt not asserted on every case · add them.
- `IntersectionViewportDetector.ts:154` `[qa]` · QA N1: over a rich editor the auto-detected target is an empty `p`, so the user confirms `« »` · skip candidates inside `FIELD_CONTENT`.

## 🔵 Nice to Have

- `[qa]` N2: picked field preview is empty; fall back to its `<label>` text.
- `[qa]` N3: container label keeps newline runs while the excerpt is normalised.
- `[qa]` F5 (carried over from 2026-10-30): fields get their placeholder instead of their `<label>`.
- `[security]` `computeSelector` exposes ids; an app that builds ids from user data would leak them; note it in SECURITY.md.

## ⚪ Disagree / Intentional

- `IntersectionViewportDetector.ts:355` `[tests]` · `clone.textContent ?? ''` is never null on an Element; kept for strict typing instead of a non-null assertion.

## Per-dimension summary

- Design: one module-private helper, no over-engineering · Docs: accurate, no noise · Tests: trustworthy, gaps listed as Should · Security: one Must fixed, selector gaps as Should · Correctness: no bug beyond the Must · QA: PRI-01 pass.
