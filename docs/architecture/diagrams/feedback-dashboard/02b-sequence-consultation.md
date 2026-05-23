# Sequence diagram — feedback-dashboard — consult + moderate (auth)

> **Feature**: feedback dashboard.
> **Source spec**: [`../../specs/feedback-dashboard.md`](../../specs/feedback-dashboard.md) §D3, D6–D8.

## Context

The operator opens the dashboard (gated by Cloudflare Access), lists/filters
feedback, and moderates (delete / mark). Shows the **Access** gate in front of
the Worker. V2 triage is noted but not detailed here.

## Diagram

```mermaid
sequenceDiagram
  actor O as Operator (Benoît)
  participant AC as Cloudflare Access (identity gate)
  participant W as Worker /dashboard (Cloudflare)
  participant D1 as D1 (primary store)

  O->>AC: open dashboard URL (custom domain)
  alt not authenticated
    AC-->>O: redirect to identity (email / MFA)
    O->>AC: authenticate
  end
  AC->>W: forward request (+ verified identity)
  O->>W: list / filter (project, category, date)
  W->>D1: SELECT … WHERE … ORDER BY created_at
  D1-->>W: rows
  W-->>O: render feedback list

  opt moderate
    O->>W: mark read / handled  (or delete)
    W->>D1: UPDATE status  (or DELETE row — RGPD)
    D1-->>W: ok
    W-->>O: updated row
  end

  Note over O,W: V2 — "Triage into issue" calls the shared issue service (see component diagram)
```

## Notes

- **Cloudflare Access sits in front of the Worker** — auth is enforced at the
  edge before any request reaches the dashboard code (spec D6). Requires the
  custom domain.
- `DELETE` is a hard delete (RGPD right-to-erasure, spec D7).
- `status` is the single field shared with the V2 triage (spec D8) — no
  competing state.
