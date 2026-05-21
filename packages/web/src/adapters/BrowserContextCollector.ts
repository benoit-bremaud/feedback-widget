import type {
  BrowserContext,
  ContextCollector,
} from '@benoit-bremaud/feedback-widget-core'

export interface BrowserContextCollectorOptions {
  projectId: string
  widgetVersion: string
  // Injectable for tests; default to the live globals at call time.
  win?: Window
  doc?: Document
  // Stable per-widget-instance session id. Generated once by the
  // composition root so every submission in a session shares it.
  sessionId: string
}

// Reads the 10 auto-capture fields from the browser environment.
// Every individual read is defensive: a missing or throwing global
// degrades to a safe default rather than aborting the whole
// collection, because losing one context field must never block a
// user's feedback from being sent.
export function createBrowserContextCollector(
  options: BrowserContextCollectorOptions,
): ContextCollector {
  const { projectId, widgetVersion, sessionId } = options

  return {
    collect(): BrowserContext {
      const win = options.win ?? globalThis.window
      const doc = options.doc ?? globalThis.document
      // Prefer the navigator hanging off the injected window (testable);
      // fall back to the global navigator in production.
      const nav: Navigator | undefined =
        win?.navigator ??
        (typeof navigator !== 'undefined' ? navigator : undefined)

      return {
        projectId,
        url: readUrl(win),
        referrer: readReferrer(doc),
        userAgent: nav?.userAgent ?? '',
        viewport: readViewport(win),
        locale: nav?.language ?? '',
        timestamp: new Date().toISOString(),
        widgetVersion,
        scrollDepth: readScrollDepth(win, doc),
        sessionId,
      }
    },
  }
}

function readUrl(win: Window | undefined): string {
  return win?.location?.href ?? ''
}

function readReferrer(doc: Document | undefined): string | null {
  const ref = doc?.referrer
  return ref ? ref : null
}

function readViewport(win: Window | undefined): { w: number; h: number } {
  return {
    w: win?.innerWidth ?? 0,
    h: win?.innerHeight ?? 0,
  }
}

// Fraction of the page scrolled, clamped to [0, 1]. A page shorter
// than the viewport (nothing to scroll) reports 0.
function readScrollDepth(
  win: Window | undefined,
  doc: Document | undefined,
): number {
  const scrollY = win?.scrollY ?? 0
  const viewportH = win?.innerHeight ?? 0
  const docEl = doc?.documentElement
  const scrollH = docEl?.scrollHeight ?? 0
  const scrollable = scrollH - viewportH
  if (scrollable <= 0) {
    return 0
  }
  const depth = scrollY / scrollable
  return Math.min(1, Math.max(0, Number(depth.toFixed(4))))
}
