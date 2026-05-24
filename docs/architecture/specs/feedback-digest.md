# Spec — daily Telegram feedback digest (Worker Cron)

> **Status**: build spec + locked decision (2026-05-23, reconciled to the
> edge-centric pivot 2026-05-24), ready to implement in the
> `feedback-pipeline-worker` repo/session.
> **Part of**: feedback pipeline. See
> [`../diagrams/feedback-pipeline/04-sequence-digest.md`](../diagrams/feedback-pipeline/04-sequence-digest.md).
> **Upstream**: the ingestion Worker —
> [`feedback-pipeline-worker.md`](./feedback-pipeline-worker.md) (LIVE) — and the
> dashboard pivot [`feedback-dashboard.md`](./feedback-dashboard.md) (D1 = store).

## Purpose

Every morning at **08:00 Europe/Paris**, send the operator **one Telegram
message per project that received new feedback** since the previous digest —
_"Projet X — vous avez N retours"_. A project with zero new feedback gets **no
message**. Send-only (no triage buttons — that is V2).

## Locked decisions

| Decision     | Choice                                                         | Why                                                                                                                                                                       |
| ------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Host**     | Cloudflare Worker **Cron Trigger** (not the Pi)                | A clock-triggered push must run on the always-on edge; the Pi has heartbeat instability. The feedback is already in **D1** on the Worker ⇒ no transfer, no Pi dependency. |
| **Counting** | **New since last digest**, queried from **D1** by `created_at` | The natural reading of a daily digest. D1 is the durable source of truth (dashboard pivot D1/D2), so the count is exact and survives restarts.                            |
| **Bot mode** | **Send-only** for now                                          | The 3-button bidirectional triage stays a later V2. Same bot is fine — `sendMessage` (here) and the V2 triage webhook do not conflict.                                    |

> **Reconciled (2026-05-24)**: the original design counted via a **KV timestamp
> cursor**. The edge-centric pivot removed the KV buffer (D2) and made **D1** the
> primary store, so the digest now queries D1 and keeps a small **per-project**
> cursor there (`digest_state`). No KV, no Pi-drain coexistence caveat.

## Implementation (in the `feedback-pipeline-worker` repo, its own session)

### Prerequisites (operator, manual — no token in chat)

1. Create the bot via **@BotFather** → get the **bot token**.
2. Get the destination **chat ID** (DM with the bot; via @userinfobot or a
   one-off `getUpdates`).
3. Store both as Worker secrets:
   `wrangler secret put TELEGRAM_BOT_TOKEN` and
   `wrangler secret put TELEGRAM_CHAT_ID`. **Never** in the repo or chat.

### Cron Trigger (`wrangler.toml`)

```toml
[triggers]
crons = ["0 6 * * *", "0 7 * * *"]  # 08:00 Paris year-round; guard picks the right one
```

Cloudflare cron is **UTC**: 08:00 Paris = 07:00 UTC (CET/winter) or 06:00 UTC
(CEST/summer). The two entries + a `Europe/Paris == 08:00` guard fire exactly
once per day across DST.

### `scheduled(event, env, ctx)` handler

1. **Guard** — return immediately unless the local hour in `Europe/Paris` is 8
   (e.g. via `Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: ... })`).
2. Query D1 for new feedback per project, using a **per-project** cursor
   (`digest_state(project_id PK, last_run_at)`, default epoch 0):

   ```sql
   SELECT f.project_id, COUNT(*) AS n
   FROM feedback f
   LEFT JOIN digest_state d ON d.project_id = f.project_id
   WHERE f.created_at > COALESCE(d.last_run_at, 0)
   GROUP BY f.project_id
   HAVING n > 0;
   ```

3. For each row: `POST` to
   `https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/sendMessage`
   with `{ chat_id, text: "Projet <label> — vous avez <N> retours" }`.
4. **Per project, immediately after its own send succeeds**, upsert that
   project's cursor: `digest_state(project_id, last_run_at) = (?, now)`.

> **Per-project cursor, not a global one** (Codex review, PR #54): advancing a
> single global cursor only after _all_ sends succeed duplicates already-sent
> projects on a **partial failure** (project A sent, project B errors → cursor
> stays → next run resends A). Advancing each project's cursor right after its
> own successful send makes a partial failure safe: only the un-sent projects
> are retried next run, with no duplicates.

### Supporting changes

- **`projectId` → label map** (e.g. `brasse-bouillon → "Brasse Bouillon"`),
  fallback to the raw id.
- No KV key changes — D1 already carries `project_id` and `created_at` as
  columns (see [`../diagrams/feedback-dashboard/04-class.md`](../diagrams/feedback-dashboard/04-class.md)).

### Tests (vitest-pool-workers)

- counts per project correctly from D1; projects at 0 are **skipped**;
- each project's `last_run_at` advances only after **its own** send succeeds;
- **partial failure**: when one project's send errors, already-sent projects are
  **not** resent on the next run (no duplicates), and the failed project is;
- the Paris-08:00 guard rejects the wrong UTC run;
- message format; Telegram `fetch` mocked; missing-secret handling.

## Definition of Done

- Cron fires once/day at 08:00 Europe/Paris.
- One message per project with new feedback; **none** for zero-count projects.
- Count = new since each project's last digest, queried from D1 — no
  double-reporting, **including on partial send failure** (per-project cursor).
- Secrets are Worker secrets; nothing leaks to repo/chat.
- Tests green; README documents the cron, secrets, and the timezone guard.

## Relation to the rest of the pipeline

- Reads the **same D1 primary store** the dashboard and the V2 triage use
  (single source of truth) — see [`feedback-dashboard.md`](./feedback-dashboard.md).
- **Independent of the Pi**: the Pi is only a backup mirror of D1
  ([`feedback-pipeline-pi.md`](./feedback-pipeline-pi.md)); it never deletes from
  D1, so the digest count is always exact.
