# QA pass — pointing mode on a realistic mock site, PR #133 (2026-10-30)

| Level                                         | Head SHA | Environment                                                                           | Targets                                      | Agent / model      | Matrix page                  |
| --------------------------------------------- | -------- | ------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------ | ---------------------------- |
| pass (product part, targeted: target picking) | d63a14d  | local, `http://127.0.0.1:4173` (mock site + stub `/ingest`; nothing reached a Worker) | W (widget bundle 0.6.0, built from the head) | qa-tester · Sonnet | not published (orchestrator) |

Allowed host: `127.0.0.1` only. Tool: headless Chromium (Playwright 1.59 library, scripted) at 1440x900 and 375x812, plus
the Playwright MCP for the first probe. The mock site and probe scripts are kept in
`docs/architecture/qa/2026-10-30-mock-site/site/` (`index.html`, `page2.html`, `server.mjs`, `probe-final.mjs`); the first
session's mock page was lost with the scratchpad and **rebuilt in a leaner form with the same element ids**. The bulk
matrices (about 50 elements x 3 roots x 2 viewports) come from the first, fuller page; every defect below was re-run on the
rebuilt page. Screenshots: `docs/architecture/qa/2026-10-30-mock-site/` (gitleaks clean; the `SECRET-`/`PREFILLED-` strings
are fake test values).

The mock page: fixed header (logo, nav links, click dropdown, language button, search input, CTA), hero with `h1`, nested
`section > section > article` with `h2 > h3 > h4`, card grid (image, title, text, link or button), accordion (`details`),
tabs, a form (text, email, select, empty textarea, textarea with server-rendered text, input with a `value`, a
`contenteditable` rich field, checkbox, submit), `aside`, footer with links, and a section whose heading sits inside a
`<header>` wrapper. Page-level spies log every action to `window.__events` (CTA click, add to cart, dropdown toggle,
`pointerup`/`mouseup` on the language button, a `window`-capture click listener) and links lead to `/page2.html`.

Three mounts were tested (`?root=`): **default** (no `rootSelector`, so `main`), **page** (`rootSelector: '#page'`, which
excludes the header and the hero) and **body** (`rootSelector: 'body'`).

## Plan

In: FON (pointing journey), UI (375 px and 1440 px), PRI-01 (target privacy, asked by the caller), ROB (page actions
neutralised), A11Y keyboard path of pointing. Out: DAT, PERF, MOB, SEC-01..03/05..10 (security part not run), cross-engine.

## QA matrix

Gate ❌ · 🔴 Must 2 · 🟡 Should 2 · 🔵 Nice 4 — 12 checks: Pass 5 · Fail 4 · Mixed 3

