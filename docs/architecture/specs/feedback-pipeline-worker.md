# Spec — feedback ingestion Worker (V1 chantier 2)

> **Status**: build spec, ready to scaffold in a dedicated repo/session.
> **Part of**: V1 feedback pipeline (see
> [`../diagrams/feedback-pipeline/`](../diagrams/feedback-pipeline/)).
> **Decisions**: debrief Q1–Q8 + hosting decision (2026-05-22) — the
> ingestion Worker also serves the public widget bundle; free on the
> Cloudflare Workers Free tier; the bb-homelab Pi pulls outbound.

## Purpose

A single Cloudflare Worker that is the **only public surface** of the
pipeline. It:

1. **Serves the public widget bundle** — `GET /widget.js` (Workers
   Static Assets). Lets the build-less brasse-bouillon static site load
   the widget via `<script type="module" src="…/widget.js">`.
2. **Ingests feedback** — `POST /ingest`: origin allowlist + rate-limit
   - payload validation, then buffers the JSON in KV. Returns `204`
     fast so the reviewer's submit always succeeds (even if the Pi is
     down).
3. **Lets the Pi drain** — `GET /drain`: bearer-token auth, returns the
   pending feedback and marks it consumed. The Pi calls this
   **outbound** (it has no public ingress — Tailscale-only).

Nothing connects _into_ the Pi; the Worker is the durable edge buffer.

## Repo

- New dedicated repo: **`feedback-pipeline-worker`** (private-first).
- Mirror feedback-widget governance: `CONTRIBUTING.md`, `PROJECT_LOG.md`,
  branch + tag protection, CI (lint + typecheck + test + secret
  detection), Conventional Commits, no AI attribution.
- Add it to a GitHub Project (reuse `feedback-widget` board or a new
  one — decide at scaffold time).

## Stack

- **Cloudflare Workers** + **Wrangler** (you already have a Cloudflare
  account — Free tier is enough: 100k req/day).
- **TypeScript** strict, no `any`, named exports.
- **Vitest** + `@cloudflare/vitest-pool-workers` (runs tests inside the
  Workers runtime — KV, fetch, etc.).
- **KV** namespace for the buffer.
- **Workers Static Assets** for `/widget.js`.

## Routes

| Method    | Path         | Auth                                  | Behaviour                                                                           |
| --------- | ------------ | ------------------------------------- | ----------------------------------------------------------------------------------- |
| `GET`     | `/widget.js` | none (public)                         | Serve the bundle (static asset), `Cache-Control` + `Content-Type: text/javascript`. |
| `OPTIONS` | `/ingest`    | none                                  | CORS preflight → 204 + CORS headers.                                                |
| `POST`    | `/ingest`    | origin allowlist + rate-limit         | Validate + buffer feedback, return `204`.                                           |
| `GET`     | `/drain`     | `Authorization: Bearer <DRAIN_TOKEN>` | Return pending feedback (+ mark consumed), `200`.                                   |

### `POST /ingest`

1. **CORS / origin gate** — reject if `Origin` not in
   `ALLOWED_ORIGINS` (env, comma-separated, e.g. the brasse-bouillon
   site URL). Echo the matched origin in `Access-Control-Allow-Origin`
   (never `*`). This is the real gate — there is no strong client
   token (any token shipped in the public bundle is visible, so it is
   only a soft signal, not a secret).
2. **Size cap** — reject bodies over ~16 KB (`413`).
3. **Rate-limit** — per-IP (CF `request.headers.get('cf-connecting-ip')`)
   simple fixed-window counter in KV (e.g. 20/min). `429` over limit.
4. **Validate** — the flat `FeedbackPayload` shape (projectId, category,
   subCategory, message, + the 10 auto-capture fields). Reject `400` on
   shape/type mismatch. (Reuse a small ajv/zod schema, or hand-rolled
   validation — keep it dependency-light.)
5. **Buffer** — `KV.put("fb:" + Date.now() + ":" + crypto.randomUUID(),
JSON.stringify({ payload, receivedAt, status: "pending" }))`. No TTL
   (the Pi drains and deletes; add a long safety TTL e.g. 30 d).
6. Return `204`.

### `GET /drain`

1. **Auth** — `Authorization: Bearer <DRAIN_TOKEN>`; constant-time
   compare; `401` otherwise. `DRAIN_TOKEN` is a Wrangler **secret**,
   known only to the Worker and the Pi service.
