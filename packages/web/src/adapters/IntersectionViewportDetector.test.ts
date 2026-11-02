import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

  it('destroy() removes the style node, disconnects the observer, and drops pointing listeners (v0.5.2)', () => {
    const instances = installFakeIntersectionObserver(window)
    makeDocumentWithContent('<p id="t">hello</p>')
    const detector = createIntersectionViewportDetector({
      doc: document,
      win: window,
    })

    detector.startObserving()
    const onPick = vi.fn()
    detector.enablePointingMode(onPick)
    expect(
      document.head.querySelector('style[data-feedback-widget]'),
    ).not.toBeNull()

    detector.destroy()

    expect(
      document.head.querySelector('style[data-feedback-widget]'),
    ).toBeNull()
    expect(instances[0]?.disconnected).toBe(true)

    // The document capture listeners are gone: a click no longer picks.
    document
      .querySelector('#t')
      ?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      )
    expect(onPick).not.toHaveBeenCalled()
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
    // Pointing mode highlights ANY element under the root, so the
    // pointing rule targets `*`, not the (observer-only) targetSelectors.
    expect(styleContent).toContain('.custom-pointing *')
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

  it('falls back to document.body when the rootSelector is an invalid selector', () => {
    const instances = installFakeIntersectionObserver(window)
    document.body.innerHTML = '<p id="p1">top-level</p>'
    const detector = createIntersectionViewportDetector({
      doc: document,
      win: window,
      rootSelector: '))invalid((',
    })

    // An invalid CSS selector must not throw on mount — fall back to body.
    expect(() => detector.startObserving()).not.toThrow()
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

  it('returns a FeedbackTarget with heading context when an element is visible', () => {
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
    expect(target?.tag).toBe('p')
    expect(target?.headingText).toBe('Section')
    expect(target?.selector).toBe('#para-1')
    expect((target?.excerpt ?? '').length).toBeGreaterThan(0)
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
  // Pointing mode installs capture-phase listeners on `document`. The
  // handler calls stopImmediatePropagation, so a listener left over from a
  // previous test would swallow the next test's event. Track every document
  // listener added during a test and detach it afterwards, isolating tests.
  const docListeners: Array<{ type: string; fn: EventListener }> = []
  const originalAdd = document.addEventListener

  beforeEach(() => {
    docListeners.length = 0
    document.addEventListener = function (
      this: Document,
      ...args: Parameters<Document['addEventListener']>
    ): void {
      const [type, fn] = args
      if (typeof fn === 'function') {
        docListeners.push({ type, fn: fn as EventListener })
      }
      originalAdd.apply(this, args)
    }
  })

  afterEach(() => {
    document.addEventListener = originalAdd
    for (const { type, fn } of docListeners) {
      document.removeEventListener(type, fn, { capture: true })
    }
  })

  it('adds the pointing class to the default root (body)', () => {
    installFakeIntersectionObserver(window)
    makeDocumentWithContent('<p>a</p>')
    const detector = createIntersectionViewportDetector({
      doc: document,
      win: window,
    })

    detector.enablePointingMode(() => {})

    expect(document.body.classList.contains('fw-pointing')).toBe(true)
  })

  it('invokes onPick with the FeedbackTarget when a content block is clicked', () => {
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
    expect(arg.tag).toBe('p')
    expect(arg.headingText).toBe('Title')
    expect(arg.selector).toBe('#para')
  })

  it('picks an interactive element (button) without firing its native click', () => {
    installFakeIntersectionObserver(window)
    makeDocumentWithContent('<button id="cta">Acheter</button>')
    const detector = createIntersectionViewportDetector({
      doc: document,
      win: window,
    })
    const onPick = vi.fn()
    const nativeClick = vi.fn()
    const button = document.getElementById('cta')!
    button.addEventListener('click', nativeClick)

    detector.enablePointingMode(onPick)
    button.dispatchEvent(
      new Event('click', { bubbles: true, cancelable: true }),
    )

    // The button is selected as the target...
    expect(onPick).toHaveBeenCalledOnce()
    const arg = onPick.mock.calls[0]?.[0]
    expect(arg.tag).toBe('button')
    expect(arg.label).toBe('Acheter')
    expect(arg.selector).toBe('#cta')
    // ...and its own click handler never runs.
    expect(nativeClick).not.toHaveBeenCalled()
  })

  it('picks the interactive ancestor when the click lands on a descendant', () => {
    installFakeIntersectionObserver(window)
    makeDocumentWithContent(
      '<button id="cta" aria-label="Valider"><span id="icon">✓</span></button>',
    )
    const detector = createIntersectionViewportDetector({
      doc: document,
      win: window,
    })
    const onPick = vi.fn()

    detector.enablePointingMode(onPick)
    const icon = document.getElementById('icon')!
    icon.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }))

    expect(onPick).toHaveBeenCalledOnce()
    const arg = onPick.mock.calls[0]?.[0]
    // Picks the <button>, not the inner <span>.
    expect(arg.tag).toBe('button')
    expect(arg.label).toBe('Valider')
  })

  it.each(['pointerdown', 'mousedown', 'click'])(
    'swallows a %s outside the root without picking it (#135)',
    (type) => {
      installFakeIntersectionObserver(window)
      document.body.innerHTML =
        '<header><a id="nav" href="/page2">Nav</a></header><main><p>inside</p></main>'
      const detector = createIntersectionViewportDetector({
        doc: document,
        win: window,
        rootSelector: 'main',
      })
      const onPick = vi.fn()
      const pageHandler = vi.fn()
      const link = document.getElementById('nav')!
      link.addEventListener(type, pageHandler)

      detector.enablePointingMode(onPick)
      const ev = new Event(type, { bubbles: true, cancelable: true })
      link.dispatchEvent(ev)

      expect(ev.defaultPrevented).toBe(true)
      expect(pageHandler).not.toHaveBeenCalled()
      expect(onPick).not.toHaveBeenCalled()
      expect(link.classList.contains('fw-highlight')).toBe(false)
    },
  )

  it('lets clicks on the widget host through untouched', () => {
    installFakeIntersectionObserver(window)
    document.body.innerHTML =
      '<main><p>inside</p></main><feedback-widget id="host"></feedback-widget>'
    const detector = createIntersectionViewportDetector({
      doc: document,
      win: window,
    })
    const onPick = vi.fn()
    const hostHandler = vi.fn()
    const host = document.getElementById('host')!
    host.addEventListener('click', hostHandler)

    detector.enablePointingMode(onPick)
    const ev = new Event('click', { bubbles: true, cancelable: true })
    host.dispatchEvent(ev)

    expect(ev.defaultPrevented).toBe(false)
    expect(hostHandler).toHaveBeenCalledOnce()
    expect(onPick).not.toHaveBeenCalled()
  })

  it('picks a header link with the default root (body) without navigating (#135)', () => {
    installFakeIntersectionObserver(window)
    document.body.innerHTML =
      '<header><a id="nav" href="/page2">Produits</a></header><main><p>inside</p></main>'
    const detector = createIntersectionViewportDetector({
      doc: document,
      win: window,
    })
    const onPick = vi.fn()

    detector.enablePointingMode(onPick)
    const ev = new Event('click', { bubbles: true, cancelable: true })
    document.getElementById('nav')!.dispatchEvent(ev)

    expect(ev.defaultPrevented).toBe(true)
    expect(onPick).toHaveBeenCalledOnce()
    expect(onPick.mock.calls[0]?.[0].selector).toBe('#nav')
  })

  it('picks a non-content element (e.g. a div) — any element is targetable', () => {
    installFakeIntersectionObserver(window)
    makeDocumentWithContent(
      '<div id="card">a layout block, not in the content selectors</div>',
    )
    const detector = createIntersectionViewportDetector({
      doc: document,
      win: window,
    })
    const onPick = vi.fn()

    detector.enablePointingMode(onPick)
    const div = document.getElementById('card')!
    div.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }))

    expect(onPick).toHaveBeenCalledOnce()
    expect(onPick.mock.calls[0]?.[0].tag).toBe('div')
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

    expect(document.body.classList.contains('fw-pointing')).toBe(false)

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

  it('builds a tag + nth-of-type selector when the element has no id', () => {
    installFakeIntersectionObserver(window)
    makeDocumentWithContent('<button>first</button><button>second</button>')
    const detector = createIntersectionViewportDetector({
      doc: document,
      win: window,
    })
    const onPick = vi.fn()

    detector.enablePointingMode(onPick)
    const second = document.querySelectorAll('main button')[1]!
    second.dispatchEvent(
      new Event('click', { bubbles: true, cancelable: true }),
    )

    const arg = onPick.mock.calls[0]?.[0]
    expect(arg.selector).toContain('button:nth-of-type(2)')
  })

  it('anchors the selector on the nearest ancestor id when the element has none', () => {
    installFakeIntersectionObserver(window)
    makeDocumentWithContent('<div id="wrap"><button>deep</button></div>')
    const detector = createIntersectionViewportDetector({
      doc: document,
      win: window,
    })
    const onPick = vi.fn()

    detector.enablePointingMode(onPick)
    document
      .querySelector('#wrap button')!
      .dispatchEvent(new Event('click', { bubbles: true, cancelable: true }))

    expect(onPick.mock.calls[0]?.[0].selector).toBe('#wrap > button')
  })

  it('derives the label from alt text (image)', () => {
    installFakeIntersectionObserver(window)
    makeDocumentWithContent('<img id="logo" alt="Logo Brasse-Bouillon" />')
    const detector = createIntersectionViewportDetector({
      doc: document,
      win: window,
    })
    const onPick = vi.fn()

    detector.enablePointingMode(onPick)
    document
      .getElementById('logo')!
      .dispatchEvent(new Event('click', { bubbles: true, cancelable: true }))

    expect(onPick.mock.calls[0]?.[0].label).toBe('Logo Brasse-Bouillon')
  })

  it('derives the label from the placeholder, never the entered value (privacy)', () => {
    installFakeIntersectionObserver(window)
    makeDocumentWithContent('<input id="email" placeholder="Ton email" />')
    const detector = createIntersectionViewportDetector({
      doc: document,
      win: window,
    })
    const input = document.getElementById('email') as HTMLInputElement
    input.value = 'secret@private.example' // user-entered → must NOT leak
    const onPick = vi.fn()

    detector.enablePointingMode(onPick)
    input.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }))

    const arg = onPick.mock.calls[0]?.[0]
    expect(arg.label).toBe('Ton email')
    expect(arg.label).not.toContain('secret')
  })

  describe('form field content never leaks into label or excerpt (#136)', () => {
    const pick = (html: string, id: string) => {
      installFakeIntersectionObserver(window)
      makeDocumentWithContent(html)
      const detector = createIntersectionViewportDetector({
        doc: document,
        win: window,
      })
      const onPick = vi.fn()
      detector.enablePointingMode(onPick)
      document
        .getElementById(id)!
        .dispatchEvent(new Event('click', { bubbles: true, cancelable: true }))
      return onPick.mock.calls[0]?.[0]
    }

    it('drops a prefilled textarea text and falls back to its placeholder', () => {
      const arg = pick(
        '<textarea id="t" placeholder="Notes">PREFILLED-SECRET</textarea>',
        't',
      )

      expect(arg.label).toBe('Notes')
      expect(arg.excerpt).toBe('')
    })

    const RICH =
      '<div id="rich" contenteditable="true"><p id="inner">RICH-SECRET</p></div>'

    it('drops the text of a picked contenteditable field', () => {
      expect(pick(RICH, 'rich').label).toBeNull()
    })

    it('drops the text of a node inside a contenteditable field', () => {
      const arg = pick(RICH, 'inner')

      expect(arg.label).toBeNull()
      expect(arg.excerpt).toBe('')
    })

    it('keeps the text of a contenteditable="false" element', () => {
      const arg = pick(
        '<p id="ro" contenteditable="false">Public text</p>',
        'ro',
      )

      expect(arg.label).toBe('Public text')
    })

    it('does not glue select options into the label', () => {
      const arg = pick(
        '<select id="s"><option>Commande</option><option>Livraison</option></select>',
        's',
      )

      expect(arg.label).toBeNull()
    })

    it('strips every field from a picked form container but keeps its own text', () => {
      const arg = pick(
        '<form id="f"><h2>Contact</h2><textarea>TA-SECRET</textarea>' +
          '<select><option>OPT-SECRET</option></select>' +
          '<div contenteditable="">CE-SECRET</div>' +
          '<div role="textbox">ROLE-SECRET</div></form>',
        'f',
      )

      expect(arg.label).toBe('Contact')
      expect(arg.excerpt).toBe('Contact')
      expect(JSON.stringify(arg)).not.toMatch(/SECRET/)
    })

    it('strips field text from the heading context', () => {
      const arg = pick(
        '<h2>Title <input value="x" /><span contenteditable="true">HEAD-SECRET</span></h2><p id="p">Body</p>',
        'p',
      )

      expect(arg.headingText).toBe('Title')
    })

    it('gives a null heading context when the heading is an editable field', () => {
      const arg = pick(
        '<h1 contenteditable="true">HEAD-SECRET</h1><p id="p">Body</p>',
        'p',
      )

      expect(arg.headingText).toBeNull()
    })
  })

  it('returns a null label when the element exposes no accessible name', () => {
    installFakeIntersectionObserver(window)
    makeDocumentWithContent('<button id="empty"></button>')
    const detector = createIntersectionViewportDetector({
      doc: document,
      win: window,
    })
    const onPick = vi.fn()

    detector.enablePointingMode(onPick)
    document
      .getElementById('empty')!
      .dispatchEvent(new Event('click', { bubbles: true, cancelable: true }))

    expect(onPick.mock.calls[0]?.[0].label).toBeNull()
  })

  it('escapes a leading-digit id when CSS.escape is unavailable', () => {
    installFakeIntersectionObserver(window)
    makeDocumentWithContent('<button id="123">numeric id</button>')
    const detector = createIntersectionViewportDetector({
      doc: document,
      win: window,
    })
    const onPick = vi.fn()

    const globalWithCss = globalThis as { CSS?: unknown }
    const realCss = globalWithCss.CSS
    globalWithCss.CSS = undefined // force the no-CSS.escape fallback path
    try {
      detector.enablePointingMode(onPick)
      document
        .getElementById('123')!
        .dispatchEvent(new Event('click', { bubbles: true, cancelable: true }))
    } finally {
      globalWithCss.CSS = realCss
    }

    // Leading digit escaped per the CSS spec → "#\31 23", not "#123".
    expect(onPick.mock.calls[0]?.[0].selector).toBe(String.raw`#\31 23`)
  })
})
