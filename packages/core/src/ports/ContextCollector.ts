import type { BrowserContext } from '../domain/Feedback'

// Port that produces the browser-side context attached to every
// feedback submission. Adapters live in package-specific consumers
// (e.g. `BrowserContextCollector` in `@benoit-bremaud/feedback-widget`
// reads from `window` / `navigator` / `document`). The core package
// stays runtime-agnostic.
export interface ContextCollector {
  collect(): BrowserContext
}
