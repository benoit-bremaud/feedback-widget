import {
  extractExcerpt,
  pickBestCandidate,
  type FeedbackTarget,
  type ViewportDetector,
} from '@benoit-bremaud/feedback-widget-core'

/** Dependencies of `createIntersectionViewportDetector`. `doc` and `win` are injected for tests; the selector and class options default to built-in values. */
export interface IntersectionViewportDetectorDeps {
  rootSelector?: string
  targetSelectors?: string
  highlightClass?: string
  pointingClass?: string
  doc: Document
  win: Window
}

const DEFAULT_SELECTORS =
  'p, li, h1, h2, h3, h4, h5, h6, blockquote, figure, table, pre'
const DEFAULT_ROOT = 'body'
const HIGHLIGHT_CLASS = 'fw-highlight'
const POINTING_CLASS = 'fw-pointing'

// Activating events neutralised (capture phase) while pointing, so the
// targeted element's own behaviour never fires during selection.
const POINTING_EVENTS = ['pointerdown', 'mousedown', 'click'] as const
// When the click lands inside one of these, pick the interactive
// ancestor rather than the inner descendant (e.g. an icon in a button).
// Deliberately restricted to genuine interactive controls — NOT a bare
// `[role]` / `[tabindex]`, which would also match ARIA landmark/region
// containers (role="region", role="main", focus-managed wrappers) and
// misattribute a click on an inner element to that wrapper.
const INTERACTIVE_SELECTORS = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  'label',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="option"]',
].join(', ')
// The widget's own custom element — never a valid feedback target.
const WIDGET_HOST_TAG = 'feedback-widget'
// Upper bound for a target's human-readable label / excerpt fields.
const LABEL_MAX_LENGTH = 120
// Cap on the depth of a generated CSS selector path.
const SELECTOR_MAX_DEPTH = 5

/**
 * `ViewportDetector` built on `IntersectionObserver`: tracks the most visible block under the root element and offers a pointing mode to pick any element.
 *
 * Targets never carry form-field values and the widget's own element is never targetable. `destroy` removes every listener, the observer and the injected style node.
 */
