# n8n consumer pipeline — design

> **⚠️ Orchestration superseded (2026-05-21).** The **ports/adapters
> design below still holds** (ConfigSource, LLMGateway, IssueTracker,
> NotificationChannel). What changed after the Phase B enriched-vision
> debrief: the **orchestrator is no longer n8n** — it is a dedicated
> Docker service on the bb-homelab Pi, fronted by an **edge Cloudflare
> Worker** that buffers feedback (the Pi pulls outbound, since it is
> Tailscale-only with no public ingress). The reformulation uses a
> single Claude API call (no agent loop). See the current architecture
> in [`docs/architecture/diagrams/feedback-pipeline/`](../../docs/architecture/diagrams/feedback-pipeline/).
> Treat the n8n specifics here as historical; the port contracts and
> the data model remain the reference.

Status: **design draft**, not yet implemented. Tracks issue
[#16](https://github.com/benoit-bremaud/feedback-widget/issues/16).
Companion doc: [`projects-yaml-schema.md`](./projects-yaml-schema.md).

## Goal

Consume feedback payloads posted by `@benoit-bremaud/feedback-widget`
across multiple sites, route each payload to the right GitHub repo +
project board, and notify the owner on the right channel — all without
hard-coding any site-, tracker-, or channel-specific logic in the
orchestration itself.

## Constraints

- **SOLID + DIP** — the n8n workflow depends on abstract ports, never
  on concrete SaaS clients. Swapping Telegram for Discord must mean
  swapping the adapter node, not editing the flow.
- **Solo operator, ~15 feedbacks/week max** — no multi-tenancy, no
  rate-limit tower, no fancy scheduler. A straight webhook → process
  → fan-out is enough.
- **Dev/QA only** — the widget ships on documentation sites and
  internal tools. Not production-facing.
- **No LLM at MVP** — `LLMGateway` port is defined but the only
  adapter shipping in v0.3.0 is template-based. Keeps the DIP promise
  without forcing an API key today.

## Overview

```text
┌───────────────────────────────────────────────────────────────────┐
│ Widget  (browser, widget v0.3.0)                                  │
│  user click → category → sub-category → free text → submit        │
│  auto-capture: url, referrer, userAgent, viewport, locale,        │
│                timestamp, projectId, widgetVersion,               │
│                scrollDepth, sessionId                             │
└───────────────────────────┬───────────────────────────────────────┘
                            │  POST https://<n8n>/webhook/feedback
                            │  Body: FeedbackPayload  (JSON)
                            ▼
┌───────────────────────────────────────────────────────────────────┐
│ n8n workflow "feedback-consumer"                                  │
│                                                                   │
│   ┌──────────────┐  shared secret header check                    │
│   │ Webhook node │  rejects 401 if absent / wrong                 │
│   └──────┬───────┘                                                │
│          ▼                                                        │
│   ┌──────────────┐  ajv-style JSON schema check                   │
│   │ Validate     │  rejects 400 on shape mismatch                 │
│   └──────┬───────┘                                                │
│          ▼                                                        │
│   ┌──────────────┐  port: ConfigSource                            │
│   │ ConfigSource │  adapter (MVP): YamlFromGitHub                 │
│   │   .get(id)   │  returns { owner, repo, projectNodeId,         │
│   └──────┬───────┘    labelsByCategory, labelsBySubCategory,      │
│          │             channel, locale }                          │
│          ▼                                                        │
│   ┌──────────────┐  port: LLMGateway                              │
│   │ LLMGateway   │  adapter (MVP): Template                       │
│   │  .draft(...) │  returns { title, body, labels }               │
│   └──────┬───────┘                                                │
│          ▼                                                        │
│   ┌──────────────┐  port: IssueTracker                            │
│   │ IssueTracker │  adapter (MVP): GitHubIssueTracker             │
│   │  .create()   │  returns { issueUrl, issueNodeId }             │
│   └──────┬───────┘                                                │
│          ▼                                                        │
│   ┌──────────────┐  port: NotificationChannel                     │
│   │ Channel      │  adapter (MVP): Telegram                       │
│   │  .send()     │  returns void                                  │
│   └──────────────┘                                                │
└───────────────────────────────────────────────────────────────────┘
```

Every node below the webhook depends on a **port**. Replacing an
adapter is a configuration change, not a code change.

## Payload contract

The widget POSTs a single JSON body. The current source-of-truth type
lives in [`packages/core/src/domain/Feedback.ts`](../../packages/core/src/domain/Feedback.ts)
and uses a nested shape (`{ schemaVersion, meta, identity, context,
content }`). The block below is the **proposed v0.3.0 flat contract**
that this design targets — adopting it is part of Sprint 4 (widget
v0.3.0 — sub-category taxonomy + auto-capture, issue #-to-be-opened).
Until that ships, consumers read the current nested shape; the n8n
pipeline will map v0.2.0 payloads to this target shape at the
`Validate` node during the transition.

```ts
// Proposed v0.3.0 contract — to land in packages/core/src/ports/FeedbackPayload.ts
type FeedbackPayload = {
  // user-provided (required)
  projectId: string // e.g. "brasse-bouillon"
  category: TopLevelCategory
  // category values: "bug" | "typo" | "error" | "ambiguous" | "suggestion" | "other"
  subCategory: string | null // null only when category === "other"
  message: string // free-text body, 10-2000 chars
  reporterName: string | null // optional self-identification, else null

  // auto-captured by the widget (required)
  url: string // location.href at submit
  referrer: string | null // document.referrer or null
  userAgent: string // navigator.userAgent
  viewport: { w: number; h: number }
  locale: string // navigator.language, BCP-47
  timestamp: string // ISO 8601 UTC
  widgetVersion: string // e.g. "0.3.0"
  scrollDepth: number // 0.0 - 1.0
  sessionId: string // anonymous UUID, session-scoped
}
```

See [`projects-yaml-schema.md`](./projects-yaml-schema.md) §Categories
for the canonical `category` × `subCategory` enum.

## Ports and adapters

Each port is a minimal interface. Adapters own all SaaS-specific
concerns (auth, retries, rate limits, payload shapes).

### `ConfigSource`

```ts
interface ConfigSource {
  get(projectId: string): Promise<ProjectConfig>
}
```

- **MVP adapter — `YamlFromGitHub`** — fetches
  `https://raw.githubusercontent.com/benoit-bremaud/feedback-widget/main/pipelines/projects.yaml`
  with a fine-grained PAT (scopes: `Contents: read` on this repo),
  parses YAML, returns the entry for `projectId` or throws
  `ProjectNotFound`. Caches the parsed result in n8n static data with a
  60-second TTL so a burst of feedbacks doesn't hammer `raw.githubusercontent`.
- **Future adapters** — `PostgresConfigSource` (if multi-tenant ever
  becomes real), `EnvVarConfigSource` (for single-project tests).

### `LLMGateway`

```ts
interface LLMGateway {
  draft(
    payload: FeedbackPayload,
    project: ProjectConfig,
  ): Promise<{
    title: string
    body: string
    labels: string[]
  }>
}
```

- **MVP adapter — `TemplateLLMGateway`** — no AI. Title follows
  `[{category}] {first sentence of message, truncated 70}`; body is
  the message plus an auto-capture metadata block; labels come from
  `project.labelsByCategory[category]` + `project.labelsBySubCategory[subCategory]`
  (deduped).
- **Future adapters** — `ClaudeLLMGateway` (Claude Sonnet for richer
  titles + severity inference), `MistralLLMGateway`, `OllamaLLMGateway`
  (local). Swapped via a single config flag in n8n static data.

### `IssueTracker`

```ts
interface IssueTracker {
  create(
    draft: { title: string; body: string; labels: string[] },
    project: ProjectConfig,
  ): Promise<{ issueUrl: string; issueNodeId: string }>
}
```

- **MVP adapter — `GitHubIssueTracker`** — POSTs to
  `repos/{owner}/{repo}/issues`, then adds the created issue to
  `project.projectNodeId` via the GraphQL `addProjectV2ItemById`
  mutation (same pattern used by this repo's issue workflow).
- **Future adapters** — `LinearIssueTracker`, `JiraIssueTracker`.

### `NotificationChannel`

```ts
interface NotificationChannel {
  send(
    message: {
      summary: string
      actions: Array<{ label: string; url: string }>
    },
    channel: ChannelConfig,
  ): Promise<void>
}
```

- **MVP adapter — `TelegramChannel`** — uses the
  [Bot API `sendMessage`](https://core.telegram.org/bots/api#sendmessage)
  with an inline keyboard carrying one "Open issue" button. The
  `channel.chatId` from YAML is the chat id (can be negative for
  groups).
- **Future adapters** — `DiscordChannel` (webhook), `SlackChannel`
  (webhook), `EmailChannel` (SMTP), `WebhookChannel` (generic).

## Error handling

- **Widget side** — `LocalStorageOutbox` (already shipped) retries
  failed POSTs for 7 days with exponential backoff, then falls back
  to `mailtoFallback` per project. No new code for MVP.
- **n8n side** — every adapter node has a retry-on-error binding
  (2 retries, 30s backoff). Webhook returns 2xx only after all
  side-effects succeed (issue created + notification sent); a
  partial failure returns 500 and the widget retries from its
  outbox.
- **Healthcheck alerting** — **deferred**. The user has a separate,
  unrelated issue with missing n8n heartbeats on the homelab — that
  gets its own fix in `n8n-kaggle-watcher` and becomes a dependency
  for going live.

## Open questions (user audit pending)

The Phase B debrief left seven infra questions open (Q1-Q7). They do
not affect this design but will pin down concrete values in the n8n
node configuration once answered:

1. n8n URL exposed to the widget (Cloudflare Tunnel? custom domain?)
2. n8n deployment mode (Docker? systemd?) and version
3. Homelab domain reuse
4. Telegram bot reuse vs fresh
5. Telegram chat vs dedicated private channel
6. GitHub PAT availability (scopes `repo` + `project`)
7. Existing reverse proxy

The full Phase B debrief status (including these seven questions) is
currently tracked outside this repository and will be captured in an
in-repo issue or design note once the infra audit is complete.

## Out of scope

- Multi-tenancy / SaaS productisation.
- LLM-based severity inference (deferred to post-MVP).
- Real-time queue (websocket / SSE) — a POST request is enough at
  15 feedbacks/week.
- Analytics pipeline (feedback funnel, resolution time). Might land
  later as a read model over the GitHub Issue set.
