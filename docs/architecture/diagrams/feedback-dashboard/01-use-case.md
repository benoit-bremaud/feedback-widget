# Use-case diagram — feedback-dashboard — who consults what

> **Feature**: feedback dashboard (centralized consultation).
> **Source spec**: [`../../specs/feedback-dashboard.md`](../../specs/feedback-dashboard.md).

## Context

Who interacts with the dashboard and to do what. One actor (the operator).
Grouped by **domain** (Consultation, Moderation), not by where it runs. The daily
Telegram digest is **not** here — a scheduled push is a trigger, not an
actor-initiated goal (see [`../feedback-pipeline/04-sequence-digest.md`](../feedback-pipeline/04-sequence-digest.md)).

## Diagram

```mermaid
flowchart LR
  Operator(("Operator — Benoît"))

  subgraph SYSTEM ["Feedback dashboard"]
    subgraph Consultation ["Consultation domain"]
      UC1(("Browse collected feedback"))
      UC2(("Filter feedback by project / category / date"))
      UC7(("Review feedback statistics — V2"))
    end
    subgraph Moderation ["Moderation domain"]
      UC3(("Mark feedback as read"))
      UC4(("Mark feedback as handled / archived"))
      UC5(("Delete a feedback — RGPD erasure"))
      UC6(("Triage feedback into a GitHub issue — V2"))
    end
  end

  Operator --> UC1
  Operator --> UC2
  Operator --> UC3
  Operator --> UC4
  Operator --> UC5
  Operator --> UC6
  Operator --> UC7
```

## Notes

- **V1** = UC1–UC5. **V2** = UC6 (triage) + UC7 (stats).
- UC6 *"Triage into a GitHub issue"* is operator-initiated (the operator decides
  and acts) — it is a valid use case. It is the **same** goal whether triggered
  from this dashboard or from Telegram; one service backs both (spec D4).
- The Telegram **digest** is deliberately absent: receiving a notification is a
  trigger, not a goal (UML 2.5 / Cockburn).
- Single actor today (spec: no tenancy / YAGNI on the agency multi-tenant case).