export function createIntersectionViewportDetector(
  deps: IntersectionViewportDetectorDeps,
): ViewportDetector {
  const doc = deps.doc
  const win = deps.win
  const rootSelector = deps.rootSelector ?? DEFAULT_ROOT
  const targetSelectors = deps.targetSelectors ?? DEFAULT_SELECTORS
  const highlightClass = deps.highlightClass ?? HIGHLIGHT_CLASS
  const pointingClass = deps.pointingClass ?? POINTING_CLASS

  const visibleById = new Map<
    string,
    { element: Element; visibleRatio: number }
  >()
  let observer: IntersectionObserver | null = null
  let pointingHandler: ((ev: Event) => void) | null = null
  let currentHighlighted: Element | null = null
  let styleNode: HTMLStyleElement | null = null

  const ensureStyles = (): void => {
    if (styleNode) return
    styleNode = doc.createElement('style')
    styleNode.dataset.feedbackWidget = 'runtime-styles'
    styleNode.textContent = `
      .${highlightClass} {
        outline: 3px solid #c8102e !important;
        outline-offset: 4px !important;
        border-radius: 4px !important;
        animation: fw-pulse 1.6s ease-in-out infinite !important;
      }
      @keyframes fw-pulse {
        0%, 100% { outline-color: rgba(200, 16, 46, 0.95); }
        50%      { outline-color: rgba(200, 16, 46, 0.35); }
      }
      .${pointingClass} * {
        cursor: pointer !important;
        transition: background-color 120ms ease !important;
      }
      .${pointingClass} *:hover {
        background-color: rgba(200, 16, 46, 0.08) !important;
      }
      @media (prefers-reduced-motion: reduce) {
        .${highlightClass} { animation: none !important; }
      }
    `
    doc.head.appendChild(styleNode)
  }

  const getRoot = (): Element => {
    // An integrator-supplied rootSelector may be an invalid CSS selector;
    // querySelector throws a SyntaxError on those. Fall back to body (same as
    // the not-found case) so a bad selector never breaks mount.
    try {
      return doc.querySelector(rootSelector) ?? doc.body
    } catch {
      return doc.body
    }
  }

  const elementToTarget = (element: Element): FeedbackTarget => {
    const heading = findParentHeading(element)
    const text = element.textContent ?? ''

    return {
      tag: element.tagName.toLowerCase(),
      label: accessibleLabel(element),
      selector: computeSelector(element),
      headingText: heading?.textContent?.trim() ?? null,
      excerpt: extractExcerpt(text),
    }
  }

  const highlight = (element: Element | null): void => {
    if (currentHighlighted && currentHighlighted !== element) {
      currentHighlighted.classList.remove(highlightClass)
    }
    currentHighlighted = element
    if (element) {
      element.classList.add(highlightClass)
    }
  }

  const startObserving = (): void => {
    // Always (re)build: on SPA navigation, the previous targets belong to
    // the replaced DOM and must be rescanned.
    observer?.disconnect()
    visibleById.clear()
    ensureStyles()

    const root = getRoot()
    const targets = Array.from(root.querySelectorAll(targetSelectors))
    targets.forEach((el, idx) => {
      if (!el.id) {
        el.setAttribute('data-fw-id', `fw-${idx}`)
      }
    })

    observer = new (win as Window & typeof globalThis).IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = idOf(entry.target)
          if (!id) return
          if (entry.isIntersecting) {
            visibleById.set(id, {
              element: entry.target,
              visibleRatio: entry.intersectionRatio,
            })
          } else {
            visibleById.delete(id)
          }
        })
      },
      {
        root: null,
        threshold: [0, 0.25, 0.5, 0.75, 1.0],
        rootMargin: '-20% 0px -20% 0px',
      },
    )

    targets.forEach((el) => observer?.observe(el))
  }

  const stopObserving = (): void => {
    observer?.disconnect()
    observer = null
    visibleById.clear()
    highlight(null)
  }

  const getCurrentTarget = (): FeedbackTarget | null => {
    if (visibleById.size === 0) return null

    const viewportHeight = win.innerHeight
    const candidates = Array.from(visibleById.values()).map(({ element }) => {
      const rect = element.getBoundingClientRect()
      return {
        id: idOf(element) ?? '',
        top: rect.top,
        bottom: rect.bottom,
        height: rect.height,
      }
    })

    const best = pickBestCandidate(candidates, {
      top: 0,
      bottom: viewportHeight,
      height: viewportHeight,
    })

    if (!best) return null

    const entry = visibleById.get(best.id)
    if (!entry) return null

    highlight(entry.element)
    return elementToTarget(entry.element)
  }

  const enablePointingMode = (
    onPick: (target: FeedbackTarget) => void,
  ): void => {
    // Guard against re-entry: if a previous listener is still installed
    // (rapid double-click on « Choisir un autre »), remove it first.
    disablePointingMode()

    ensureStyles()
    getRoot().classList.add(pointingClass)
    highlight(null)

    // While pointing, ANY element under the root is a valid target — not
    // just content blocks — so the user can report on a button, link,
    // input, etc. We intercept the activating events (pointerdown,
    // mousedown, click) in the capture phase and neutralise them so the
    // element's own behaviour (navigation, form submit, onclick) never
    // fires while the user is merely selecting it. We pick on `click`.
    pointingHandler = (ev: Event) => {
      const raw = ev.target as Element | null
      if (!raw) return
      const root = getRoot()
      // Never intercept the widget's own UI (its cancel button lives in
      // the host element's shadow DOM; clicks on it retarget to the host).
      if (raw.closest(WIDGET_HOST_TAG)) return

      // preventDefault stops the default action (navigation, submit);
      // stopImmediatePropagation stops every other listener too — including
      // app-level capture handlers delegated on `document` — so nothing the
      // page wired up runs while the user is merely selecting an element.
      // Swallowed everywhere, not only under the root: a click outside it
      // (header, footer) must not navigate away and drop the draft (#135).
      ev.preventDefault()
      ev.stopImmediatePropagation()
      if (ev.type !== 'click' || !root.contains(raw)) return

      // Prefer the nearest interactive ancestor when the click lands on a
      // descendant (e.g. an icon inside a button) — but only if that
      // ancestor is still inside the root, otherwise keep the clicked
      // element (closest() can walk above the root, e.g. <body role=…>).
      const ancestor = raw.closest(INTERACTIVE_SELECTORS)
      const picked = ancestor && root.contains(ancestor) ? ancestor : raw
      highlight(picked)
      onPick(elementToTarget(picked))
    }

    const handler = pointingHandler
    POINTING_EVENTS.forEach((type) =>
      doc.addEventListener(type, handler, { capture: true }),
    )
  }

  const disablePointingMode = (): void => {
    getRoot().classList.remove(pointingClass)
    if (pointingHandler) {
      const handler = pointingHandler
      POINTING_EVENTS.forEach((type) =>
        doc.removeEventListener(type, handler, { capture: true }),
      )
      pointingHandler = null
    }
  }

  const clearHighlight = (): void => {
    highlight(null)
  }

  const refresh = (): void => {
    startObserving()
  }

  // Full teardown for the host element's disconnectedCallback — so nothing
  // leaks when the widget is unmounted (SPA navigation, dynamic removal):
  // document capture listeners, the IntersectionObserver, the injected
  // <style> node, and any active highlight.
  const destroy = (): void => {
    disablePointingMode()
    stopObserving()
    highlight(null)
    if (styleNode) {
      styleNode.remove()
      styleNode = null
    }
  }

  return {
    getCurrentTarget,
    startObserving,
    stopObserving,
    refresh,
    clearHighlight,
    enablePointingMode,
    disablePointingMode,
    destroy,
  }
}