| ID      | Domain | Check                                                                                                                                                    | Result         | Verdict    | Evidence                                                                                                                                                                                              | Issues | Shots                                                          |
| ------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------- |
| PTR-01  | FON    | Content in `main` is pickable and highlighted (every heading level, nested sections, lists, quote, cards, accordion, tabs, form fields, wrapped content) | Pass           | PASS       | 100 % of the in-root elements picked (table below), hover background `rgba(200,16,46,.08)` and pointer cursor observed on each                                                                        |        | d0-*-hover                                                     |
| PTR-02  | FON    | Header, hero, aside, footer pickable with the **default** root                                                                                           | Fail           | FAIL       | none pickable; links navigate, buttons act                                                                                                                                                            | F1     | final-d-default-y2200-header-hover                             |
| PTR-03  | FON    | A click in pointing mode never navigates nor triggers the page action                                                                                    | Mixed          | FAIL       | inside the root: OK for click, mouse and pointer down, Enter key; outside the root: page navigates (`/page2.html`), CTA, hero CTA and dropdown toggle run                                             | F1     | final-d-default-navigated, final-d-default-cta-action          |
| PTR-04  | FON    | `rootSelector: 'body'` makes the fixed header pickable at any scroll                                                                                     | Pass           | PASS       | scrollY 0 and 2200: logo, nav link, dropdown toggle and item, language button, search, CTA, header bar all picked; no navigation                                                                      |        | final-d-body-y2200-header-hover, final-d-body-y2200-cta-picked |
| PTR-05  | FON    | Other activating events (`pointerup`, `mouseup`, `touchend`, a `window` capture listener) are silent                                                     | Fail           | FAIL       | `pointerup` and `mouseup` reach a page handler on a picked button; a `window`-capture click handler also sees the click                                                                               | F3     |                                                                |
| PTR-06  | FON    | Descriptor correctness (tag, label, selector, headingText, excerpt)                                                                                      | Mixed          | FAIL       | correct for text, headings, list items, cards, links, buttons; heading missing when the heading is wrapped in a `<header>`; weak labels for select/checkbox                                           | F4, F5 |                                                                |
| PTR-07  | FON    | Auto-detected target at 8 scroll positions, desktop and 375 px, default and body root                                                                    | Mixed          | PASS       | always a block in the middle band of the screen; headingText is the section heading in every case that has one; no target proposed over the form area (UI handles it: "Aucun passage précis détecté") |        | `*-auto-y*` (32 files)                                         |
| PRI-01  | PRI    | A form field's typed value never appears in the descriptor                                                                                               | Mixed          | FAIL       | typed `input` and `textarea` values: not leaked; server-rendered textarea text, `contenteditable` text, and a picked form/section container: leaked into `label`, `excerpt` and the POST              | F2     | d-default-auto-y2379                                           |
| UI-01   | UI     | 375 px: pointing bar, burger menu, nothing unreachable                                                                                                   | Mixed          | PASS       | bar 188x102 px at the bottom centre; header items reachable after opening the burger; elements under the bar need a scroll                                                                            | F6     | final-m-default-pointing-bar, final-m-body-dd-item-picked      |
| UI-02   | UI     | Console after every journey                                                                                                                              | Pass           | PASS       | 0 errors, 0 warnings in all runs                                                                                                                                                                      |        |                                                                |
| A11Y-01 | A11Y   | Keyboard: Enter on a focused link while pointing                                                                                                         | Mixed          | PASS       | body root: picked, no navigation; default root (header): navigates                                                                                                                                    | F1     |                                                                |
| SEC-04  | SEC    | XSS                                                                                                                                                      | Not tested/N/A | NOT TESTED | covered in the earlier PR #133 report; security part not run here                                                                                                                                     |        |                                                                |

## Element table (desktop 1440, mobile 375 gives the same results unless noted)

`P` = pickable. Headings are what `headingText` returned; `—` = null. "default" = `main` root. "body" = `rootSelector: 'body'`.
Page action = the page's own handler ran; NAV = the browser left the page.

