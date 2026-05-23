import {
  extractExcerpt,
  pickBestCandidate,
  type FeedbackTarget,
  type ViewportDetector,
} from '@benoit-bremaud/feedback-widget-core'

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
const DEFAULT_ROOT = 'main'
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

  const getRoot = (): Element => doc.querySelector(rootSelector) ?? doc.body

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
      // Never intercept the widget's own UI (its cancel button lives in
      // the host element's shadow DOM; clicks on it retarget to the host).
      if (raw.closest(WIDGET_HOST_TAG)) return
      if (!getRoot().contains(raw)) return

      // preventDefault stops the default action (navigation, submit);
      // stopPropagation in the capture phase stops the event before it
      // reaches the element, so its own click handlers never run either.
      ev.preventDefault()
      ev.stopPropagation()
      if (ev.type !== 'click') return

      // Prefer the nearest interactive ancestor when the click lands on a
      // descendant (e.g. an icon inside a button), otherwise the element
      // itself.
      const picked = raw.closest(INTERACTIVE_SELECTORS) ?? raw
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

  return {
    getCurrentTarget,
    startObserving,
    stopObserving,
    refresh,
    clearHighlight,
    enablePointingMode,
    disablePointingMode,
  }
}

function idOf(element: Element): string | null {
  return element.id || element.getAttribute('data-fw-id')
}

function findParentHeading(element: Element): Element | null {
  let walker: Element | null = element.previousElementSibling
  while (walker) {
    if (/^H[1-6]$/.test(walker.tagName)) return walker
    walker = walker.previousElementSibling
  }
  const parent = element.parentElement
  if (!parent) return null
  return findParentHeading(parent)
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

function cssEscape(value: string): string {
  const css = (globalThis as { CSS?: { escape?: (s: string) => string } }).CSS
  if (css?.escape) return css.escape(value)
  // Minimal fallback for runtimes without CSS.escape.
  return value.replace(/[^a-zA-Z0-9_-]/g, String.raw`\$&`)
}
