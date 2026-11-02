# QA pass — form field content kept out of the target descriptor, #136 (2026-11-02)

Re-run of PRI-01 from the 2026-10-30 mock-site report on the head of `fix/136-strip-form-fields-from-target`, plus a regression check of pointing mode and the security probes.

| Level                                   | Head SHA | Environment                                                                                  | Targets                              | Agent / model                                | Matrix page                  |
| --------------------------------------- | -------- | -------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------- | ---------------------------- |
| pass (product part, then security part) | ad33f1b  | local, mock page on `http://127.0.0.1:4173` with a stub `/ingest` (nothing reached a Worker) | W (bundle 0.7.0 built from the head) | qa-tester · Opus 5.5 (both parts in one run) | not published (orchestrator) |

Allowed host: `127.0.0.1` only. Tool: headless Chromium (playwright-core, scripted), 1280x800 and 390x844. The bundle was built
with `pnpm --filter @benoit-bremaud/feedback-widget build:bundle` (47.2 kB, contains the new `FIELD_CONTENT` selector). The mock
page, the stub server and the probe are kept in `docs/architecture/qa/2026-11-02-target-field-privacy/site/`
(`index.html`, `server.mjs`, `probe.mjs`; run `node site/probe.mjs <bundle> <shot dir>`, the probe starts and stops the server
itself). Deviation: no `.claude/launch.json` entry exists and the agent does not edit config, so the server runs as a child
of the probe instead of `preview_start`; it exited with the probe, port 4173 is free.

The `*-SECRET` strings are fake test values. They are visible in the screenshots because they sit in the mock host page's
own fields; the check is that they never reach the widget preview or the POST body.

