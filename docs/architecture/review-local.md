# Local review — feedback-widget (branch diff main...HEAD)

- Date: 2026-09-15
- Commit: 8513853
- Scope: `git diff main...HEAD` — 14 files, breaking rework of the feedback category taxonomy
- Checks run: design · docs · tests · security · correctness
- Verdict: fix Must Have first · Must 8 · Should 9 · Nice 7

No XSS, injection, or secret exposure was found. Every Must below is either a
_reach_ problem (the rework did not travel to all the places that mirror the
taxonomy) or a _depth_ problem (the new invariants are enforced but untested).

## 🔴 Must Have

- `packages/core/src/config/WidgetConfig.ts:162` `[security|correctness]` ·
  `resolveConfig` validates that `categories` is non-empty but never checks its
  entries against the enum, and `isValidCategory` is exported yet used nowhere in
  production code. A host still embedding `categories: ['typo','error','other']`
  — the exact situation this breaking rename creates — now renders a category
  step with **zero buttons and no console warning**: `renderTypeStep` drops every
  unknown name at `packages/web/src/adapters/WebComponentView.ts:277`. Silent
  dead-end UI (OWASP ERR-1, fail-silent). Fix:

  ```ts
  const requested = input.categories?.filter(isValidCategory) ?? []
  categories: requested.length > 0 ? requested : null,
  ```

  This also makes the `if (!icon) return ''` guards statically dead (see Nice).

