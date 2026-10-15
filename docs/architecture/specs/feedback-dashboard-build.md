# Build spec — feedback dashboard V1 (chantiers)

> **Status**: executable build plan for the `feedback-pipeline-worker` session.
> **Source of truth**: [`feedback-dashboard.md`](./feedback-dashboard.md) (D1–D9),
> [`../diagrams/feedback-dashboard/04-class.md`](../diagrams/feedback-dashboard/04-class.md)
> (schema), [`feedback-pipeline-worker.md`](./feedback-pipeline-worker.md) (the
> LIVE Worker this extends).
> **Where the code lives**: the `feedback-pipeline-worker` repo, its own session
> (one-session-per-project). This file is the hand-off, not the code.

## Scope

V1 = **consultation**: a central, auth-gated page to browse/filter every
feedback across projects, with delete + read/handled. The Worker is already LIVE
(serves `/widget.js`, `POST /ingest`→KV). V1 evolves it to D1 and adds the
dashboard. V2 (triage service, digest cron, `/backup` for the Pi) is referenced
but out of scope here.

## Prerequisites (operator — no secrets in chat)

- **Cloudflare domain** on a zone you own — required only for **chantier 4**
  (Cloudflare Access). Chantiers 1–3 do not need it.
- Cloudflare account + Wrangler (already in use for the LIVE Worker).
- D1 is on the Cloudflare Free tier (5 GB) — enough at this volume.

## D1 schema (DDL)

Matches [`04-class.md`](../diagrams/feedback-dashboard/04-class.md). camelCase
payload fields map to snake_case columns.

> **Executable source of truth**: `feedback-pipeline-worker/migrations/`
> (`0001_init.sql`, applied 2026-05-24; `0002_remap_legacy_taxonomy.sql`, see
> [`legacy-taxonomy-remap.md`](./legacy-taxonomy-remap.md)). The implementation
> refined this DDL: the whole validated payload is stored verbatim in one
> `payload` JSON column (the real `target` is a 5-field object, not a single
> string) instead of a flat `targeted_element` + a `context` blob. The DDL below
> is the as-built one.

```sql
CREATE TABLE IF NOT EXISTS feedback (
  id            TEXT PRIMARY KEY NOT NULL,  -- UUID v4
  project_id    TEXT NOT NULL,              -- payload.projectId
  category      TEXT NOT NULL,              -- v0.6.0 projection of payload.category (see legacy-taxonomy-remap.md)
  sub_category  TEXT,                       -- v0.6.0 projection of payload.subCategory (NULL for 'praise')
  message       TEXT NOT NULL,
  reporter_name TEXT,
  url           TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'new',-- new | read | handled | issue_created(V2) | refused(V2)
  created_at    TEXT NOT NULL,              -- server ingestion time, ISO 8601
  payload       TEXT NOT NULL               -- full FeedbackPayload JSON — source of truth
);
CREATE INDEX IF NOT EXISTS idx_feedback_project_created ON feedback(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_status         ON feedback(status);

-- per-project digest cursor (used by the V2 digest cron; create now so the schema is stable)
CREATE TABLE IF NOT EXISTS digest_state (
  project_id  TEXT PRIMARY KEY,
  last_run_at TEXT NOT NULL
);
```

## Chantiers (ordered)

### Chantier 1 — D1 setup (no domain needed)

- `wrangler d1 create feedback` → add the `[[d1_databases]]` binding to
  `wrangler.toml` (binding `DB`).
- Apply the DDL above via a migration (`wrangler d1 migrations`).
- **DoD**: binding resolves in a test; tables exist; CI green.

### Chantier 2 — `/ingest` → D1 + migrate + drop KV (no domain needed)

- Rewrite `POST /ingest` to `INSERT` into D1 (generate `id`, set
  `created_at`, `status='new'`), keeping the existing origin filter, rate-limit,
  size cap, and validation. Return `204`.
- **One-shot migration**: read all existing `fb:*` KV entries → insert into D1
  (idempotent on a derived id) → verify counts → then remove the KV binding +
  buffer code. Keep a dry-run/count step before deleting anything.
- **DoD**: a posted feedback lands in D1; existing KV feedback is in D1; KV
  buffer removed; tests cover ingest happy/sad + the migration.

### Chantier 3 — `/dashboard` read + mutate (no domain needed)

- `GET /dashboard` — server-rendered page (or a small SPA + JSON API) listing
  feedback, **filter** by project / category / date, sort by `created_at`.
- Mutations (small JSON routes): **delete** a feedback (hard delete — RGPD);
  **mark read** (`status='read'`) / **unread** (`status='new'`); **mark handled**
  (`status='handled'`). Use **only** the canonical status vocabulary
  `new | read | handled` (+ V2 `issue_created | refused`) — never persist
  `unread` or `archived` as values (they are UI verbs, not stored states).
- Until chantier 4 lands, `/dashboard` **must** sit behind a mandatory auth gate:
  a temporary password/bearer check (a Worker secret), constant-time compared,
  over HTTPS, with an HttpOnly + Secure + SameSite cookie. **Never** rely on an
  unlisted or hard-to-guess URL — that is **not** access control and would expose
  PII. (Chantier 4 replaces this stopgap with Cloudflare Access.)
- **DoD**: list + filters work against D1; delete/status mutations persist;
  tests cover read, each mutation, and empty/edge states.

### Chantier 4 — Cloudflare Access (needs the domain)

- Put the Worker on the **custom domain**; create an **Access application** for
  the `/dashboard` path; policy = the operator's identity (email/MFA).
- Remove the temporary chantier-3 gate; Access enforces auth at the edge.
- **DoD**: `/dashboard` requires identity; `/ingest` + `/widget.js` stay public;
  unauthenticated `/dashboard` is rejected before reaching the Worker.

### Chantier 5 — V2 (out of scope, listed for sequencing)

- `GET /backup` (bearer) for the Pi mirror — see
  [`feedback-pipeline-pi.md`](./feedback-pipeline-pi.md).
- Digest cron (`scheduled`) reading D1 — see [`feedback-digest.md`](./feedback-digest.md).
- Single triage/issue service (GitHub PAT + kanban) triggered by the dashboard
  button + a Telegram webhook — see [`feedback-dashboard.md`](./feedback-dashboard.md) D4.

## Secrets / config (Wrangler — never in chat or repo)

- `DB` — D1 binding (var, not secret).
- `ALLOWED_ORIGINS` — existing var.
- V2 only: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `BACKUP_TOKEN`,
  `GITHUB_PAT`, `ANTHROPIC_API_KEY` — Wrangler secrets when those chantiers land.

## Testing / CI

- `@cloudflare/vitest-pool-workers` with a D1 test binding (migrations applied in
  setup). Cover: ingest→D1, migration, dashboard read+filters, each mutation,
  auth rejection (chantier 4).
- Mirror the LIVE Worker's CI (lint + typecheck + test + gitleaks), deploy on tag.

## Contract coupling reminder

`/ingest` still validates the widget payload shape — keep it in lockstep with
the widget (see the `POST /ingest` validation step and the
"The bundle (coupling with feedback-widget)" section in
[`feedback-pipeline-worker.md`](./feedback-pipeline-worker.md)). The D1 columns
are derived from that payload; a widget contract change touches both.