The mock page (default mount, so `rootSelector` falls back to `body` since #135): sticky header (logo, nav link, CTA), an
intro section (`h2`, `p`, link, button, a `contenteditable="false"` paragraph, a paragraph whose text is an XSS payload),
a form with `input value="VALUE-SECRET"`, an input typed with `TYPED-SECRET`, a textarea server-rendered with
`PREFILLED-SECRET` then typed with `TYPED-TA-SECRET`, a `select` (`OPT-SECRET-A/B`), a `contenteditable="true"` div with a
nested `p` and `b` (`RICH-SECRET`, `RICH-DEEP-SECRET`), `contenteditable=""`, `contenteditable="plaintext-only"`,
`role="textbox"`, `role="combobox"`; a section with an editable `h2` (`HEADING-SECRET`) and a mixed `h2` (text + editable
`span` + `input`); a card holding a textarea; a 12 000-character paragraph; a footer link.

## Plan

In: PRI-01 (the diff), FON pointing regression (PTR-01, PTR-03, PTR-04, PTR-06), auto-detected target over a form, outbox
storage on a failing endpoint, UI-01 at 390 px, UI-02 console, inspector (console, network, storage), SEC-01…SEC-10.
Out: DAT and PERF (no API or rendering-cost change), MOB (web widget), A11Y (no UI change), cross-engine (no CSS change),
F3/F4/F6–F8 of the previous report (other issues, not touched by this diff).

## QA matrix

Gate ✅ · 🔴 Must 0 · 🟡 Should 1 · 🔵 Nice 3 — 20 checks: Pass 14 · Fail 0 · Mixed 2 · Not tested/N/A 4

| ID      | Domain | Check                                                                        | Result         | Verdict    | Evidence                                                                                                                                                                                               | Issues     | Shots     |
| ------- | ------ | ---------------------------------------------------------------------------- | -------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | --------- |
| PRI-01  | PRI    | No form field content in the descriptor, the preview or the POST body        | Pass           | PASS       | 19 picks on fields, containers and headings: 0 `SECRET` in the preview text, 0 in the POST body (table below); `JSON.parse` of every captured `/ingest` body checked with `/SECRET/`                   |            | 01–06, 12 |
| PRI-01b | PRI    | Auto-detected target over a rich-text field                                  | Mixed          | PASS       | no leak (`label: null`, `excerpt: ""`), but the widget proposes an empty quote `« »`                                                                                                                   | N1         | 10        |
| PRI-01c | PRI    | Outbox on a failing endpoint keeps no field content                          | Pass           | PASS       | 3 × 500 from `/ingest-fail`, payload queued under `feedback-widget.outbox.qa-field-privacy` with its `target`; `/SECRET/` absent from every `localStorage` value and from the 3 bodies                 |            | 11        |
| PTR-01  | FON    | Normal elements still picked with a correct descriptor (p, h2, button, link) | Pass           | PASS       | `#p1` label/excerpt = text, heading "Introduction"; `#h-intro`; `#btn1` "Ajouter au panier"; `#link1` "Voir le catalogue"                                                                              |            | 08        |
| PTR-03  | FON    | No navigation, no page action while picking                                  | Pass           | PASS       | URL unchanged and `window.__events` empty after all 29 picks (CTA, button, links, submit button area)                                                                                                  |            |           |
| PTR-04  | FON    | Header and footer pickable with the default (body) root (#135)               | Pass           | PASS       | `#nav` "Produits", `#cta` "Essai gratuit", `#ft` "Mentions", no navigation                                                                                                                             |            | 07        |
| PTR-06  | FON    | Descriptor quality on non-field text next to fields                          | Mixed          | PASS       | `contenteditable="false"` text kept; heading context strips the editable part (`Titre mixte`) and is `null` for a fully editable heading; container labels keep raw newlines; picked fields show `« »` | N2, N3, F5 | 05, 06    |
| UI-01   | UI     | Preview at 390 px                                                            | Pass           | PASS       | form preview readable, `scrollWidth` 390 (no horizontal scroll)                                                                                                                                        |            | 12        |
| UI-02   | UI     | Console after every journey                                                  | Pass           | PASS       | 0 errors and 0 warnings on all success runs; the only 3 errors are the browser's own "Failed to load resource: 500" lines for the deliberate `/ingest-fail` stub                                       |            |           |
| INS-NET | UI     | Network: hosts and statuses                                                  | Pass           | PASS       | only `127.0.0.1:4173`; one POST per submit; 4xx/5xx only on the deliberate stub                                                                                                                        |            |           |
| SEC-01  | SEC    | Security headers                                                             | Not tested/N/A | N/A        | the widget is a library; headers belong to the host page and to the Worker (separate repo)                                                                                                             |            |           |
| SEC-02  | SEC    | Cookies                                                                      | Pass           | PASS       | `document.cookie` empty after a full send; the widget sets no cookie                                                                                                                                   |            |           |
| SEC-03  | SEC    | Origin / CORS                                                                | Not tested/N/A | N/A        | enforced by `feedback-pipeline-worker`, not run here; the mock stub is not the product                                                                                                                 |            |           |
| SEC-04  | SEC    | XSS through the descriptor                                                   | Pass           | PASS       | a paragraph whose text is `<img src=x onerror=…>` and `"><svg onload=…>` is shown as literal text in the preview; `window.__xss` stays `null`                                                          |            | 09        |
| SEC-05  | SEC    | Authn / authz                                                                | Not tested/N/A | N/A        | no session or protected route in the widget                                                                                                                                                            |            |           |
| SEC-06  | SEC    | Input limits on the descriptor                                               | Pass           | PASS       | 12 000-character paragraph: `label` cut at 120 characters with `…`, `excerpt` bounded                                                                                                                  |            |           |
| SEC-07  | SEC    | Rate limits                                                                  | Not tested/N/A | NOT TESTED | not touched by the diff; the mock raises `rateLimitMaxAttempts` to 100 to run 32 sends                                                                                                                 |            |           |
| SEC-08  | SEC    | Error leaks                                                                  | Pass           | PASS       | 500 from the endpoint gives the generic "service momentanément indisponible … mis en file d'attente", no stack or path                                                                                 |            | 11        |
| SEC-09  | SEC    | Bundle                                                                       | Pass           | PASS       | `dist-bundle/` has no `.map`; no URL literal, no key or token pattern (`grep -E` for `sk_/pk_`, `AKIA`, `ghp_`, `api_key`, `password`, `Bearer`)                                                       |            |           |
| SEC-10  | SEC    | Third parties                                                                | Pass           | PASS       | network list holds only `127.0.0.1:4173`                                                                                                                                                               |            |           |

## Pick table (pointing mode, 1280x800)

Every pick was checked with `document.elementFromPoint` to hit the intended element (29/29 hit). `—` = `null`.

| Picked                                                                                                  | label                                                          | headingText             | excerpt                                         | Preview                               | SECRET? |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------- | ----------------------------------------------- | ------------------------------------- | ------- |
| `#ta` prefilled then typed textarea                                                                     | "Vos notes" (placeholder)                                      | Nous écrire             | ""                                              | § Nous écrire « Vos notes »           | no      |
| `#ce` contenteditable div                                                                               | —                                                              | Nous écrire             | ""                                              | « »                                   | no      |
| `#ce-inner` `p` inside it, `#ce-deep` `b` inside that                                                   | —                                                              | Nous écrire             | ""                                              | « »                                   | no      |
| `#ce-empty-attr`, `#ce-pt` (plaintext-only)                                                             | —                                                              | Nous écrire             | ""                                              | « »                                   | no      |
| `#sel` select                                                                                           | —                                                              | Nous écrire             | ""                                              | « »                                   | no      |
| `#rt` role=textbox, `#cb` role=combobox                                                                 | —                                                              | Nous écrire             | ""                                              | « »                                   | no      |
| `#inp` input with `value`                                                                               | —                                                              | Nous écrire             | ""                                              | « »                                   | no      |
| `#typed` typed input                                                                                    | "Votre nom"                                                    | Nous écrire             | ""                                              | « Votre nom »                         | no      |
| `#f` whole form                                                                                         | "Référence Nom Notes Sujet … Envoyer" (raw newlines)           | Nous écrire             | "Référence Nom Notes Sujet Envoyer"             | « Référence Nom Notes Sujet Envoyer » | no      |
| `#contact` section                                                                                      | "Nous écrire … Envoyer"                                        | —                       | "Nous écrire Référence Nom Notes Sujet Envoyer" | same                                  | no      |
| `#card-box` / `#card` (container with a textarea)                                                       | "Texte de la carte." / "Carte avec champ … Texte de la carte." | Carte avec champ / —    | idem                                            | idem                                  | no      |
| `#h-ce` editable heading                                                                                | —                                                              | —                       | ""                                              | « »                                   | no      |
| `#after-ce` p after it                                                                                  | "Paragraphe après un titre éditable."                          | —                       | idem                                            | idem                                  | no      |
| `#h-mixed` heading with editable span + input                                                           | "Titre mixte"                                                  | —                       | "Titre mixte"                                   | « Titre mixte »                       | no      |
| `#after-mixed`                                                                                          | "Paragraphe après un titre mixte."                             | Titre mixte             | idem                                            | § Titre mixte « … »                   | no      |
| Regression: `#p1`, `#h-intro`, `#btn1`, `#link1`, `#nav`, `#cta`, `#ft`, `#ce-false`, `#xss`, `#long-p` | own text                                                       | Introduction / — / Long | own text                                        | own text                              | no      |

## Findings to act on

1. 🟡 Should — **N1: auto-detection proposes a paragraph inside a rich-text field and shows an empty quote** (PRI-01b).
   Seen: with `#ce-inner` (a `p` inside `contenteditable`) in the middle band, opening the widget shows "C'est bien ce
   passage ?" with `§ NOUS ÉCRIRE` and `« »` (`10-auto-target-over-form.png`). No leak, but the user is asked to confirm an
   empty passage; on a page whose main area is a rich-text editor (comment form, CMS) this is the first screen they see.
   Expected: a candidate inside a field is skipped, so the next block or the "Aucun passage précis détecté" state is shown.
   Suggested fix (not applied): filter the auto candidates at `IntersectionViewportDetector.ts:154`,
   `Array.from(root.querySelectorAll(targetSelectors)).filter((el) => !el.closest(FIELD_CONTENT))`.
2. 🔵 Nice — **N2: a picked field gives an empty preview `« »`** (`#ce`, `#sel`, `#inp`, `#rt`, `#cb`, `#h-ce`;
   `03-select-preview.png`). Correct for privacy, but the user cannot tell what was picked. Fall back to the field's
   `<label>` text (`(el as HTMLInputElement).labels?.[0]`, field content stripped) or a generic "champ de formulaire" message
   in `renderTargetConfirmStep`. Same root as F5 below.
3. 🔵 Nice — **N3: container labels are not whitespace-normalised** (`#f` label `"Référence\n      Nom\n …"`, `#card`).
   The excerpt is normalised, the label is only trimmed, so removed fields leave runs of newlines in the payload. Pre-existing
   (`truncate` trims only), more visible now. `value.replace(/\s+/g, ' ')` in `accessibleLabel`.
4. 🔵 Nice — **F5 (carried over from 2026-10-30): form controls use the placeholder, not their `<label>`**; an input with a
   value and no placeholder gets `null`. Improved by this diff: the `select` no longer glues its options.

Not filed: the caller asked for no GitHub issue and no commit. No security finding.

## Not tested

SEC-07 (not in the diff; covered by unit tests). SEC-01/03/05 N/A for a client library (see matrix). `document.designMode =
"on"` pages (the whole document is editable without a `contenteditable` attribute, so `FIELD_CONTENT` would not match):
not probed. Fields inside an open shadow root of the host page (`textContent` does not read shadow content, so no leak
expected): not probed. Firefox and WebKit. Real touch events.

## Delta vs previous report

`docs/architecture/qa/2026-10-30-mock-site-pointing.md`: F2 / PRI-01 **fixed** (prefilled textarea, contenteditable, select
options and container text no longer leak); F1 fixed earlier by #135 (header picked, no navigation, confirmed here); F5
partly improved; F3, F4, F6, F7, F8 not re-run (out of this diff). New: N1 (Should), N2, N3 (Nice).