- `.github/design/projects-yaml-schema.md:66-111,135-184,245-287`
  `[docs|correctness]` · This file **self-declares as the canonical enum** ("the
  pipeline doc, widget doc, and labels on every consumer repo stay in lockstep
  with this list") and still documents the entire dead taxonomy — the six-category
  table, the old label maps, and a JSON-Schema pattern
  `^(bug|typo|error|ambiguous|suggestion|other)$`. It is the document a Worker
  integrator would follow _during the lockstep migration this change demands_.
  Worse, the commit deleted `Feedback.ts`'s back-reference to it, orphaning it.
  Update the table, the example, and the JSON Schema pattern.

- `.github/design/n8n-pipeline.md:113-114` `[docs]` · The payload contract comment
  still enumerates the removed values and the removed null rule
  (`subCategory: string | null // null only when category === "other"`).

- `packages/core/src/use-cases/BuildFeedbackPayload.ts:83` `[correctness|security|tests]`
  · Raised independently by three dimensions. The normalization computed at `:48`
  (`const target = input.target ?? null`) is used on the `praise` return at `:60`
  but **not** on the main return, which passes `input.target` raw. A caller
  omitting `target` produces `target: undefined`, which `as FeedbackPayload`
  silently blesses against a `FeedbackTarget | null` contract — and `undefined`
  vanishes in `JSON.stringify`, so the backend receives a payload with **no
  `target` key at all** on the majority path. The existing test only asserts this
  contract on the `praise` branch, i.e. the one branch that is correct. Fix:
  `target,` on `:83`.

- `packages/core/src/use-cases/BuildFeedbackPayload.test.ts` `[tests]` · Neither
  `throw` guard is tested — `grep "toThrow"` returns nothing. Those two guards
  (`BuildFeedbackPayload.ts:50-55` praise-carries-no-sub-category, `:66-73`
  cross-category pairing) are the rework's headline invariant and the **only**
  runtime enforcement of it, since the discriminated union is erased at runtime.
  Add: rejects a sub-category under `praise`; rejects `bug`/`typo` (a valid
  sub-category of the wrong parent); rejects a null sub-category on a category
  that requires one.

- `packages/core/src/use-cases/BuildFeedbackPayload.test.ts:59-79` `[tests]` ·
  The find-and-replace collapsed this test into a duplicate of itself: the second
  half was `error`/`http-5xx`, became `bug`/`crash`, and is now byte-identical to
  the first half — same pairing, same assertions, while the variable is still
  named `error` and the message still reads `'Got a 500 on /api/foo'`. The test's
  purpose (different pairings survive independently) is gone; it cannot fail in
  any way the first half doesn't. Re-differentiate with `content`/`dead-link`.

- `packages/web/src/adapters/WebComponentView.test.ts` `[tests]` · The new UI
  invariant is untested: no test renders `step: 'sub-category'` with
  `selectedCategory: 'praise'`, so the fallback at `WebComponentView.ts:297-301`
  is unguarded. Delete that branch and `SUB_CATEGORIES_BY_CATEGORY.praise` being
  `[]` yields an empty dead-end screen — green suite, broken prod.

- `packages/core/src/domain/Feedback.ts:116-135` `[design|security|docs]` ·
  **Release gate, not a code fix.** `feedback-pipeline-worker` duplicates these
  tables as its server-side allowlist. This change touches all 5 categories and
  all 13 sub-categories, so shipping the widget bundle first means every
  submission is rejected. Deploy the Worker tables **before** the new bundle.
  Already disclosed in `CHANGELOG.md`; repeated here as a blocking checklist item.

## 🟡 Should Have

- `packages/core/src/domain/Feedback.ts:124-136,116` `[design]` · The taxonomy is
  written twice and the two copies **can drift undetected in one direction**:
  `bug: readonly BugSubCategory[]` constrains the array to contain only valid
  members, never all of them. Drop `'too-slow'` from the table and it still
  compiles — the union keeps advertising a value the picker never renders and
  `isValidSubCategory` rejects. Fix by deriving the types from the table
  (`as const satisfies Record<string, readonly string[]>` +
  `(typeof T)['bug'][number]`), which keeps every export name and shape, removes
  more lines than it adds, and turns the next taxonomy edit into one line instead
  of the six-site hand-edit this one required. Classified Should, not Must: the
  drift is latent, and the change touches the file this whole PR is about.

- `packages/core/src/domain/Feedback.ts:144-157` `[design]` · Once the table is
  authoritative, the hard-coded `praise` literal in both predicates is derivable:
  `requiresSubCategory` becomes `SUB_CATEGORIES_BY_CATEGORY[category].length > 0`
  and the `praise` early-return in `isValidSubCategory` becomes dead weight (an
  empty array's `includes` already returns `false`).

- `packages/core/src/domain/Feedback.ts:148-155` `[security]` · For a retired
  category from an untyped caller, `SUB_CATEGORIES_BY_CATEGORY[category]` is
  `undefined` and `.includes` raises a raw `TypeError` instead of returning
  `false`. It fails closed (caught at `widget.ts:354`), so this is hygiene:
  `if (!isValidCategory(category) || category === 'praise') return false`.

- `packages/core/src/use-cases/BuildFeedbackPayload.ts:53` `[design]` · The error
  message hard-codes `"praise"`; interpolate `input.category` so a future rename
  cannot leave a stale string. Keep the literal _branch_ — replacing it with
  `requiresSubCategory()` would lose narrowing and force a cast.

- `README.md:352` `[docs]` · The API Reference documents a type named `Category`
  that **is not exported** — `packages/web/src/index.ts:7` exports
  `TopLevelCategory`. A reader following the README imports a symbol that does not
  exist. Pre-existing, but this commit rewrote the exact line.

- `packages/core/src/domain/Feedback.ts:117,126` `[docs]` · `TOP_LEVEL_CATEGORIES`
  and `SUB_CATEGORIES_BY_CATEGORY` are exported from the package index and are the
  tables the Worker must mirror, yet carry no comment while the types above them
  do. Document the two non-obvious contracts: array order **is** the on-screen
  button order (reordering is user-visible, not a refactor), and any edit is
  breaking for downstream consumers.

- `packages/core/src/domain/Feedback.ts:148` `[docs]` · `isValidSubCategory`
  returns `false` for _every_ value when the category is `praise` — callers must
  gate on `requiresSubCategory` first rather than reading `false` as "invalid
  input". Undocumented asymmetry.

- `packages/web/src/i18n.ts:71` `[docs]` · Category labels deliberately switched
  from noun-phrase taxonomy terms to first-person end-user sentences
  (`'Ça ne marche pas'`). A future contributor will "normalize" them back to
  nouns. One comment line stating the voice decision prevents that.

- Stale `other` in prose and test names `[docs|tests|correctness]` ·
  `packages/web/src/widget.ts:235,324`;
  `packages/core/src/use-cases/BuildFeedbackPayload.test.ts:81`;
  `packages/web/src/widget.test.ts:323,337,380,396,562`. The code was renamed, the
  names were not — and a test name is the spec a future reader trusts.

- `packages/web/src/adapters/WebComponentView.test.ts:239-253,305-306` `[tests]` ·
  Two assertions coupled to incidental values rather than behavior: the button
  count (hand-edited 5 → 4) should derive from
  `SUB_CATEGORIES_BY_CATEGORY.bug.length`, and the breadcrumb test asserts raw FR
  display literals — use `LOCALES.fr.categoryLabels.bug`. Both broke on this
  rework purely because a label or a count moved; both will break again on the
  next copy tweak, training exactly the blind find-and-replace that produced the
  Must findings above. (The locale-selection tests at `:437,448` legitimately
  assert literals — the string _is_ the point there. Leave them.)

## 🔵 Nice to Have

- `packages/web/src/adapters/WebComponentView.ts:278,308` `[design|correctness]` ·
  Once the config is filtered (Must #1), both `if (!icon) return ''` guards are
  statically impossible — `Record<TopLevelCategory, string>` is total — and today
  they silently swallow the case they pretend to guard. Remove **after** the
  filter lands, not before.
- `packages/web/src/adapters/WebComponentView.ts:29` `[design]` ·
  `SUB_CATEGORY_ICONS` is keyed by the flattened `SubCategory` umbrella, so the
  day two categories share a slug they collapse to one icon with no compile error.
  Not worth restructuring (no second occurrence exists) — worth one comment
  recording that sub-category slugs must stay globally unique. The new
  "never reuses the same sub-category" test already enforces it.
- `packages/core/src/domain/Feedback.test.ts:40-71` `[tests]` · Four near-identical
  "locks the canonical X sub-categories" tests → one `it.each` table, a third of
  the lines, absorbing the praise-is-empty case.
- `packages/core/src/domain/Feedback.test.ts:73-79` `[tests]` · Delete
  `exposes 13 sub-categories in total` — a magic-number sum that locks no behavior,
  catches nothing the per-category locks don't catch precisely, and guarantees a
  red test plus a manual number bump on every taxonomy edit. That churn is how
  this rework's tests got rubber-stamped.
- `packages/core/src/use-cases/BuildFeedbackPayload.test.ts:81-92` `[tests]` ·
  Delete once Must #5 lands — it passes `null` in and reads `null` out, a
  pass-through assertion, not the "forces to null" its name claims.
- `packages/core/src/domain/Feedback.test.ts:22-26,102-111` `[tests]` ·
  Tautological by construction: `isValidCategory` _is_
  `TOP_LEVEL_CATEGORIES.includes`, and the test iterates that same array. It
  asserts an array contains its own elements. Harmless, but contributes none of
  the confidence its name implies.
- `packages/core/src/domain/Feedback.ts:1-7` `[docs]` · The header WHY is the best
  documentation in the diff, with two gaps: it claims "Reworked in v0.6.0" while
  `CHANGELOG.md:9` still has this under `[Unreleased]` (unverified version claim
  that will rot), and `praise` — the one genuinely new semantic — is the only
  category left unexplained.
- `packages/core/src/domain/Feedback.ts:142-144` `[docs]` · Over-documentation:
  the comment restates the one-line body verbatim and duplicates a fact already
  stated twice above. Strip.

## ⚪ Disagree / Intentional

- **Icon maps in `WebComponentView.ts:21,29` do not belong in the domain.** An
  emoji is a presentation decision and the interface-adapter ring is where it
  belongs; the `Record<TopLevelCategory, …>` typing already forces both maps to
  stay exhaustive against the domain. Same verdict for the `i18n.ts` labels.
- **`praise` carrying `null` rather than a `'none'` sentinel is correct** — the
  discriminated union encodes the absence in the type system so the use-case can
  enforce it instead of trusting a magic string.
- **The four "locks the canonical X sub-categories" tests are justified** despite
  looking like they test a constant: the Worker duplicates this exact table, so
  they are a deliberate contract lock that makes a taxonomy edit loudly visible in
  review.
- **No e2e test for the taxonomy is the right call** at this stage. The
  widget↔Worker table duplication belongs in a release checklist or a shared
  fixture, not a browser test in this repo.
- **`i18n.test.ts` not asserting that every category has a label is correct** —
  `Messages.categoryLabels` is a `Record<TopLevelCategory, string>`, so a missing
  label is a compile error.
- **The dependency rule holds and no over-engineering was introduced.**
  `Feedback.ts` imports nothing at all; the change is net-subtractive (−252/+188,
  25 → 13 sub-categories) with no new port, layer, or pattern.
- **`README.md:468` (`broken-link`) and `PROJECT_LOG.md` occurrences of
  `ambiguous`** are unrelated English usage and historical log entries, not stale
  taxonomy references.

## Per-dimension summary

- **Design**: net-subtractive, no over-engineering, dependency rule intact; one
  real DRY breach — the unions and the runtime table can drift undetected.
- **Docs**: the in-diff documentation is above average (the `Feedback.ts` header
  and the CHANGELOG migration note are genuinely good WHY); the failure is reach —
  a breaking rework left the file that calls itself the canonical enum fully
  describing the dead taxonomy.
- **Tests**: pyramid healthy (196 unit/component, no inversion), no over-mocking —
  but the suite was replaced, not re-thought: both `throw` guards untested, one
  test collapsed into a duplicate of itself, and a real `target: undefined` defect
  hidden behind a test that exercises the wrong branch.
- **Security**: no XSS (every new interpolation sink takes compile-time literals or
  table-driven values; free text still escaped), the `praise` branch cannot smuggle
  an invalid pairing, and no secret or PII change. One fail-silent: unvalidated
  host `categories`.
- **Correctness**: the `praise` state path is sound (`select-category` and `back`
  both null the sub-category, so the use-case throw is unreachable from the UI) and
  every keyed record is exhaustive; the defects are at the untyped edges — host
  config and the omitted `target`.
