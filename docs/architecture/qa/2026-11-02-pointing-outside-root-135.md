# QA pass — pointing clicks outside the pick root, issue #135 (2026-11-02)

| Level                 | Head SHA | Environment                                                           | Targets               | Agent / model                                                   | Matrix page          |
| --------------------- | -------- | --------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------- | -------------------- |
| pass (scoped to #135) | 8dab80e  | local, mock site on http://127.0.0.1:4173 (fresh bundle, built 10:27) | W (embeddable widget) | qa-tester, Sonnet (product part; SEC probes limited, see below) | none (not published) |

Plan: diff touches `IntersectionViewportDetector.ts` (pointing handler swallows pointerdown, mousedown and click everywhere, picks only under the root). Domains in: FON (pointing journey), UI-02 (console/network), SEC-04/08/09 relevant subset. Out: responsive, dark mode, a11y, perf (no layout or style change). Note: the default root is `body`, so the header is inside the root.

## QA matrix

Gate ✅ (no Must) · 🔴 Must 0 · 🟡 Should 0 · 🔵 Nice 1 — 14 checks: Pass 12 · Fail 1 · Not tested/N/A 1... see table

| ID     | Domain | Check                                                 | Result | Verdict | Evidence                                                                                                                      | Issues                       | Shots                           |
| ------ | ------ | ----------------------------------------------------- | ------ | ------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------- |
| 135-1a | FON    | Default root, scrollY 0: click `#nav-products`        | Pass   | PASS    | no navigation, picked "Produits", confirm step shown, no page events                                                          |                              | 01-default-y0-nav-picked.png    |
| 135-1b | FON    | Default root, scrollY 2200 (clamped 2034): same click | Pass   | PASS    | no navigation, picked                                                                                                         |                              | 02-default-y2200-nav-picked.png |
| 135-2a | FON    | `#cta` (header button)                                | Pass   | PASS    | `__events` empty, picked                                                                                                      |                              | 03-default-cta.png              |
| 135-2b | FON    | `#hero-cta`                                           | Pass   | PASS    | `__events` empty, picked                                                                                                      |                              | 04-default-hero-cta.png         |
| 135-3  | FON    | Footer link `#ft-1`                                   | Pass   | PASS    | URL unchanged, picked "Livraison"                                                                                             |                              | 05-default-footer-link.png      |
| 135-4a | FON    | rootSelector `main`: header link                      | Pass   | PASS    | no navigation, nothing picked                                                                                                 |                              | 06-main-header-no-nav.png       |
| 135-4b | FON    | rootSelector `main`: header CTA                       | Pass   | PASS    | no page event, nothing picked                                                                                                 |                              | 07-main-header-cta.png          |
| 135-4c | FON    | rootSelector `main`: footer link                      | Pass   | PASS    | no navigation, nothing picked                                                                                                 |                              | 08-main-footer.png              |
| 135-4d | FON    | rootSelector `main`: `#card-2-btn` inside main        | Pass   | PASS    | picked, page action not run                                                                                                   |                              | 13-main-inside-picked.png       |
| 135-5  | FON    | Widget "Annuler" while pointing                       | Pass   | PASS    | bar gone, page click works again (1 event). The panel and its close button are hidden during pointing, so only Annuler exists |                              | 10, 11, 12                      |
| 135-6  | FON    | Keyboard Enter on focused header link                 | Pass   | PASS    | no navigation                                                                                                                 |                              |                                 |
| UI-02  | UI     | Console and failed requests                           | Pass   | PASS    | zero error/warning/pageerror/requestfailed in every case (listeners attached)                                                 |                              |                                 |
| 135-7  | FON    | Middle-click on header link while pointing            | Fail   | FAIL    | opens a new tab to `/page2.html?from=nav`; current page and draft intact                                                      | not filed (per instructions) |                                 |
| SEC    | SEC    | SEC-01/02/03/05/06/07/10                              | N/A    | N/A     | static local mock page, no cookies or API of the product under test; change is client-side only                               |                              |                                 |

Security subset run: SEC-04 N/A (no new rendering of user strings in the diff); SEC-09 PASS (production bundle: no `sourceMappingURL`, no key or token pattern, no embedded URL); `gitleaks` on the QA folder: no leaks. Probe note: `stopImmediatePropagation` on document capture silences host-page handlers while pointing; this is intended and bounded to the pointing session (removed on cancel, proven by 135-5).

## Findings to act on

1. 🔵 Nice — middle-click (`auxclick`) is not swallowed while pointing (135-7). Seen: baseline middle-click without widget also opens a tab, so the handler never covered it; pre-existing, not a regression of #135. Impact: low, the draft survives in the original tab. Suggested fix, not applied:

```diff
-const POINTING_EVENTS = ['pointerdown', 'mousedown', 'click'] as const
+const POINTING_EVENTS = ['pointerdown', 'mousedown', 'click', 'auxclick'] as const
```

(the handler returns early for non-click types, so no pick on auxclick; add a test).

## Not tested

Mobile/touch, dark mode, cross-engine (Firefox/WebKit): no layout change. Full SEC suite: security part not run.

## Delta vs previous report

Previous: docs/architecture/qa/2026-10-30-mock-site (probe-final.mjs showed the header click navigating under the default root): that defect is fixed (1a, 1b, 3).
