# Sequence diagram — feedback-pipeline — end-to-end flow

> **Feature**: feedback consumer pipeline. Design locked 2026-05-21
> (Q1–Q8).
> **Companion**: [`01-use-case.md`](./01-use-case.md),
> [`03-component.md`](./03-component.md).

## Context

This diagram shows what happens _in time_ for one feedback, from the
reviewer's submit to the GitHub issue. It makes the **edge-buffer +
outbound-pull** boundary explicit (the Pi never receives an inbound
public connection) and the **human-in-the-loop** triage step. It does
not cover error/retry detail (widget outbox, Worker retries) — those
live in the component notes.

## Diagram

```mermaid
sequenceDiagram
  actor R as Reviewer
  participant W as Widget (public bundle)
  participant CF as Cloudflare Worker (edge buffer)
  participant Pi as bb-homelab service (Pi 5)
  participant DB as HDD store (SQLite)
  participant CL as Claude API
  participant TG as Telegram (1 bot)
  actor O as Operator (Benoît)
  participant GH as GitHub (issues + kanban)

  R->>W: pick category → sub-category → message → submit
  W->>CF: POST /ingest (flat payload + origin check)
  CF->>CF: validate origin + rate-limit + shape
  CF-->>W: 204 (buffered)
  Note over W,CF: Reviewer is done — always succeeds even if Pi is down

  loop Pi cron (outbound pull, every N min)
    Pi->>CF: GET /drain (drain token)
    CF-->>Pi: pending feedback[]
    Pi->>DB: store raw feedback (status: new)
    Pi->>CL: reformulate(feedback) → {title, summary, labels}
    Pi->>DB: update (status: proposed)
    Pi->>TG: send proposal + 3 buttons ([projectId] label)
  end

  O->>TG: tap Accept / Reformulate / Refuse
  TG->>Pi: callback (long polling getUpdates)
  alt Accept
    Pi->>GH: create issue → column "To Do"
    Pi->>DB: status: accepted (issueUrl)
  else Reformulate
    Pi->>GH: create issue → "Backlog" + needs-reformulation labels
    Pi->>DB: status: reformulation_requested (issueUrl)
  else Refuse
    Pi->>DB: status: refused (no GitHub artifact)
  end
```

## Notes

- The `204 (buffered)` reply is the key reliability property: the
  reviewer's submit succeeds the moment the **edge** accepts it; the Pi
  being down or unstable never blocks the reviewer (it catches up on the
  next pull).
- Every arrow from `Pi` is **outbound** (Pi → CF, Pi → Claude, Pi → TG,
  Pi → GH). Nothing connects _into_ the Pi — imposed by the Tailscale-
  only homelab (no public ingress). Telegram callbacks arrive via
  **long polling** (`getUpdates`), not a webhook, for the same reason.
- The HDD store is written at every state transition → it is the single
  source of truth. The GitHub issue is created only on Accept /
  Reformulate; Refuse leaves only the store record.
- The single Claude API call is the only AI step (reformulation). No
  autonomous agent loop (deterministic flow → Agent SDK is YAGNI).
- Routing to the right repo/kanban uses `projectId` from the payload
  (one bot, many projects).
