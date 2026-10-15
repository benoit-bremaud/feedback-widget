# Decision — D1 rows carrying the retired taxonomy (remap vs tolerant read)

> **Status**: decided 2026-10-15 (option C), tracked in
> [feedback-widget#84](https://github.com/benoit-bremaud/feedback-widget/issues/84),
> implemented in `feedback-pipeline-worker`.
> **Part of**: feedback pipeline, epic #76. See
> [`../diagrams/legacy-taxonomy-remap/02-sequence.md`](../diagrams/legacy-taxonomy-remap/02-sequence.md).
> **Upstream**: the v0.6.0 taxonomy rework (feedback-widget#64) and the Worker
> lockstep with its compatibility window (feedback-widget#83, removal in #102).

## Problem

feedback-widget v0.6.0 retired the `typo`, `error`, `ambiguous` and `other`
categories (and several sub-categories of `bug` / `suggestion`). Rows stored in
D1 before the rework still carry those names, and the Worker keeps accepting
them from widgets older than 0.6.0 while V-SEA vendors widget 0.4.0 (#102).
Nothing crashes on such rows (verified on #84), but they are only reachable in
the dashboard through their old `?category=` value: two vocabularies in one
triage view.

Prod inventory on 2026-10-15 (read-only count, 11 rows): 7 legacy —
`ambiguous/wording` 1, `ambiguous/missing-context` 2,
`ambiguous/example-unclear` 1, `other/NULL` 2, `suggestion/content-refactor` 1.
No `typo` or `error` row.

## Options and MCDA

Weights validated by the owner (integrity 25 · open ingest window 20 ·
reversibility 15 · KISS 15 · triage UX fixed now 15 · cost 10).

| Criterion (weight)       | A — one-shot remap (columns + payload)  | B — tolerant read                         | C — remap columns, payload verbatim                       | D — wait for #102, then remap |
| ------------------------ | --------------------------------------- | ----------------------------------------- | --------------------------------------------------------- | ----------------------------- |
| Data integrity (25)      | 4 — clean columns, original lost        | 3 — two vocabularies for ever             | 5 — columns normalized, original kept in `payload`        | 2 — gap stays with no date    |
| Open ingest window (20)  | 2 — must be re-run after the V-SEA bump | 5 — new legacy rows handled by the reader | 5 — the same mapping normalizes legacy payloads at ingest | 5 — waits                     |
| Reversibility (15)       | 1 — file backup only                    | 5 — nothing written                       | 4 — replayable from `payload`                             | 3                             |
| KISS (15)                | 4 — one migration                       | 2 — dual vocabulary in dashboard + filter | 3 — one table, one migration, one write-time hook         | 5                             |
| Triage UX fixed now (15) | 4                                       | 5                                         | 4                                                         | 1                             |
| Cost (10)                | 4                                       | 2                                         | 3                                                         | 5                             |
| **Total /500**           | **315**                                 | **375**                                   | **420**                                                   | **335**                       |

Sensitivity: reversibility 25 / KISS 5 → B 405 vs C 410; ingest window 30 / UX
5 → B 375 vs C 400. C stays first in every weighting tried.

## Decision (C)

- **Columns are the v0.6.0 projection, `payload` is the source of truth.**
  `category` / `sub_category` only ever carry the current vocabulary; the JSON
  column keeps the pair the widget sent. The remap is reversible with
  `json_extract(payload, '$.category')` / `'$.subCategory'`.
- **One mapping table**, `LEGACY_TAXONOMY_REMAP` in the Worker
  (`src/lib/taxonomy.ts`), used at write time by `insertFeedback` and mirrored
  by `migrations/0002_remap_legacy_taxonomy.sql` for the rows stored before.
- **Deploy order**: Worker first (ingest normalizes), then the migration — no
  legacy pair can land in between.
- **Exit**: the mapping, the migration's rationale and the compatibility
  window all go away with #102.

## Mapping (old → new)

Validated by the owner for the pairs present in prod (bold); the rest is the
closest-intent projection.

| Legacy                                   | v0.6.0                     |
| ---------------------------------------- | -------------------------- |
| bug/broken-feature                       | bug/no-effect              |
| bug/visual-glitch                        | bug/broken-display         |
| bug/wrong-output                         | bug/no-effect              |
| bug/regression                           | bug/no-effect              |
| typo/prose, heading, link-text, alt-text | content/typo               |
| typo/code-sample                         | content/wrong-info         |
| error/js-console, http-5xx               | bug/crash                  |
| error/http-404, broken-link              | content/dead-link          |
| error/missing-asset                      | bug/broken-display         |
| **ambiguous/wording**                    | **unclear/wording**        |
| ambiguous/navigation                     | unclear/navigation         |
| ambiguous/terminology                    | unclear/wording            |
| **ambiguous/example-unclear**            | **unclear/missing-info**   |
| **ambiguous/missing-context**            | **unclear/missing-info**   |
| suggestion/new-example                   | suggestion/improvement     |
| **suggestion/content-refactor**          | **suggestion/improvement** |
| **other/NULL**                           | **suggestion/improvement** |

Unchanged pairs (`bug/crash`, `suggestion/new-feature`,
`suggestion/improvement`, `suggestion/accessibility`) pass through.
