# Sequence diagram — legacy taxonomy remap (feedback-widget#84, option C)

> **Feature**: keep the D1 `category` / `sub_category` columns on the single
> v0.6.0 vocabulary while the Worker still accepts the retired taxonomy from
> pinned widgets (< 0.6.0, see #102).
> **Decision**: [`../../specs/legacy-taxonomy-remap.md`](../../specs/legacy-taxonomy-remap.md).
> **Companion**: [`../feedback-dashboard/02a-sequence-ingest.md`](../feedback-dashboard/02a-sequence-ingest.md).

## Context

Two paths write the taxonomy columns. The **ingest** path normalizes every
accepted payload at write time; the **one-shot migration** normalizes the rows
stored before that normalization existed. Both use the same mapping table, and
neither touches the `payload` JSON column (source of truth), so the remap is
reversible.

## Diagram

```mermaid
sequenceDiagram
  participant Wd as Widget (any version)
  participant W as Worker /ingest
  participant V as validate<br/>(categoryTableFor)
  participant T as taxonomy<br/>(normalizeTaxonomy)
  participant D1 as D1 feedback
  actor O as Operator (Benoît)

  Wd->>W: POST payload {widgetVersion, category, subCategory, …}
  W->>V: validateFeedbackPayload
  alt widgetVersion < 0.6.0
    V-->>W: ok — legacy pair accepted (compat window, #102)
  else widgetVersion >= 0.6.0 or unparseable
    V-->>W: ok — v0.6.0 pair only
  end
  W->>T: normalizeTaxonomy(category, subCategory)
  T-->>W: v0.6.0 pair (remapped if legacy, else unchanged)
  W->>D1: INSERT columns = v0.6.0 pair, payload = JSON as sent
  W-->>Wd: 204

  Note over O,D1: once, after the Worker above is deployed
  O->>D1: SELECT legacy rows → local backup (never committed)
  O->>D1: wrangler d1 migrations apply (0002: UPDATE per legacy pair)
  D1-->>O: counts per (category, sub_category) — legacy = 0
  Note over D1: rollback = UPDATE … SET category/sub_category<br/>FROM json_extract(payload, …)
```

## Notes

- The dashboard needs no change: it renders the columns as opaque escaped
  strings and filters by bound equality, so it only ever sees v0.6.0 names.
- The migration is idempotent (its WHERE clauses match legacy pairs only) and
  is replayed in the Worker's integration suite against rows inserted with the
  retired vocabulary.
