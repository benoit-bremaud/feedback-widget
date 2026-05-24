# Spec — bb-homelab Pi backup mirror

> **Status**: build spec, to scaffold in a dedicated `bb-homelab` repo/session.
> **Part of**: feedback pipeline. See
> [`../diagrams/feedback-dashboard/03-component.md`](../diagrams/feedback-dashboard/03-component.md).
> **Upstream**: the ingestion Worker —
> [`feedback-pipeline-worker.md`](./feedback-pipeline-worker.md) (LIVE) — and the
> edge-centric pivot [`feedback-dashboard.md`](./feedback-dashboard.md).
> **Scope**: an **optional on-premise backup**, not on any critical path.

**Reconciled (2026-05-24)**: this was originally the _drain service_ that
consumed a KV buffer and was the **source of truth** (chantier 3). The
edge-centric pivot made **Cloudflare D1 the primary store** (dashboard D1) and
removed the KV buffer (D2). The Pi is therefore demoted to a **backup mirror**:
it pulls a read-only copy of D1 for data sovereignty / disaster recovery. It no
longer drains, acks, or deletes anything.

## Purpose

A service on the bb-homelab Raspberry Pi 5 that keeps an **on-premise copy of
the D1 primary store** — _"Pi + Cloudflare backup"_. D1 (always-on edge) is the
source of truth the dashboard, digest, and V2 triage read/write; the Pi mirror
exists so the data also lives on hardware the operator owns. If the Pi is off or
unstable, **nothing breaks** — it is never on the submit/read/triage path.

The Pi is **Tailscale-only with no public ingress** (bb-homelab decision #28),
so it can only **pull outbound**:

1. `GET /backup?since=<cursor>` on the Worker (bearer `BACKUP_TOKEN`) → feedback
   rows changed since the cursor.
2. **Upsert** each row into local SQLite (idempotent on `id`).
3. Advance the local cursor. No ack, no delete on the Worker side.

## Repo

- Built from **`bb-homelab`** (Docker), in its own Claude Code session
  (one-session-per-project — spec here, code in its repo).
- Follow bb-homelab's IaC structure + house conventions (CI, secret hygiene,
  Conventional Commits, no AI attribution, PROJECT_LOG).

## Stack

- **TypeScript** strict (no `any`, named exports), **Node**, a **Docker**
  container fitting the bb-homelab Docker stack.
- **SQLite** via **`better-sqlite3`** on the mounted HDD ⇒ durable, survives
  restarts, no SD-card corruption.
- **Vitest** for tests.

## Backup protocol (MUST match the Worker `/backup` route)

1. `GET /backup?since=<ISO>` with `Authorization: Bearer <BACKUP_TOKEN>` →
   `{ rows: Feedback[], serverTime }` for rows with `created_at > since`
   **or** `updated_at > since` (so status changes mirror too). Confirm the exact
   shape against the Worker at build time — the Worker owns the contract.
2. **Upsert** each row into local SQLite (`INSERT … ON CONFLICT(id) DO UPDATE`),
   so re-pulling a row is idempotent and status changes are reflected.
3. Advance the local `last_sync_at` cursor to `serverTime` after a successful
   batch. A crash mid-batch just re-pulls next cycle (upsert dedups).

**RGPD note**: a hard delete in D1 (dashboard erasure) must propagate to the
mirror. The incremental pull does not see deletions, so run a **periodic full
reconcile** (e.g. nightly: fetch all live `id`s, delete local rows absent
upstream) and document the backup-retention window.

## SQLite schema (mirror of the D1 `feedback` table)

Mirror the D1 columns 1:1 — see
[`../diagrams/feedback-dashboard/04-class.md`](../diagrams/feedback-dashboard/04-class.md):
`id` (PRIMARY KEY), `project_id`, `category`, `sub_category`, `message`,
`reporter_name`, `url`, `targeted_element`, `context` (JSON), `status`,
`created_at`. Keep the raw payload/context blob authoritative (the broken-out
columns are for querying); this immunises the mirror against a contract change
(see the payload-coupling rule in
[`feedback-pipeline-worker.md`](./feedback-pipeline-worker.md)).

## Execution loop

- An **idempotent one-shot driven by cron / systemd-timer** — robust given the
  Pi's known heartbeat instability; a missed run just catches up next time
  (D1 keeps everything). A long-running container with `setInterval` is also
  fine. Decide at build time.

## Config / secrets on the Pi (never in chat, never committed)

- `WORKER_BASE_URL` = `https://feedback-pipeline-worker.bbd-concept.workers.dev`
  (plain var).
- `BACKUP_TOKEN` = **secret**, also a Worker secret. Retrieve it from the
  password manager; inject into the Pi `.env` / Docker env — never paste it in
  chat (see `feedback_never_expose_tokens` in project memory).
- `SYNC_INTERVAL` (e.g. 900 s), `DB_PATH` on the mounted HDD
  (e.g. `storage/feedback/feedback.db`).

## Network / Pi infra (nothing to open)

- Outbound HTTPS to `*.workers.dev`: OK. **No Caddy route, no inbound port** —
  the service is 100% outbound. Optional local healthcheck on the tailnet only.
- HDD already mounted (`storage/`).

## Tests (Vitest)

- parse a `/backup` response into rows;
- upsert reflects status changes and dedups on `id`;
- the full-reconcile removes locally-orphaned rows (RGPD deletes);
- `Authorization` header well-formed; `401` handling.

## Definition of Done

- A Docker service on the Pi mirrors D1 on a schedule, outbound, idempotently.
- `BACKUP_TOKEN` matches the Worker; outbound auth works.
- Status changes and deletions reconcile into the local SQLite copy.
- Being down never affects the live pipeline (backup only).
- Tests green; bb-homelab README documents env/secret, `DB_PATH`, schedule,
  the reconcile job, and deploy.

## Cross-references

- Current architecture: [`../diagrams/feedback-dashboard/03-component.md`](../diagrams/feedback-dashboard/03-component.md)
  (D1 primary, Pi backup) supersedes the Pi-as-brain layout in
  [`../diagrams/feedback-pipeline/03-component.md`](../diagrams/feedback-pipeline/03-component.md).
- [`feedback-pipeline-worker.md`](./feedback-pipeline-worker.md) — the Worker
  must add the bearer-authed `/backup` route this service reads.
