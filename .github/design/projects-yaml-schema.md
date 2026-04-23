# `projects.yaml` schema — design

Status: **design draft**, not yet implemented. Companion doc:
[`n8n-pipeline.md`](./n8n-pipeline.md).

## Goal

Define the contract between the widget's runtime `projectId` string
and the concrete routing decisions the n8n pipeline needs to make
(which repo, which project board, which labels, which channel). Keep
that contract in git, versionable, and swappable (`ConfigSource`
port) without touching workflow code.

## Location and fetch

- **Canonical path** — `pipelines/projects.yaml` at the root of the
  `feedback-widget` repo (this repo).
- **Fetched by** — the n8n `ConfigSource` adapter
  `YamlFromGitHub` (see [`n8n-pipeline.md`](./n8n-pipeline.md#configsource)).
- **Fetch URL** —
  `https://raw.githubusercontent.com/benoit-bremaud/feedback-widget/main/pipelines/projects.yaml`.
- **Auth** — fine-grained PAT on the n8n credential, scoped
  `Contents: read` on `benoit-bremaud/feedback-widget`. Stored as
  `GITHUB_RAW_PAT` in n8n credentials.
- **Cache** — 60 s TTL in n8n workflow static data to absorb bursts.

## Schema

### File shape

```yaml
version: 1
projects:
  - id: <string> # widget projectId, used as the key
    owner: <string> # GitHub owner/org
    repo: <string> # GitHub repo name
    projectNodeId: <string> # GitHub Project v2 node ID
    locale: <BCP-47> # fallback if widget payload has none
    labelsByCategory:
      bug: [<label>, ...]
      typo: [<label>, ...]
      error: [<label>, ...]
      ambiguous: [<label>, ...]
      suggestion: [<label>, ...]
      other: [<label>, ...]
    labelsBySubCategory:
      <subCategory>: [<label>, ...]
      # every sub-category from the taxonomy is allowed as a key;
      # missing keys fall back to an empty list (no extra labels).
    channel:
      kind: telegram | discord | slack | email | webhook
      # telegram-specific:
      chatId: <number> # negative for group chats
      # discord-specific (future):
      # webhookUrl: <string>
      # etc.
```

### TypeScript shape (source-of-truth type)

Will live in `packages/core/src/ports/ProjectConfig.ts` once the pipeline
is implemented. Reproduced here for the design doc:

```ts
type TopLevelCategory =
  | 'bug'
  | 'typo'
  | 'error'
  | 'ambiguous'
  | 'suggestion'
  | 'other'

type ChannelConfig =
  | { kind: 'telegram'; chatId: number }
  | { kind: 'discord'; webhookUrl: string }
  | { kind: 'slack'; webhookUrl: string }
  | { kind: 'email'; to: string; from: string }
  | { kind: 'webhook'; url: string; headerSecret?: string }

type ProjectConfig = {
  id: string
  owner: string
  repo: string
  projectNodeId: string
  locale: string
  labelsByCategory: Record<TopLevelCategory, string[]>
  labelsBySubCategory: Record<string, string[]>
  channel: ChannelConfig
}

type ProjectsFile = {
  version: 1
  projects: ProjectConfig[]
}
```

## Categories (canonical taxonomy)

Locked by the Phase B debrief, Q9 (2026-04-24). Every widget v0.3.0+
release ships these six top-level categories, each with a small set of
sub-categories. The pipeline doc, widget doc, and labels on every
consumer repo stay in lockstep with this list.

| Top-level    | Sub-categories                                                                   |
| ------------ | -------------------------------------------------------------------------------- |
| `bug`        | `crash`, `broken-feature`, `visual-glitch`, `wrong-output`, `regression`         |
| `typo`       | `prose`, `code-sample`, `heading`, `link-text`, `alt-text`                       |
| `error`      | `js-console`, `http-404`, `http-5xx`, `broken-link`, `missing-asset`             |
| `ambiguous`  | `wording`, `navigation`, `terminology`, `example-unclear`, `missing-context`     |
| `suggestion` | `new-feature`, `improvement`, `new-example`, `content-refactor`, `accessibility` |
| `other`      | _(none — free text only)_                                                        |

Adding a sub-category is **non-breaking** — widget and pipeline treat
unknown keys as fall-back to empty labels. Removing or renaming a
sub-category is **breaking** and requires a widget major bump.

## Example

Illustrative starter example for the three POC sites (brasse-bouillon,
Impropedia, audit-nvnc). This shows what the future
`pipelines/projects.yaml` could look like and is not yet committed.
`labelsBySubCategory` only lists the entries where sub-category
granularity actually maps to a distinct label today — the rest fall
back to the top-level label alone.

```yaml
version: 1
projects:
  - id: brasse-bouillon
    owner: benoit-bremaud
    repo: brasse-bouillon
    projectNodeId: PVT_kwHOB8rwIc4XXXXXXX # to fill at J1
    locale: fr-FR
    labelsByCategory:
      bug: [type:bug]
      typo: [type:docs, area:content]
      error: [type:bug, area:ci]
      ambiguous: [type:docs, area:content]
      suggestion: [type:feature]
      other: [type:task]
    labelsBySubCategory:
      crash: [prio:P0]
      http-5xx: [prio:P0]
      regression: [prio:P1]
      accessibility: [area:a11y]
    channel:
      kind: telegram
      chatId: -1000000000000 # to fill at J1

  - id: impropedia
    owner: benoit-bremaud
    repo: Impropedia
    projectNodeId: PVT_kwHOB8rwIc4BRr1sQ # existing project #47
    locale: fr-FR
    labelsByCategory:
      bug: [type:bug]
      typo: [type:docs]
      error: [type:bug]
      ambiguous: [type:docs]
      suggestion: [type:feature]
      other: [type:task]
    labelsBySubCategory:
      crash: [prio:P0]
      accessibility: [area:a11y]
    channel:
      kind: telegram
      chatId: -1000000000000

  - id: audit-nvnc
    owner: benoit-bremaud
    repo: audit-nvnc
    projectNodeId: PVT_kwHOB8rwIc4BVe-g # project #54, node ID from 2026-04-24
    locale: fr-FR
    labelsByCategory:
      bug: [type:bug]
      typo: [type:docs]
      error: [type:bug, area:ci]
      ambiguous: [type:docs]
      suggestion: [type:feature]
      other: [type:task]
    labelsBySubCategory:
      crash: [prio:P0]
      http-5xx: [prio:P0]
      regression: [prio:P1]
    channel:
      kind: telegram
      chatId: -1000000000000
```

## Validation

- **At commit time** — a CI job validates `pipelines/projects.yaml`
  on every push that touches it. Two layers:
  1. **Standard draft-07 check (Ajv)** against the schema below —
     catches missing required fields, wrong types, missing top-level
     category in `labelsByCategory`, unknown sub-category key in
     `labelsBySubCategory`, and `channel.kind` outside the allowed
     enum (via `propertyNames` + `oneOf`).
  2. **Uniqueness check (custom script)** — a short Node script
     asserts `projects[*].id` values are unique. JSON Schema
     draft-07 cannot express "unique value of a specific property
     across array items"; we enforce it in code rather than rely on
     the Ajv-extension `uniqueItemProperties` keyword, which is not
     part of draft-07.
- **At fetch time (n8n)** — `YamlFromGitHub.get()` runs the same
  two checks before returning. A broken file causes a 500 at the
  webhook; the widget retries via its outbox.

### JSON Schema (draft-07)

Skeleton for the CI check. Will ship as
`pipelines/projects.schema.json` next to the YAML.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["version", "projects"],
  "properties": {
    "version": { "const": 1 },
    "projects": {
      "type": "array",
      "$comment": "Uniqueness of projects[*].id is enforced by a separate CI script because JSON Schema draft-07 cannot express uniqueness of a specific property across array items.",
      "items": {
        "type": "object",
        "required": [
          "id",
          "owner",
          "repo",
          "projectNodeId",
          "locale",
          "labelsByCategory",
          "labelsBySubCategory",
          "channel"
        ],
        "properties": {
          "id": { "type": "string", "pattern": "^[a-z][a-z0-9-]*$" },
          "owner": { "type": "string" },
          "repo": { "type": "string" },
          "projectNodeId": { "type": "string", "pattern": "^PVT_" },
          "locale": { "type": "string" },
          "labelsByCategory": {
            "type": "object",
            "required": [
              "bug",
              "typo",
              "error",
              "ambiguous",
              "suggestion",
              "other"
            ],
            "additionalProperties": false,
            "patternProperties": {
              "^(bug|typo|error|ambiguous|suggestion|other)$": {
                "type": "array",
                "items": { "type": "string" }
              }
            }
          },
          "labelsBySubCategory": {
            "type": "object",
            "propertyNames": {
              "enum": [
                "crash",
                "broken-feature",
                "visual-glitch",
                "wrong-output",
                "regression",
                "prose",
                "code-sample",
                "heading",
                "link-text",
                "alt-text",
                "js-console",
                "http-404",
                "http-5xx",
                "broken-link",
                "missing-asset",
                "wording",
                "navigation",
                "terminology",
                "example-unclear",
                "missing-context",
                "new-feature",
                "improvement",
                "new-example",
                "content-refactor",
                "accessibility"
              ]
            },
            "additionalProperties": {
              "type": "array",
              "items": { "type": "string" }
            }
          },
          "channel": {
            "oneOf": [
              {
                "type": "object",
                "required": ["kind", "chatId"],
                "properties": {
                  "kind": { "const": "telegram" },
                  "chatId": { "type": "number" }
                }
              },
              {
                "type": "object",
                "required": ["kind", "webhookUrl"],
                "properties": {
                  "kind": { "enum": ["discord", "slack"] },
                  "webhookUrl": { "type": "string", "format": "uri" }
                }
              },
              {
                "type": "object",
                "required": ["kind", "to", "from"],
                "properties": {
                  "kind": { "const": "email" },
                  "to": { "type": "string" },
                  "from": { "type": "string" }
                }
              },
              {
                "type": "object",
                "required": ["kind", "url"],
                "properties": {
                  "kind": { "const": "webhook" },
                  "url": { "type": "string", "format": "uri" },
                  "headerSecret": { "type": "string" }
                }
              }
            ]
          }
        }
      }
    }
  }
}
```

## Evolution and compatibility

- **Add a field on `ProjectConfig`** — non-breaking. n8n adapters
  ignore unknown fields; widget payload is orthogonal.
- **Add a new `channel.kind`** — non-breaking. Old n8n workflows
  without the matching adapter reject the config as "unsupported
  channel kind" (explicit error, not silent).
- **Add a new top-level category** — **breaking for the widget**
  (requires a major bump because widget v0.3.0 exposes a fixed UI
  list). Pipeline side is resilient (defaults to top-level label only).
- **Rename or remove a category / sub-category** — **breaking
  everywhere**. Bump both widget major and `version` in the YAML.
- **Bump `version` to 2** — reserved for a breaking schema change.
  `YamlFromGitHub.get()` refuses any `version` it doesn't understand,
  returning the health check as unhealthy rather than silently routing
  with a mismatched schema.

## Security

- **Do not commit channel secrets** — `chatId` is not a secret
  (knowing it doesn't let an attacker post to the chat; the bot token
  does). The Telegram bot token lives only in n8n credentials, never
  in YAML.
- **Do not commit PATs** — the PAT used by `YamlFromGitHub` to read
  this file lives in n8n credentials, not in any repo file. Rotated
  every 90 days per the repo rotation policy.
- **Public visibility of the repo** — once the widget goes public,
  `projects.yaml` will be visible to anyone. That is fine: it only
  contains `owner/repo/projectNodeId/chatId`, which are already public
  or inferable. Any real secret stays out of git by design.

## Out of scope

- Dynamic per-project config UI (overriding labels, severity rules
  per sub-category, etc.) — might land when the pipeline hosts more
  than three projects.
- Multi-language label routing (French labels on `fr-FR`, English on
  `en-US`). Today all labels are English and stable regardless of
  widget locale.