function idOf(element: Element): string | null {
  return element.id || element.getAttribute('data-fw-id')
}

function findParentHeading(element: Element): Element | null {
  // Iterative + depth-capped (not recursive) so a pathologically deep DOM
  // can't blow the call stack.
  let current: Element | null = element
  let depth = 0
  while (current && depth < 100) {
    let walker: Element | null = current.previousElementSibling
    while (walker) {
      if (/^H[1-6]$/.test(walker.tagName)) return walker
      walker = walker.previousElementSibling
    }
    current = current.parentElement
    depth += 1
  }
  return null
}

function truncate(value: string): string {
  const trimmed = value.trim()
  return trimmed.length > LABEL_MAX_LENGTH
    ? `${trimmed.slice(0, LABEL_MAX_LENGTH - 1)}…`
    : trimmed
}

// Human-readable accessible name. Privacy: deliberately never reads an
// input's entered `value` — only its declared label-like attributes or
// visible text — so user-entered data never leaks into the payload.
function accessibleLabel(element: Element): string | null {
  const sources = [
    element.getAttribute('aria-label'),
    element.getAttribute('alt'),
    element.getAttribute('placeholder'),
    element.getAttribute('title'),
    element.textContent,
  ]
  for (const source of sources) {
    const value = source?.trim()
    if (value) return truncate(value)
  }
  return null
}

// Bounded CSS path to relocate the element. Stops at the first ancestor
// with an id (anchored, shortest), and caps the depth.
function computeSelector(element: Element): string | null {
  if (element.id) return `#${cssEscape(element.id)}`

  const parts: string[] = []
  let node: Element | null = element
  let depth = 0
  while (node && depth < SELECTOR_MAX_DEPTH) {
    if (node.id) {
      parts.unshift(`#${cssEscape(node.id)}`)
      break
    }
    let selector = node.tagName.toLowerCase()
    const parent = node.parentElement
    if (parent) {
      const tag = node.tagName
      const siblings = Array.from(parent.children).filter(
        (child) => child.tagName === tag,
      )
      if (siblings.length > 1) {
        selector += `:nth-of-type(${siblings.indexOf(node) + 1})`
      }
    }
    parts.unshift(selector)
    node = node.parentElement
    depth += 1
  }
  return parts.length > 0 ? parts.join(' > ') : null
}

function cssEscape(rawValue: string): string {
  // Cap length so a giant id can't turn into wasted escaping work.
  const value = rawValue.length > 256 ? rawValue.slice(0, 256) : rawValue
  const css = (globalThis as { CSS?: { escape?: (s: string) => string } }).CSS
  if (css?.escape) return css.escape(value)
  // Best-effort fallback for runtimes without CSS.escape: backslash-escape
  // every non-identifier char, and escape a leading digit as `\3N ` per the
  // CSS spec (a bare `#123` would be an invalid selector).
  const escaped = value.replace(/[^a-zA-Z0-9_-]/g, String.raw`\$&`)
  return escaped.replace(/^(\d)/, (digit) => String.raw`\3${digit} `)
}
