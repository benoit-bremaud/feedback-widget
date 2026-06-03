# Class diagram — widget config v0.5.0 — multi-project reusability fields

> **Feature**: v0.5.0 adds four optional, backward-compatible `WidgetConfig`
> fields so the widget can be dropped into any host (not just Impropedia):
> `rootSelector`, `theme`, `locale`, `storageNamespace`.
> **Companion**: [`02-sequence.md`](./02-sequence.md) (mount wiring).

## Context

All four fields are **optional** → adding them is a **MINOR** bump (0.4.0 →
0.5.0). The contract that matters: `ResolvedWidgetConfig` is built by
`resolveConfig`, which **only copies the keys it knows about** — so every new
field must be threaded through `resolveConfig` or it is silently dropped before
reaching the adapters. Nullable fields (no sensible non-null default) join the
`Omit<…>` group alongside `token`; `locale`/`storageNamespace` get real
defaults (`'fr'`, `'feedback-widget'`) that preserve v0.4.0 behaviour.

`Messages` + `LOCALES` are the new i18n seam (web package). The resolved
`locale` selects one `Messages` bundle, which is handed to the view via
`WidgetViewOptions.messages` and used directly by the controller for its
transport/error strings.

## Diagram (Mermaid)

```mermaid
classDiagram
  class WidgetConfig {
    <<interface, core>>
    +string endpoint
    +string projectId
    +string? token
    +TopLevelCategory[]? categories
    +number? maxMessageLength
    +number? rateLimitWindowMs
    +number? rateLimitMaxAttempts
    +number? minFormOpenMs
    +number? maxTransportAttempts
    +number? transportTimeoutMs
    +string? mailtoFallback
    +Position? position
    +string? rootSelector
    +Theme? theme
    +Locale? locale
    +string? storageNamespace
  }

  class ResolvedWidgetConfig {
    <<interface, core>>
    +string|null token
    +string|null rootSelector
    +Theme|null theme
    +Locale locale = 'fr'
    +string storageNamespace = 'feedback-widget'
    +... required others
  }

  class Theme {
    <<type, core>>
    'dark' | 'light'
  }
  class Locale {
    <<type, core>>
    'fr' | 'en'
  }

  class Messages {
    <<interface, web>>
    +trigger / chrome strings
    +Record~TopLevelCategory,string~ categoryLabels
    +Record~SubCategory,string~ subCategoryLabels
    +transport/error strings
    +mailtoSubject
  }
  class LOCALES {
    <<const, web>>
    +Record~Locale, Messages~
  }

  class WidgetViewOptions {
    <<interface, web>>
    +number maxMessageLength
    +TopLevelCategory[] categories
    +Position position
    +Theme|null theme
    +Messages messages
  }

  WidgetConfig --> ResolvedWidgetConfig : resolveConfig()
  ResolvedWidgetConfig --> Locale : selects
  Locale --> Messages : LOCALES[locale]
  Messages --> WidgetViewOptions : injected as messages
  ResolvedWidgetConfig ..> Theme : forwards
  WidgetViewOptions ..> Theme : data-theme attr
```

## Diagram (PlantUML)

```plantuml
@startuml widget-config-v0.5.0-class
hide empty members
skinparam classAttributeIconSize 0

interface WidgetConfig <<core>> {
  +endpoint : string
  +projectId : string
  +token? : string
  +categories? : TopLevelCategory[]
  +maxMessageLength? : number
  +rateLimitWindowMs? : number
  +rateLimitMaxAttempts? : number
  +minFormOpenMs? : number
  +maxTransportAttempts? : number
  +transportTimeoutMs? : number
  +mailtoFallback? : string
  +position? : Position
  .. v0.5.0 ..
  +rootSelector? : string
  +theme? : Theme
  +locale? : Locale
  +storageNamespace? : string
}

interface ResolvedWidgetConfig <<core>> {
  +token : string | null
  +rootSelector : string | null
  +theme : Theme | null
  +locale : Locale = 'fr'
  +storageNamespace : string = 'feedback-widget'
  +.. required others ..
}

enum Theme <<core>> {
  dark
  light
}
enum Locale <<core>> {
  fr
  en
}

interface Messages <<web>> {
  +trigger / chrome strings
  +categoryLabels : Record<TopLevelCategory, string>
  +subCategoryLabels : Record<SubCategory, string>
  +transport / error strings
  +mailtoSubject : string
}

class LOCALES <<const, web>> {
  +Record<Locale, Messages>
}

interface WidgetViewOptions <<web>> {
  +maxMessageLength : number
  +categories : TopLevelCategory[]
  +position : Position
  +theme : Theme | null
  +messages : Messages
}

WidgetConfig ..> ResolvedWidgetConfig : resolveConfig()
ResolvedWidgetConfig --> Locale : selects
Locale --> Messages : LOCALES[locale]
Messages --> WidgetViewOptions : injected as messages
ResolvedWidgetConfig ..> Theme : forwards
WidgetViewOptions ..> Theme : data-theme attr
@enduml
```

## Notes

- `rootSelector` is forwarded to `createIntersectionViewportDetector` (web) which
  already defaults it to `'main'` — the default stays in **one** place, so the
  resolved value is `string | null` and the adapter receives `?? undefined`.
- Icons in `categoryLabels`/`subCategoryLabels` stay hardcoded (locale-neutral);
  only the text `label` is translated.
- No field touches `FeedbackPayload` → the Worker ingest contract is unchanged.
