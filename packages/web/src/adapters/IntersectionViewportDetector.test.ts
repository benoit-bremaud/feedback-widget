import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createIntersectionViewportDetector } from './IntersectionViewportDetector'

type ObserverCallback = (
  entries: Array<{
    target: Element
    isIntersecting: boolean
    intersectionRatio: number
  }>,
) => void

interface FakeObserverInstance {
  callback: ObserverCallback
  observed: Set<Element>
  disconnected: boolean
}

/**
 * Minimal IntersectionObserver stub. happy-dom does not ship one, so every
 * test installs this on `window.IntersectionObserver`. The stub records
 * every instance so a test can fire `trigger(instance, entries)` to
 * simulate visibility changes.
 */
function installFakeIntersectionObserver(win: Window): FakeObserverInstance[] {
  const instances: FakeObserverInstance[] = []

  class FakeIntersectionObserver {
    private instance: FakeObserverInstance

    constructor(cb: ObserverCallback) {
      this.instance = {
        callback: cb,
        observed: new Set(),
        disconnected: false,
      }
      instances.push(this.instance)
    }

    observe(el: Element): void {
      this.instance.observed.add(el)
    }

    unobserve(el: Element): void {
      this.instance.observed.delete(el)
    }

    disconnect(): void {
      this.instance.observed.clear()
      this.instance.disconnected = true
    }
  }

  ;(win as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
    FakeIntersectionObserver
  return instances
}

function trigger(
  instance: FakeObserverInstance,
  entries: Array<{
    target: Element
    isIntersecting: boolean
    intersectionRatio?: number
  }>,
): void {
  instance.callback(
    entries.map((e) => ({
      target: e.target,
      isIntersecting: e.isIntersecting,
      intersectionRatio: e.intersectionRatio ?? (e.isIntersecting ? 1 : 0),
    })),
  )
}

function makeDocumentWithContent(html: string): Document {
  document.body.innerHTML = `<main>${html}</main>`
  return document
}

/**
 * happy-dom returns all-zero rects, which makes `pickBestCandidate`
 * fail to pick a winner (zero height, zero area). Stub the rect so
 * the element looks like it occupies a realistic slot of the viewport.
 */
function stubRect(
  element: Element,
  rect: { top: number; bottom: number; height: number },
): void {
  element.getBoundingClientRect = () =>
    ({
      top: rect.top,
      bottom: rect.bottom,
      height: rect.height,
      left: 0,
      right: 800,
      width: 800,
      x: 0,
      y: rect.top,
      toJSON: () => ({}),
    }) as DOMRect
}

beforeEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

describe('createIntersectionViewportDetector', () => {
  it('injects the highlight + pointing styles on first call to ensureStyles via startObserving', () => {
    installFakeIntersectionObserver(window)
    makeDocumentWithContent('<p>hello</p>')
    const detector = createIntersectionViewportDetector({
      doc: document,
      win: window,
    })

    detector.startObserving()

    const styleNode = document.head.querySelector('style[data-feedback-widget]')
    expect(styleNode).not.toBeNull()
    expect(styleNode?.getAttribute('data-feedback-widget')).toBe(
      'runtime-styles',
    )
    expect(styleNode?.textContent).toContain('.fw-highlight')
    expect(styleNode?.textContent).toContain('.fw-pointing')
  })

  it('does not re-inject the style node on a second startObserving call', () => {
    installFakeIntersectionObserver(window)
    makeDocumentWithContent('<p>hello</p>')
    const detector = createIntersectionViewportDetector({
      doc: document,
      win: window,
    })

    detector.startObserving()
    detector.startObserving()

    const styles = document.head.querySelectorAll('style[data-feedback-widget]')
    expect(styles.length).toBe(1)
  })

  it('uses custom selectors + class names when provided', () => {
    installFakeIntersectionObserver(window)
    document.body.innerHTML = '<section><article>custom</article></section>'
    const detector = createIntersectionViewportDetector({
      doc: document,
      win: window,
      rootSelector: 'section',
      targetSelectors: 'article',
      highlightClass: 'custom-highlight',
      pointingClass: 'custom-pointing',
    })

    detector.startObserving()

    const styleContent =
      document.head.querySelector('style[data-feedback-widget]')?.textContent ??
      ''
    expect(styleContent).toContain('.custom-highlight')
    expect(styleContent).toContain('.custom-pointing')
    expect(styleContent).toContain('article')
  })

  it('falls back to document.body when the rootSelector is not found', () => {
    const instances = installFakeIntersectionObserver(window)
    // No <main> element → root falls back to body.
    document.body.innerHTML = '<p id="p1">top-level</p>'
    const detector = createIntersectionViewportDetector({
      doc: document,
      win: window,
    })

    detector.startObserving()

    expect(instances[0]?.observed.size).toBe(1)
  })

  it('assigns a data-fw-id to targets that have no id already', () => {
    installFakeIntersectionObserver(window)
    makeDocumentWithContent('<p>no id here</p><p id="kept">keeps its id</p>')
    const detector = createIntersectionViewportDetector({
      doc: document,
      win: window,
    })

    detector.startObserving()

    const firstP = document.querySelector('main p:first-child')
    const secondP = document.getElementById('kept')
    expect(firstP?.getAttribute('data-fw-id')).toBe('fw-0')
    expect(secondP?.getAttribute('data-fw-id')).toBeNull()
    expect(secondP?.id).toBe('kept')
  })

  it('observes every matching target after startObserving', () => {
    const instances = installFakeIntersectionObserver(window)
    makeDocumentWithContent('<p>a</p><p>b</p><h2>title</h2><p>c</p>')
    const detector = createIntersectionViewportDetector({
      doc: document,
      win: window,
    })

    detector.startObserving()

    // 3 paragraphs + 1 h2 = 4 targets
    expect(instances[0]?.observed.size).toBe(4)
  })

  it('disconnects the previous observer on a second startObserving', () => {
    const instances = installFakeIntersectionObserver(window)
    makeDocumentWithContent('<p>a</p>')
    const detector = createIntersectionViewportDetector({
      doc: document,
      win: window,
    })

    detector.startObserving()
    detector.startObserving()

    expect(instances).toHaveLength(2)
    expect(instances[0]?.disconnected).toBe(true)
    expect(instances[1]?.disconnected).toBe(false)
  })

  it('returns null from getCurrentTarget when nothing is visible', () => {
    installFakeIntersectionObserver(window)
    makeDocumentWithContent('<p>hello</p>')
    const detector = createIntersectionViewportDetector({
      doc: document,
      win: window,
    })

    detector.startObserving()

    expect(detector.getCurrentTarget()).toBeNull()
  })

  it('returns a TargetBlock with heading context when an element is visible', () => {
    const instances = installFakeIntersectionObserver(window)
    makeDocumentWithContent(
      '<h2 id="sec-1">Section</h2><p id="para-1">Body text long enough to excerpt</p>',
    )
    const detector = createIntersectionViewportDetector({
      doc: document,
      win: window,
    })

    detector.startObserving()

    const paragraph = document.getElementById('para-1')!
    stubRect(paragraph, { top: 100, bottom: 300, height: 200 })
    trigger(instances[0]!, [
      { target: paragraph, isIntersecting: true, intersectionRatio: 1 },
    ])

    const target = detector.getCurrentTarget()
    expect(target).not.toBeNull()
    expect(target?.headingId).toBe('sec-1')
    expect(target?.headingText).toBe('Section')
    expect(target?.blockTag).toBe('p')
    expect(target?.excerpt.length).toBeGreaterThan(0)
  })

  it('drops entries from the visibility map when they stop intersecting', () => {
    const instances = installFakeIntersectionObserver(window)
    makeDocumentWithContent('<p id="para">body</p>')
    const detector = createIntersectionViewportDetector({
      doc: document,
      win: window,
    })
    detector.startObserving()

    const p = document.getElementById('para')!
    stubRect(p, { top: 100, bottom: 300, height: 200 })
    trigger(instances[0]!, [
      { target: p, isIntersecting: true, intersectionRatio: 1 },
    ])
    expect(detector.getCurrentTarget()).not.toBeNull()

    trigger(instances[0]!, [{ target: p, isIntersecting: false }])
    expect(detector.getCurrentTarget()).toBeNull()
  })

  it('adds the highlight class to the element returned by getCurrentTarget and removes it from the previous one', () => {
    const instances = installFakeIntersectionObserver(window)
    makeDocumentWithContent('<p id="a">first</p><p id="b">second</p>')
    const detector = createIntersectionViewportDetector({
      doc: document,
      win: window,
    })
    detector.startObserving()

    const a = document.getElementById('a')!
    const b = document.getElementById('b')!
    stubRect(a, { top: 100, bottom: 300, height: 200 })
    stubRect(b, { top: 350, bottom: 550, height: 200 })

    trigger(instances[0]!, [
      { target: a, isIntersecting: true, intersectionRatio: 1 },
    ])
    detector.getCurrentTarget()
    expect(a.classList.contains('fw-highlight')).toBe(true)

    // Swap visibility — only b is intersecting now.
    trigger(instances[0]!, [
      { target: a, isIntersecting: false },
      { target: b, isIntersecting: true, intersectionRatio: 1 },
    ])
    detector.getCurrentTarget()
    expect(a.classList.contains('fw-highlight')).toBe(false)
    expect(b.classList.contains('fw-highlight')).toBe(true)
  })

  it('clearHighlight removes the highlight class from the current element', () => {
    const instances = installFakeIntersectionObserver(window)
    makeDocumentWithContent('<p id="a">first</p>')
    const detector = createIntersectionViewportDetector({
      doc: document,
      win: window,
    })
    detector.startObserving()
    const a = document.getElementById('a')!
    stubRect(a, { top: 100, bottom: 300, height: 200 })
    trigger(instances[0]!, [
      { target: a, isIntersecting: true, intersectionRatio: 1 },
    ])
    detector.getCurrentTarget()
    expect(a.classList.contains('fw-highlight')).toBe(true)

    detector.clearHighlight()

    expect(a.classList.contains('fw-highlight')).toBe(false)
  })

  it('stopObserving disconnects the observer, clears state, and removes highlight', () => {
    const instances = installFakeIntersectionObserver(window)
    makeDocumentWithContent('<p id="a">first</p>')
    const detector = createIntersectionViewportDetector({
      doc: document,
      win: window,
    })
    detector.startObserving()
    const a = document.getElementById('a')!
    stubRect(a, { top: 100, bottom: 300, height: 200 })
    trigger(instances[0]!, [
      { target: a, isIntersecting: true, intersectionRatio: 1 },
    ])
    detector.getCurrentTarget() // highlights `a`

    detector.stopObserving()

    expect(instances[0]?.disconnected).toBe(true)
    expect(a.classList.contains('fw-highlight')).toBe(false)
    expect(detector.getCurrentTarget()).toBeNull()
  })

  it('refresh re-runs startObserving and the previous observer is disconnected', () => {
    const instances = installFakeIntersectionObserver(window)
    makeDocumentWithContent('<p>a</p>')
    const detector = createIntersectionViewportDetector({
      doc: document,
      win: window,
    })
    detector.startObserving()

    detector.refresh()

    expect(instances).toHaveLength(2)
    expect(instances[0]?.disconnected).toBe(true)
  })
})

describe('enablePointingMode / disablePointingMode', () => {
  it('adds the pointing class to the root element', () => {
    installFakeIntersectionObserver(window)
    makeDocumentWithContent('<p>a</p>')
    const detector = createIntersectionViewportDetector({
      doc: document,
      win: window,
    })

    detector.enablePointingMode(() => {})

    expect(
      document.querySelector('main')?.classList.contains('fw-pointing'),
    ).toBe(true)
  })

  it('invokes onPick with the TargetBlock when a matching element is clicked', () => {
    installFakeIntersectionObserver(window)
    makeDocumentWithContent(
      '<h2>Title</h2><p id="para">pick me with enough text to pass the excerpt</p>',
    )
    const detector = createIntersectionViewportDetector({
      doc: document,
      win: window,
    })
    const onPick = vi.fn()

    detector.enablePointingMode(onPick)
    const p = document.getElementById('para')!
    p.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }))

    expect(onPick).toHaveBeenCalledOnce()
    const arg = onPick.mock.calls[0]?.[0]
    expect(arg.blockTag).toBe('p')
    expect(arg.headingText).toBe('Title')
  })

  it('ignores clicks on elements outside the root', () => {
    installFakeIntersectionObserver(window)
    document.body.innerHTML =
      '<main><p>inside</p></main><p id="outside">outside the main</p>'
    const detector = createIntersectionViewportDetector({
      doc: document,
      win: window,
    })
    const onPick = vi.fn()

    detector.enablePointingMode(onPick)
    const outside = document.getElementById('outside')!
    outside.dispatchEvent(
      new Event('click', { bubbles: true, cancelable: true }),
    )

    expect(onPick).not.toHaveBeenCalled()
  })

  it('ignores clicks that do not match the target selector', () => {
    installFakeIntersectionObserver(window)
    makeDocumentWithContent(
      '<div id="non-target">not in the selector list</div>',
    )
    const detector = createIntersectionViewportDetector({
      doc: document,
      win: window,
    })
    const onPick = vi.fn()

    detector.enablePointingMode(onPick)
    const div = document.getElementById('non-target')!
    div.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }))

    expect(onPick).not.toHaveBeenCalled()
  })

  it('disablePointingMode removes the class and detaches the click listener', () => {
    installFakeIntersectionObserver(window)
    makeDocumentWithContent('<p>a</p>')
    const detector = createIntersectionViewportDetector({
      doc: document,
      win: window,
    })
    const onPick = vi.fn()

    detector.enablePointingMode(onPick)
    detector.disablePointingMode()

    expect(
      document.querySelector('main')?.classList.contains('fw-pointing'),
    ).toBe(false)

    const p = document.querySelector('main p')!
    p.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }))
    expect(onPick).not.toHaveBeenCalled()
  })

  it('re-enabling pointing mode replaces the previous listener without stacking', () => {
    installFakeIntersectionObserver(window)
    makeDocumentWithContent('<p id="para">content long enough</p>')
    const detector = createIntersectionViewportDetector({
      doc: document,
      win: window,
    })
    const firstPick = vi.fn()
    const secondPick = vi.fn()

    detector.enablePointingMode(firstPick)
    detector.enablePointingMode(secondPick)

    const p = document.getElementById('para')!
    p.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }))

    expect(firstPick).not.toHaveBeenCalled()
    expect(secondPick).toHaveBeenCalledOnce()
  })
})
