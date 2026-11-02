# Local review — feedback-widget (fix/135-swallow-pointing-clicks-outside-root)

- Date: 2026-11-02
- Commit: 8dab80e
- Scope: branch diff origin/main...HEAD (#135)
- Checks run: design · docs · tests · security · correctness · QA
- Verdict: ship as-is · Must 0 · Should 3 · Nice 5

## Pre-merge gate (head SHA 8dab80e)

| Step        | Result                                                                                                                                                                                                                     |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Tests     | ✅ core 71 · web 268 (`pnpm verify`)                                                                                                                                                                                       |
| 2 Coverage  | web 97.93 % stmts / 93.04 % branches / 99.32 % funcs / 99.7 % lines; touched lines 100 % · docs counter green (`pnpm verify`)                                                                                              |
| 3 SonarQube | ✅ PASSED (local, `pnpm verify`)                                                                                                                                                                                           |
| 4 Secrets   | ✅ gitleaks clean · no tracked .env · diff read: nothing sensitive                                                                                                                                                         |
| 5 QA pass   | ✅ pass (Chromium) · console clean · header/CTA/footer picked without navigation on default root, swallowed on `main` root · report: [2026-11-02-pointing-outside-root-135.md](qa/2026-11-02-pointing-outside-root-135.md) |

- Gate: **GREEN — merge authorised** (pending owner approval)

## 🔴 Must Have

_None._ (The stale previous report flagged by the docs check is replaced by this file.)

## 🟡 Should Have

- `packages/web/src/adapters/IntersectionViewportDetector.ts:240` `[security|correctness]` · the handler calls `raw.closest` on a target that may not be an Element (event dispatched on `document`) → TypeError; existed before · guard `if (!(ev.target instanceof Element)) return`.
- `packages/web/src/adapters/IntersectionViewportDetector.ts:245` `[security]` · if the widget host is nested in another component's shadow root, `closest('feedback-widget')` misses and its cancel click is now swallowed · test `ev.composedPath()` for the host.
- `packages/web/src/adapters/IntersectionViewportDetector.ts:102` `[design]` · with `body` root, the `.fw-pointing *:hover` tint/cursor also hits the widget host · `*:not(feedback-widget):hover`.

## 🔵 Nice to Have

- `IntersectionViewportDetector.ts:258` `[security|design]` · a click on empty space can pick `<body>` itself (whole-page excerpt) · skip `raw === root`.
- `IntersectionViewportDetector.ts:26` `[correctness]` · middle-click (`auxclick`) still opens a new tab (pre-existing, QA) · add `auxclick` to `POINTING_EVENTS`.
- `IntersectionViewportDetector.ts:154` `[design]` · body root stamps `data-fw-id` on header/footer items and may auto-propose footer list items · mention in CHANGELOG.
- `IntersectionViewportDetector.test.ts` `[tests]` · widget-host pass-through only tested for `click`; header-pick test does not assert highlight.
- `CHANGELOG.md` `[docs]` · add a migration hint for the default-root change.

## ⚪ Disagree / Intentional

- `IntersectionViewportDetector.ts:117` `[design]` · `?? doc.body` fallback still needed for custom selectors.

## Per-dimension summary

- Design: minimal, proportionate fix · Docs: TSDoc, UML notes and CHANGELOG fresh · Tests: happy/sad/edge covered, minor gaps · Security: no Must; shadow-host and non-Element edge cases · Correctness: no regression found · QA: all #135 scenarios pass.