| Element                                       | default root                                             | body root                                        | Descriptor (tag · label · selector · headingText)                                                                                   | OK?           |
| --------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Logo (fixed header)                           | not P, **NAV**                                           | P                                                | a · "Atelier Lumen" · `#logo` · —                                                                                                   | body only     |
| Nav link                                      | not P, **NAV**                                           | P                                                | a · "Produits" · `#nav-products` · —                                                                                                | body only     |
| Dropdown toggle                               | not P, **page action**                                   | P                                                | button · "Ressources ▾" · `#dd-toggle` · —                                                                                          | body only     |
| Dropdown item (menu open)                     | not P, **NAV**                                           | P                                                | a · "Documentation" · `#dd-docs` · —                                                                                                | body only     |
| Language button                               | not P, **page action** (pointerdown, pointerup, mouseup) | P, but `pointerup` still reaches the page        | button · "Langue" · `#lang` · —                                                                                                     | F3            |
| Search input                                  | not P                                                    | P                                                | input · "Rechercher sur le site" · `#site-search` · —, excerpt empty                                                                | body only     |
| CTA                                           | not P, **page action**                                   | P (a `window`-capture click handler still fires) | button · "Essai gratuit" · `#cta` · —                                                                                               | body only, F3 |
| Fixed header, scrolled to 2200                | not P (same as above)                                    | P, highlighted                                   | same descriptors                                                                                                                    | body only     |
| Hero `h1`, hero background, hero CTA          | not P, hero CTA **page action**                          | P                                                | h1 · "Des lampes…" · `#hero > h1` · —; hero CTA headingText "Des lampes…"                                                           | body only     |
| `h2` Collections                              | P                                                        | P                                                | h2 · `#collections > h2` · — (no heading in the root above it)                                                                      | yes           |
| `h3` Salon                                    | P                                                        | P                                                | h3 · `#salon > h3` · "Collections"                                                                                                  | yes           |
| `h4` in nested article                        | P                                                        | P                                                | h4 · `#suspensions > h4` · "Salon"                                                                                                  | yes           |
| `p` under the `h4`                            | P                                                        | P                                                | p · `#suspensions > p:nth-of-type(1)` · "Suspensions en verre soufflé"                                                              | yes           |
| `li`                                          | P                                                        | P                                                | li · `#li-hauteur` · "Lampadaires en chêne"                                                                                         | yes           |
| `blockquote`                                  | P                                                        | P                                                | blockquote · `#quote` · "Lampes d'architecte"                                                                                       | yes           |
| Nested `section` (click on its padding)       | P                                                        | P                                                | section · `#bureau` · "Collections"                                                                                                 | yes           |
| Whole card (click on the body padding)        | P                                                        | P                                                | div · `#card-1 > div` · "Produits vedettes"; the `article.card` itself is never the target (image and body cover it)                | acceptable    |
| Element inside a card: image / title / text   | P                                                        | P                                                | img "Suspension Aube" · `#card-1 > img`; h3 · `#card-1 > div > h3`; p · "Suspension Aube"                                           | yes           |
| Card link / card button                       | P, **no NAV, no action**                                 | P                                                | a · `#card-1-link` · "Suspension Aube"; button · `#card-2-btn` · "Applique Dune"                                                    | yes           |
| Accordion summary                             | P, no toggle                                             | P                                                | summary · `#faq-1-sum` · "Questions fréquentes"                                                                                     | yes           |
| Accordion content (open)                      | P                                                        | P                                                | p · `#faq-1-p` · "Questions fréquentes"                                                                                             | yes           |
| Accordion content (closed)                    | not clickable (hidden)                                   | same                                             | n/a                                                                                                                                 | n/a           |
| Tab / tab panel text                          | P, tab not switched                                      | P                                                | button · `#tab-bois` · "Entretien"; p · `#panel-verre-p` · "Entretien"                                                              | yes           |
| Form: name, email, empty textarea             | P, no focus, no submit                                   | P                                                | input · placeholder as label ("Votre nom") · `#f-name` · "Nous écrire", excerpt empty; typed value absent                           | yes (F5)      |
| Form: select                                  | P                                                        | P                                                | select · label "CommandeLivraisonAutre" (all options glued) · `#f-topic`                                                            | F5            |
| Form: checkbox, label text, submit            | P, not toggled/submitted                                 | P                                                | input · label null · `#f-agree`; label · "Nom"; button · "Envoyer"                                                                  | F5            |
| Form: input with a `value` attribute          | P                                                        | P                                                | input · label null · `#f-pre`; value not read                                                                                       | yes           |
| Form: textarea with server-rendered text      | P                                                        | P                                                | **textarea · label and excerpt = the text**                                                                                         | **F2**        |
| Form: `contenteditable` rich field            | P                                                        | P                                                | **div · label and excerpt = the typed text**                                                                                        | **F2**        |
| Whole form (container, click on its padding)  | P                                                        | P                                                | **form · label and excerpt contain the textarea text, select options and the rich-field text** (typed input values still absent)    | **F2**        |
| Content after a heading wrapped in `<header>` | P                                                        | P                                                | p · `#news-p` · headingText **null** (expected "Actualités de l'atelier"); the next sibling `p#news-lead` inside the header gets it | F4            |
| Aside (title, text, link, padding)            | not P, link **NAV**                                      | P                                                | h2 · `#side > h2`; p · "Atelier ouvert"; a · `#aside-link` · "Newsletter"; aside · label "Infos"                                    | default no    |
| Footer (links, headings, copyright)           | not P, links **NAV**                                     | P                                                | a · `#ft-1` · "Boutique"; h2 · `#site-footer > div > div:nth-of-type(1) > h2`; p · `#ft-copy`                                       | default no    |

`rootSelector: '#page'` behaves like default for header and hero (not pickable, NAV or page action) and like body for the
aside; the footer is outside `#page` in the mock, so footer links navigate in that mount too.

## Auto-detected target (test 2)

Default and body roots give the same blocks except at the very bottom. Desktop 1440x900 / mobile 375x812:

| scrollY                                  | Proposed block                                                                                         | headingText                                                                                    | Verdict                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 0                                        | `h2` "Collections"                                                                                     | none                                                                                           | OK (the `h1` is outside `main`)                                         |
| 500 (desk)                               | p "Une lumière précise…"                                                                               | "Bureau"                                                                                       | OK                                                                      |
| 1000 (desk)                              | p "Verre opale…"                                                                                       | "Suspension Aube" (card `h3`)                                                                  | OK                                                                      |
| 1500 (desk)                              | `h2` "Questions fréquentes"                                                                            | none                                                                                           | OK; document-order "nearest heading" would have been a wrong card title |
| 2000 (desk)                              | `h2` "Nous écrire"                                                                                     | none                                                                                           | OK                                                                      |
| bottom (desk)                            | default root: **nothing proposed**; body root: p "Un e-mail par mois"                                  | "Newsletter"                                                                                   | OK, see below                                                           |
| 500 / 1000 / 1500 / 2000 / 2600 (mobile) | h4 "Lampadaires en chêne" / blockquote / h3 "Applique Dune" / p "Céramique émaillée…" / h3 "Entretien" | "Salon" / "Lampes d'architecte" / "Produits vedettes" / "Lampe Brume" / "Questions fréquentes" | OK                                                                      |
| 3200 (mobile, form area)                 | nothing proposed (both roots)                                                                          |                                                                                                | OK                                                                      |