2. List `fb:` keys (KV `list`), read up to N, return the array.
3. **Ack model** — simplest: the Pi sends back the consumed keys to a
   `POST /drain/ack` (also bearer-authed) → Worker deletes them. (Or
   delete-on-read, but that risks loss if the Pi crashes mid-store. Ack
   is safer.) Decide at build; ack-after-store is recommended.

## Secrets / config (Wrangler)

- `ALLOWED_ORIGINS` — **var** (not secret), comma-separated origins.
- `DRAIN_TOKEN` — **secret** (`wrangler secret put DRAIN_TOKEN`). Strong
  random; also stored in the Pi service config. **Never** in code, the
  public site, or chat.
- KV namespace binding `FEEDBACK_BUFFER`.
- No Claude / Telegram / GitHub secrets here — those live on the Pi
  (V2). The Worker only buffers.

## The bundle (coupling with feedback-widget)

The Worker serves `feedback-widget`'s `dist-bundle/feedback-widget.js`.
For V1 (KISS, no cross-repo CI auth): **commit the built bundle** into
the Worker repo under `public/widget.js`, refreshed on each widget
release (`pnpm --filter @benoit-bremaud/feedback-widget build:bundle`
in feedback-widget, then copy the output). Document the refresh step in
the Worker repo's README. (Later: automate via a release artifact pull.)

## wrangler.toml (skeleton)

```toml
name = "feedback-pipeline-worker"
main = "src/index.ts"
compatibility_date = "2026-05-01"

assets = { directory = "public", binding = "ASSETS" }

[[kv_namespaces]]
binding = "FEEDBACK_BUFFER"
id = "<filled by `wrangler kv namespace create FEEDBACK_BUFFER`>"

[vars]
ALLOWED_ORIGINS = "https://brasse-bouillon.example"  # real staging origin
# DRAIN_TOKEN set via: wrangler secret put DRAIN_TOKEN
```

## src/index.ts (skeleton)

```ts
export interface Env {
  FEEDBACK_BUFFER: KVNamespace
  ASSETS: Fetcher
  ALLOWED_ORIGINS: string
  DRAIN_TOKEN: string
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname === '/ingest') return handleIngest(req, env)
    if (url.pathname === '/drain') return handleDrain(req, env)
    if (url.pathname === '/drain/ack') return handleAck(req, env)
    // Everything else (incl. /widget.js) → static assets.
    return env.ASSETS.fetch(req)
  },
}
// handleIngest / handleDrain / handleAck per the route specs above.
// Keep CORS, rate-limit, validation in small testable helpers.
```

## CI (.github/workflows/ci.yml)

Mirror feedback-widget: SHA-pinned actions, `lint` + `typecheck` +
`test` (vitest-pool-workers) + `gitleaks`. Add a **deploy** job on tag
(`wrangler deploy`) using a `CLOUDFLARE_API_TOKEN` repo secret —
optional for V1 (can deploy manually first).

## Tests (vitest-pool-workers)

- `/ingest`: rejects bad origin (403), oversized body (413), bad shape
  (400), over rate-limit (429); accepts a valid payload (204) and writes
  to KV.
- `/drain`: 401 without/with wrong token; returns buffered items with a
  valid token.
- `/drain/ack`: deletes acked keys.
- `/widget.js`: served (200, JS content-type) — via the ASSETS binding.

## Definition of Done (chantier 2)

- Worker deploys to a `*.workers.dev` URL (or a custom subdomain).
- `GET /widget.js` returns the bundle (200).
- `POST /ingest` from the brasse-bouillon origin buffers a feedback;
  other origins get 403.
- `GET /drain` with the token returns the buffered feedback.
- CI green; tests cover the 4 routes' happy + sad paths.
- README documents: env/secrets, the bundle-refresh step, deploy.

## Next chantiers (after this)

- **Chantier 3** — bb-homelab Pi service: cron pulls `/drain` (outbound),
  stores on HDD, acks. (V2 then adds the Claude reformulation + Telegram
  3-button triage + GitHub kanban.)
- **Chantier 4** — brasse-bouillon `packages/website`: add the
  `<script type="module" src="https://<worker>/widget.js">` +
  `mountFeedbackWidget({ projectId: 'brasse-bouillon', endpoint:
'https://<worker>/ingest' })`.
