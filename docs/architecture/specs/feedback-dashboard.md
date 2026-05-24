# Spec — feedback dashboard (centralized feedback consultation)

> **Status**: needs + locked decisions (2026-05-23), UML conception phase.
> **Diagrams**: [`../diagrams/feedback-dashboard/`](../diagrams/feedback-dashboard/).
> **Related**: [`feedback-pipeline-worker.md`](./feedback-pipeline-worker.md);
> `feedback-digest.md` and `feedback-pipeline-pi.md` (forthcoming — on separate
> branches, not yet on `main`).

## Need

A single place to consult **every feedback** collected by the widget, **across
all projects**. Today nothing lets the operator read the feedback (it sits as
raw JSON in the Worker buffer); this feature is that interface.

## Actor

**Operator (Benoît)** only — single user, no tenancy, no per-client isolation.
The agency multi-tenant case is explicitly future / YAGNI.

## Locked decisions (validated 2026-05-23)

| #   | Decision                                                                                                                   | Plain rationale                                                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Cloudflare D1 = primary store**; the **Pi keeps a backup copy**                                                          | Cloudflare is always-on and the dashboard page (also on Cloudflare) can read it instantly; the Pi is private/at home and sometimes off, so it can't be the thing the page reads. |
| D2  | `/ingest` **writes directly to D1**; the **KV buffer is removed**; existing KV feedback is **migrated** into D1 (one-shot) | One sink, simpler. "All feedback" must include what was already collected.                                                                                                       |
| D3  | Dashboard is a **page served by the Worker**, reads/writes D1                                                              | One deploy, KISS.                                                                                                                                                                |
| D4  | **One** issue-creation/triage service on the Worker, triggered by **both** the dashboard and Telegram (**webhook**)        | Avoids duplicating triage logic in two places (Worker + Pi).                                                                                                                     |
| D5  | **Pi = pure backup mirror** of D1 (pulls D1 → local SQLite)                                                                | No longer a critical path.                                                                                                                                                       |
| D6  | Auth = **Cloudflare Access** + an **operator-owned domain** (to acquire)                                                   | Identity + MFA + audit, no shared secret. Domain also gives the pipeline a stable URL.                                                                                           |
| D7  | **Keep everything**, manual **delete** (RGPD right-to-erasure)                                                             | Low volume; full history useful.                                                                                                                                                 |
| D8  | Dashboard write actions: **delete, mark read/unread, mark handled/archived**                                               | A single mutable `status` field, same field the V2 triage uses.                                                                                                                  |
| D9  | **Stats**: schema is **stats-ready now**, stats **displayed in V2**                                                        | Wanted: per project, per category/sub, trend over time, top pages/elements. All derivable from D1 columns.                                                                       |

### Supersedes / impacts prior decisions

- **Supersedes** "Pi SQLite = source of truth" and "Telegram triage on the Pi
  via long-polling" from `feedback-pipeline-pi.md` (forthcoming)
  and the pipeline diagrams: the brain moves to the edge, Telegram triage uses a
  **webhook → Worker** (D4/D5).
- **Changes the digest** (`feedback-digest.md`, forthcoming): it now
  counts from **D1 by `created_at`**, not a KV cursor (D1/D2).
- The pipeline diagrams [`02-sequence`](../diagrams/feedback-pipeline/02-sequence.md)
  and [`03-component`](../diagrams/feedback-pipeline/03-component.md) still show
  the Pi as the brain → to be reconciled with the edge-centric model.
- The widget→Worker **payload contract is unchanged** (D2 is Worker-internal),
  so the existing payload-coupling rule with the Worker still applies (see
  [`feedback-pipeline-worker.md`](./feedback-pipeline-worker.md)).
- **Note**: [`feedback-pipeline-worker.md`](./feedback-pipeline-worker.md) still
  describes the KV-buffer + Pi-drain model, which D1/D2 supersede (direct D1
  writes, KV removed). That Worker spec needs an update; treat its KV-buffer
  design as superseded, not current.

## Phasing

- **V1 (this need)**: D1 + `/ingest`→D1 + KV migration + Cloudflare Access
  (domain) + auth-gated **list/filter** page + **delete** + **read/handled**.
- **V2**: the single triage/issue service (GitHub PAT + kanban routing)
  triggered by the dashboard button + the Telegram **webhook**; **stats** views.

## Where the code lives

`feedback-pipeline-worker` repo, its own session (one-session-per-project).
This repo (feedback-widget) holds the pipeline architecture docs only.

## Operator prerequisite

Acquire a **domain** on Cloudflare (for Access + a stable pipeline URL). Like the
bot token: configured in Cloudflare, never pasted in chat.