Only `p, li, h1-h6, blockquote, figure, table, pre` are auto-proposed, so over a form, a card grid made of divs or a footer the
widget proposes nothing ("Aucun passage précis détecté — tu peux quand même continuer"); the screen
(`d-default-auto-y2379.png`) is readable and leads to "Choisir un autre". Acceptable, not a defect.

## Findings to act on

1. 🔴 Must — **F1, PTR-02/PTR-03: with the default root (`main`), pointing mode does not cover the fixed header, hero, aside or footer, and does not neutralise them.**
   Seen: in pointing mode a click on a header link or footer link leaves the page (`/page2.html`; the open widget and the draft
   are gone), a click on the CTA, the hero CTA or the dropdown toggle runs the page's own action, and none of them is highlighted.
   Expected (owner): selecting must never navigate or trigger the action; the header should be pickable.
   Repro: mount with no `rootSelector`, scroll to 2200, open the widget, "Choisir un autre", click `#nav-products`
   (`final-d-default-navigated.png`). The same happens with `rootSelector: '#page'` and with Enter on a focused header link.
   Cause: `if (!root.contains(raw)) return` in `IntersectionViewportDetector.ts` lets outside clicks pass through, and the
   `fw-pointing` class is only on the root. Fix (two parts): swallow activations everywhere (except the widget), pick only
   inside the root, and document that the header needs `rootSelector: 'body'` (or make `body` the default):

   ```diff
   --- a/packages/web/src/adapters/IntersectionViewportDetector.ts
   +++ b/packages/web/src/adapters/IntersectionViewportDetector.ts
   @@ pointingHandler = (ev: Event) => {
          const raw = ev.target as Element | null
          if (!raw) return
          const root = getRoot()
          if (raw.closest(WIDGET_HOST_TAG)) return
   -      if (!root.contains(raw)) return
          ev.preventDefault()
          ev.stopImmediatePropagation()
          if (ev.type !== 'click') return
   +      if (!root.contains(raw)) return // swallowed, but outside the chosen root: not pickable
   ```

   Product decision to record (MCDA): default root `main` (current: header unreachable, with the fix: safe but not pickable)
   versus `body` (everything pickable; noisier, includes cookie banners). Either way the fix above is needed.

