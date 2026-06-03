# Sequence diagram — widget config v0.5.0 — mount wiring

> **Feature**: how the four resolved v0.5.0 config fields (`rootSelector`,
> `theme`, `locale`, `storageNamespace`) reach their adapters at mount time.
> **Companion**: [`01-class.md`](./01-class.md).

## Context

`mountFeedbackWidget` is the composition root. After `resolveConfig` fills
defaults, each field is wired to exactly one collaborator:

- `locale` → selects a `Messages` bundle from `LOCALES` (default `'fr'`), handed
  to the view and used by the controller for transport/error strings.
- `theme` → passed to the view, which reflects it as a `data-theme` attribute
  that drives the Shadow-DOM CSS variables (absent/`null` = light, unchanged).
- `rootSelector` → passed to the viewport detector, which still owns the default
  (`?? 'main'`), so the default lives in one place.
- `storageNamespace` → prefixes the rate-limiter and outbox localStorage keys
  (default `'feedback-widget'`, configurable per host). No legacy/branded
  namespace remains in the code.

## Diagram (Mermaid)

```mermaid
sequenceDiagram
  participant Host as Host app
  participant M as mountFeedbackWidget
  participant RC as resolveConfig (core)
  participant View as WebComponentView
  participant Det as ViewportDetector
  participant RL as RateLimiter + Outbox

  Host->>M: mountFeedbackWidget(config)
  M->>RC: resolveConfig(config)
  RC-->>M: { rootSelector, theme, locale, storageNamespace, … }
  M->>M: messages = LOCALES[locale]  (default 'fr')
  M->>View: setOptions({ messages, theme, … })
  Note over View: theme → data-theme attr<br/>messages → all labels/strings
  M->>Det: create({ doc, win, rootSelector })
  Note over Det: rootSelector ?? 'main'
  M->>RL: keys `${storageNamespace}.${projectId}` (+ .outbox)
  Note over RL: namespace default 'feedback-widget'
```

## Diagram (PlantUML)

```plantuml
@startuml widget-config-v0.5.0-mount
participant "Host app" as Host
participant "mountFeedbackWidget" as M
participant "resolveConfig (core)" as RC
participant "WebComponentView" as View
participant "ViewportDetector" as Det
participant "RateLimiter + Outbox" as RL

Host -> M : mountFeedbackWidget(config)
M -> RC : resolveConfig(config)
RC --> M : { rootSelector, theme, locale, storageNamespace, ... }
M -> M : messages = LOCALES[locale]\n(default 'fr')
M -> View : setOptions({ messages, theme, ... })
note over View : theme -> data-theme attr\nmessages -> all labels/strings
M -> Det : create({ doc, win, rootSelector })
note over Det : rootSelector ?? 'main'
M -> RL : keys `${storageNamespace}.${projectId}` (+ .outbox)
note over RL : namespace default 'feedback-widget'
@enduml
```

## Notes

- `resolveConfig` is the gatekeeper: a field absent from its mapping is dropped
  before it reaches any collaborator.
- No payload field changes → the Worker ingest contract is unaffected.