2. 🔴 Must (PRI-01 is P0) — **F2: the descriptor leaks text that sits in form fields.**
   Seen: a `<textarea>` with server-rendered content (React and Vue controlled textareas render their initial state this way),
   a `contenteditable` rich editor with typed text, and any container (form, section, card) that holds them put that text in
   `label`, `excerpt`, the "Choisir" preview and the POST body (`target.label: "PREFILLED-SECRET-NOTES"`,
   `"SECRET-RICH-TYPED-TEXT"`, and the form's own `label`/`excerpt` with both). Typed `input` and `textarea` values and
   `input value=` attributes are not leaked. This breaks the contract written in `Feedback.ts` ("never carries a form
   field's entered value"). Fix: read text from a clone stripped of field content:

   ```diff
   --- a/packages/web/src/adapters/IntersectionViewportDetector.ts
   +++ b/packages/web/src/adapters/IntersectionViewportDetector.ts
   +const FIELD_CONTENT =
   +  'textarea, select, input, [contenteditable=""], [contenteditable="true"], [role="textbox"], [role="combobox"]'
   +
   +// Visible text without the content of form fields (typed or prefilled).
   +function safeText(element: Element): string {
   +  if (element.matches(FIELD_CONTENT) || element.closest(FIELD_CONTENT)) return ''
   +  const clone = element.cloneNode(true) as Element
   +  clone.querySelectorAll(FIELD_CONTENT).forEach((n) => n.remove())
   +  return clone.textContent ?? ''
   +}
   @@ const elementToTarget
   -    const text = element.textContent ?? ''
   +    const text = safeText(element)
   @@ function accessibleLabel
   -    element.textContent,
   +    safeText(element),
   ```

   Add a unit test for each of: prefilled textarea, contenteditable, a form container, and a `<select>`.

3. 🟡 Should — **F3 (PTR-05): other activation events still reach the page.** `POINTING_EVENTS` is `pointerdown, mousedown, click` on
   `document`. `pointerup`, `mouseup` (and `touchstart`/`touchend` on phones, `submit`, `keydown` Enter) are not stopped, and a
   `window`-capture listener runs before the widget's `document` listener. Seen: a `pointerup` handler on a picked button
   fired; a page analytics handler on `window` saw the picked CTA click. Fix: add the missing events and register on `win`:

   ```diff
   -const POINTING_EVENTS = ['pointerdown', 'mousedown', 'click'] as const
   +const POINTING_EVENTS = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'click', 'auxclick', 'dblclick', 'contextmenu'] as const
   @@ enablePointingMode / disablePointingMode
   -      doc.addEventListener(type, handler, { capture: true }),
   +      win.addEventListener(type, handler, { capture: true }),
   ```

   (keep `if (ev.type !== 'click') return` for the pick; `touchstart`/`touchend` must be registered with `{ capture: true, passive: false }` to allow `preventDefault`). Window-level order against other `window` capture listeners registered earlier cannot be guaranteed; say so in the docs.

4. 🟡 Should — **F4 (PTR-06): `headingText` is missed when the heading is wrapped** (`<header><h2>…</h2><p>…</p></header><div><p>`). `findParentHeading`
   only looks at previous siblings that are themselves `H1-H6`, so `p#news-p` gets `null`. Expected "Actualités de l'atelier". Real sites wrap headings in
   `header`, `div.section-head`, or `hgroup` constantly. Fix: at each level, also accept a previous sibling that _contains_ a heading
   (last heading inside it, `previous.querySelector(':scope > h1, … , :scope > * > h1 …')` or `previous.matches('header, hgroup') ? previous.querySelector('h1,h2,h3,h4,h5,h6')`),
   or fall back to document order bounded by the root.

5. 🔵 Nice — **F5: weak labels for form controls.** `select` label is every option glued (`CommandeLivraisonAutre`), a checkbox
   inside `<label>` gets `null`, a text input gets its placeholder ("Votre nom") instead of its `<label>` ("Nom"). Use
   `(element as HTMLInputElement).labels?.[0]` text (field content stripped, see F2) before `placeholder`, and skip option text for `select`.

6. 🔵 Nice — **F6 (UI-01): at 375 px the pointing bar (188x102 px) covers the bottom 13 % of the screen** (`final-m-default-pointing-bar.png`);
   elements under it cannot be picked until the user scrolls (clicks on the bar are ignored by design). Add `pointer-events: none` outside the
   button, or dock the bar at the top, or narrow the text.

7. 🔵 Nice — **F7: "nearest heading" is "previous sibling heading, nearest ancestor first".** For a top `h2` it returns `null` even
   when an `h1` precedes it outside the root (hero). Fine, but the report's wording "nearest heading" overstates it; document it in `Feedback.ts`.

8. 🔵 Nice — **F8: a card is never picked as a whole.** Its image and body fill the article, so the target is the inner `div`
   (`#card-1 > div`, label "Suspension AubeVerre opale…" with the words glued). Consider `closest('article, [role=article], li')` when the click lands on a
   non-semantic wrapper, and join text with spaces.

Not filed: the coordinator asked for no GitHub issue and no commit. Security findings: none in this pass; F2 is a privacy finding on a private repo (file as a normal issue when allowed).

## Not tested

SEC-01..03, 05..10 (security part not run); Firefox and WebKit; real touch events on a phone (mouse emulation only, so F3 touch part is read
from the code, not observed); screen-reader behaviour of the pointing bar; scrollbars inside nested scroll containers; `iframe` content;
shadow-DOM host pages (a page whose own components use shadow roots would retarget `ev.target` to the host).

## Delta vs previous report

Previous: `docs/architecture/qa/2026-10-30-taxonomy-flow-pr133.md` (taxonomy flow). All findings here are new (pointing mode was not in its scope);
F1 and F2 pre-date PR #133 (`git diff main...HEAD` does not touch `IntersectionViewportDetector.ts`; to confirm before triage).

The first mock server (PID 3967834) was lost with the earlier session; the second (PID 72801) was stopped, port 4173 is free.
