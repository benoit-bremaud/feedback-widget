import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  FeedbackTarget,
  TopLevelCategory,
  WidgetState,
} from '@benoit-bremaud/feedback-widget-core'
import { SUB_CATEGORIES_BY_CATEGORY } from '@benoit-bremaud/feedback-widget-core'
import {
  createWebComponentView,
  defineFeedbackWidgetElement,
  type FeedbackWidgetElement,
} from './WebComponentView'
import { LOCALES } from '../i18n'

const TAG = 'feedback-widget-test'

/**
 * WebComponentView tests — custom element + view adapter. Each test
 * mounts a fresh element, interacts with its shadow DOM, and asserts
 * the expected emitted UserAction or rendered markup.
 *
 * happy-dom supports customElements.define + attachShadow, which is
 * enough for this suite.
 */

function mountElement(): FeedbackWidgetElement {
  // Register once per test file — happy-dom rejects duplicate define.
  if (!customElements.get(TAG)) {
    customElements.define(TAG, defineFeedbackWidgetElement())
  }
  const el = document.createElement(TAG) as FeedbackWidgetElement
  document.body.appendChild(el)
  return el
}

function initialState(): WidgetState {
  return {
    step: 'closed',
    target: null,
    selectedCategory: null,
    selectedSubCategory: null,
    userMessage: '',
    reporterName: '',
    errorMessage: null,
  }
}

beforeEach(() => {
  document.body.innerHTML = ''
})

// ---- Tests: defineFeedbackWidgetElement + FeedbackWidgetElement shape -----

describe('FeedbackWidgetElement', () => {
  it('exposes setOptions and isHoneypotFilled on the element instance', () => {
    const el = mountElement()

    expect(typeof el.setOptions).toBe('function')
    expect(typeof el.isHoneypotFilled).toBe('function')
  })

  it('attaches a shadow root on connectedCallback', () => {
    const el = mountElement()

    expect(el.shadowRoot).not.toBeNull()
  })

  it('isHoneypotFilled returns false when the hidden honeypot input is empty (happy path)', () => {
    const el = mountElement()

    expect(el.isHoneypotFilled()).toBe(false)
  })
})

// ---- Tests: createWebComponentView + rendering per step -------------------

describe('createWebComponentView — render per step', () => {
  it('renders the trigger button when state is closed', () => {
    const el = mountElement()
    const view = createWebComponentView(el)

    view.render(initialState())

    const shadow = el.shadowRoot!
    const trigger = shadow.querySelector('[data-action="open"]')
    expect(trigger).not.toBeNull()
  })

  it('renders target-confirm markup when state step is target-confirm', () => {
    const el = mountElement()
    const view = createWebComponentView(el)

    view.render({
      ...initialState(),
      step: 'target-confirm',
      target: {
        headingId: 'h1',
        headingText: 'A heading',
        blockIndex: 0,
        blockTag: 'p',
        excerpt: 'Some excerpt',
      },
    })

    const shadow = el.shadowRoot!
    const confirm = shadow.querySelector('[data-action="confirm-target"]')
    const reject = shadow.querySelector('[data-action="reject-target"]')
    expect(confirm).not.toBeNull()
    expect(reject).not.toBeNull()
  })

  it('renders the pointing bar when step is pointing', () => {
    const el = mountElement()
    const view = createWebComponentView(el)

    view.render({ ...initialState(), step: 'pointing' })

    const shadow = el.shadowRoot!
    const cancel = shadow.querySelector('[data-action="cancel-pointing"]')
    expect(cancel).not.toBeNull()
  })

  it('renders category buttons on the type step', () => {
    const el = mountElement()
    el.setOptions({ categories: ['bug', 'content', 'praise'] })
    const view = createWebComponentView(el)

    view.render({ ...initialState(), step: 'type' })

    const shadow = el.shadowRoot!
    const buttons = shadow.querySelectorAll('[data-category]')
    expect(buttons.length).toBe(3)
  })

  it('renders a textarea + submit form on the precision step', () => {
    const el = mountElement()
    const view = createWebComponentView(el)

    view.render({
      ...initialState(),
      step: 'precision',
      selectedCategory: 'bug',
    })

    const shadow = el.shadowRoot!
    const textarea = shadow.querySelector('textarea[name="message"]')
    const submit = shadow.querySelector('button[type="submit"]')
    expect(textarea).not.toBeNull()
    expect(submit).not.toBeNull()
  })

  it('renders an error message when state carries one', () => {
    const el = mountElement()
    const view = createWebComponentView(el)

    view.render({
      ...initialState(),
      step: 'precision',
      selectedCategory: 'praise',
      errorMessage: 'Please write more.',
    })

    const shadow = el.shadowRoot!
    expect(shadow.textContent).toContain('Please write more.')
  })

  it('renders a sending placeholder on the sending step', () => {
    const el = mountElement()
    const view = createWebComponentView(el)

    view.render({ ...initialState(), step: 'sending' })

    // Some form of loading / sending hint must be visible in the shadow DOM
    expect(el.shadowRoot!.textContent?.toLowerCase()).toMatch(/envoi|send/)
  })
})

// ---- Tests: showConfirmation + showMailtoFallback -------------------------

describe('createWebComponentView — discard confirmation', () => {
  const draftState = (): WidgetState => ({
    ...initialState(),
    step: 'discard-confirm',
    userMessage: 'half-written report',
  })

  it.each([
    ['keep-editing', LOCALES.fr.discardConfirm.keepEditing],
    ['discard', LOCALES.fr.discardConfirm.discard],
  ] as const)('clicking %s emits that action', (kind, label) => {
    const el = mountElement()
    const view = createWebComponentView(el)
    const onAction = vi.fn()
    view.onUserAction(onAction)
    view.render(draftState())

    const button = el.shadowRoot!.querySelector<HTMLButtonElement>(
      `[data-action="${kind}"]`,
    )
    button?.click()

    expect(button?.textContent).toBe(label)
    expect(onAction).toHaveBeenCalledWith({ kind })
  })

  it('Escape emits close; the controller decides what it means', () => {
    const el = mountElement()
    const view = createWebComponentView(el)
    const onAction = vi.fn()
    view.onUserAction(onAction)
    view.render(draftState())

    el.shadowRoot!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )

    expect(onAction).toHaveBeenCalledWith({ kind: 'close' })
    expect(onAction).not.toHaveBeenCalledWith({ kind: 'keep-editing' })
  })
})

// ---- Tests: onUserAction — click → action emission ------------------------

describe('createWebComponentView — user actions', () => {
  it('clicking the trigger emits an `open` action', () => {
    const el = mountElement()
    const view = createWebComponentView(el)
    const onAction = vi.fn()
    view.onUserAction(onAction)
    view.render(initialState())

    const trigger = el.shadowRoot!.querySelector<HTMLButtonElement>(
      '[data-action="open"]',
    )
    trigger?.click()

    expect(onAction).toHaveBeenCalledWith({ kind: 'open' })
  })

  it('clicking a category button emits `select-category` with the chosen category', () => {
    const el = mountElement()
    el.setOptions({ categories: ['bug', 'content'] })
    const view = createWebComponentView(el)
    const onAction = vi.fn()
    view.onUserAction(onAction)
    view.render({ ...initialState(), step: 'type' })

    const button = el.shadowRoot!.querySelector<HTMLButtonElement>(
      '[data-category="content"]',
    )
    button?.click()

    expect(onAction).toHaveBeenCalledWith({
      kind: 'select-category',
      category: 'content',
    })
  })

  it('renders one button per sub-category of the selected category', () => {
    const el = mountElement()
    const view = createWebComponentView(el)
    view.render({
      ...initialState(),
      step: 'sub-category',
      selectedCategory: 'bug',
    })

    const buttons = el.shadowRoot!.querySelectorAll('[data-sub-category]')
    expect(buttons).toHaveLength(SUB_CATEGORIES_BY_CATEGORY.bug.length)
    expect(
      el.shadowRoot!.querySelector('[data-sub-category="crash"]'),
    ).not.toBeNull()
  })

  it('falls back to the category picker if the sub-category step is reached with "praise"', () => {
    const el = mountElement()
    const view = createWebComponentView(el)
    view.render({
      ...initialState(),
      step: 'sub-category',
      selectedCategory: 'praise',
    })

    // `praise` declares no sub-category, so rendering the step verbatim
    // would strand the user on an empty screen with no way forward.
    expect(el.shadowRoot!.querySelectorAll('[data-sub-category]')).toHaveLength(
      0,
    )
    expect(
      el.shadowRoot!.querySelectorAll('[data-category]').length,
    ).toBeGreaterThan(0)
  })

  it('clicking a sub-category button emits `select-sub-category`', () => {
    const el = mountElement()
    const view = createWebComponentView(el)
    const onAction = vi.fn()
    view.onUserAction(onAction)
    view.render({
      ...initialState(),
      step: 'sub-category',
      selectedCategory: 'bug',
    })

    el.shadowRoot!.querySelector<HTMLButtonElement>(
      '[data-sub-category="crash"]',
    )?.click()

    expect(onAction).toHaveBeenCalledWith({
      kind: 'select-sub-category',
      subCategory: 'crash',
    })
  })

  it('clicking the sub-category back button emits `back`', () => {
    const el = mountElement()
    const view = createWebComponentView(el)
    const onAction = vi.fn()
    view.onUserAction(onAction)
    view.render({
      ...initialState(),
      step: 'sub-category',
      selectedCategory: 'bug',
    })

    el.shadowRoot!.querySelector<HTMLButtonElement>(
      '[data-action="back"]',
    )?.click()

    expect(onAction).toHaveBeenCalledWith({ kind: 'back' })
  })

  it('shows a family › sub-family breadcrumb whose last link goes back', () => {
    const el = mountElement()
    const view = createWebComponentView(el)
    const onAction = vi.fn()
    view.onUserAction(onAction)
    view.render({
      ...initialState(),
      step: 'precision',
      selectedCategory: 'bug',
      selectedSubCategory: 'crash',
    })

    const nav = el.shadowRoot!.querySelector('nav.fw-breadcrumb')
    nav?.querySelector<HTMLButtonElement>('[data-action="back"]')?.click()

    expect(nav?.getAttribute('aria-label')).toBe(LOCALES.fr.breadcrumb)
    expect(nav?.textContent).toContain(LOCALES.fr.categoryLabels.bug)
    expect(nav?.textContent).toContain(LOCALES.fr.subCategoryLabels.crash)
    expect(onAction).toHaveBeenCalledWith({ kind: 'back' })
  })

  it('shows the family as a back link on the sub-category step', () => {
    const el = mountElement()
    const view = createWebComponentView(el)
    view.render({
      ...initialState(),
      step: 'sub-category',
      selectedCategory: 'display',
    })

    const link = el.shadowRoot!.querySelector(
      'nav.fw-breadcrumb .fw-crumb-link',
    )

    expect(link?.textContent).toBe(LOCALES.fr.categoryLabels.display)
  })

  it.each([
    ['bug', 'crash', LOCALES.fr.precision.prompts['bug/crash']!],
    ['suggestion', 'design', LOCALES.fr.precision.familyPrompts.suggestion!],
    ['praise', null, LOCALES.fr.precision.familyPrompts.praise!],
    ['content', 'other', LOCALES.fr.precision.defaultPrompt],
  ] as const)(
    'guides %s/%s with the matching question and placeholder',
    (category, subCategory, expected) => {
      const el = mountElement()
      const view = createWebComponentView(el)
      view.render({
        ...initialState(),
        step: 'precision',
        selectedCategory: category,
        selectedSubCategory: subCategory,
      })

      const shadow = el.shadowRoot!
      expect(shadow.querySelector('.fw-title')?.textContent).toBe(
        expected.question,
      )
      expect(
        shadow.querySelector('textarea')?.getAttribute('placeholder'),
      ).toBe(expected.placeholder)
    },
  )

  it('clicking confirm-target emits `confirm-target`', () => {
    const el = mountElement()
    const view = createWebComponentView(el)
    const onAction = vi.fn()
    view.onUserAction(onAction)
    view.render({
      ...initialState(),
      step: 'target-confirm',
      target: {
        headingId: null,
        headingText: null,
        blockIndex: null,
        blockTag: 'p',
        excerpt: 'e',
      },
    })

    const confirm = el.shadowRoot!.querySelector<HTMLButtonElement>(
      '[data-action="confirm-target"]',
    )
    confirm?.click()

    expect(onAction).toHaveBeenCalledWith({ kind: 'confirm-target' })
  })

  it('typing in the textarea emits `update-message`', () => {
    const el = mountElement()
    const view = createWebComponentView(el)
    const onAction = vi.fn()
    view.onUserAction(onAction)
    view.render({
      ...initialState(),
      step: 'precision',
      selectedCategory: 'praise',
    })

    const textarea =
      el.shadowRoot!.querySelector<HTMLTextAreaElement>('textarea')!
    textarea.value = 'hello world'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))

    expect(onAction).toHaveBeenCalledWith({
      kind: 'update-message',
      value: 'hello world',
    })
  })

  it('submitting the precision form emits `submit`', () => {
    const el = mountElement()
    const view = createWebComponentView(el)
    const onAction = vi.fn()
    view.onUserAction(onAction)
    view.render({
      ...initialState(),
      step: 'precision',
      selectedCategory: 'praise',
      userMessage: 'something to send',
    })

    const form = el.shadowRoot!.querySelector<HTMLFormElement>(
      'form[data-action="submit-form"]',
    )
    // Dispatch a submit event — the adapter listens for `submit` and
    // calls preventDefault() then emits `{ kind: 'submit' }`.
    form?.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    )

    expect(onAction).toHaveBeenCalledWith({ kind: 'submit' })
  })

  it('no crash / emission when clicking an unrecognised data-action', () => {
    const el = mountElement()
    const view = createWebComponentView(el)
    const onAction = vi.fn()
    view.onUserAction(onAction)
    view.render(initialState())

    // Append a fake element with an unknown data-action and click it.
    const shadow = el.shadowRoot!
    const fake = document.createElement('button')
    fake.setAttribute('data-action', 'totally-unknown')
    shadow.appendChild(fake)
    fake.click()

    // Known trigger should still work afterwards.
    const trigger = shadow.querySelector<HTMLButtonElement>(
      '[data-action="open"]',
    )
    trigger?.click()

    expect(onAction).toHaveBeenCalledWith({ kind: 'open' })
  })
})

// ---- Tests: setOptions influence on rendering -----------------------------

describe('setOptions', () => {
  it('position=bottom-left applies a corresponding class or attribute on the chrome', () => {
    const el = mountElement()
    el.setOptions({ position: 'bottom-left' })
    const view = createWebComponentView(el)

    view.render(initialState())

    // At least one element in the shadow DOM should carry the position
    // information — the exact attribute name is implementation detail,
    // but the raw HTML should reference bottom-left somewhere.
    const shadow = el.shadowRoot!
    expect(shadow.innerHTML).toMatch(/bottom-left/)
  })

  it('setOptions accepts partial options and merges with defaults', () => {
    const el = mountElement()

    // No throw on partial input.
    expect(() => el.setOptions({ maxMessageLength: 300 })).not.toThrow()
    expect(() => el.setOptions({ categories: ['bug'] })).not.toThrow()
  })
})

describe('i18n + theme (v0.5.0)', () => {
  it('renders French copy by default', () => {
    const el = mountElement()
    const view = createWebComponentView(el)

    view.render({ ...initialState(), step: 'type' })

    expect(el.shadowRoot!.textContent).toContain('Choisis le type de problème.')
  })

  it('renders English copy when the English messages are provided', () => {
    const el = mountElement()
    const view = createWebComponentView(el)

    el.setOptions({ messages: LOCALES.en })
    view.render({ ...initialState(), step: 'type' })

    const text = el.shadowRoot!.textContent ?? ''
    expect(text).toContain('Choose the type of problem.')
    expect(text).not.toContain('Choisis le type de problème.')
  })

  it('reflects an explicit theme as data-theme and clears it for the light default', () => {
    const el = mountElement()

    el.setOptions({ theme: 'dark' })
    expect(el.getAttribute('data-theme')).toBe('dark')

    el.setOptions({ theme: null })
    expect(el.hasAttribute('data-theme')).toBe(false)
  })
})

// ---- Shared helpers for the extended suites -------------------------------

function makeTarget(overrides: Partial<FeedbackTarget> = {}): FeedbackTarget {
  return {
    tag: 'p',
    label: null,
    selector: null,
    headingText: null,
    excerpt: null,
    ...overrides,
  }
}

/** Mount an element wired to a view and capture every emitted action. */
function mountView(): {
  el: FeedbackWidgetElement
  render: (state: Partial<WidgetState>) => void
  onAction: ReturnType<typeof vi.fn>
} {
  const el = mountElement()
  const view = createWebComponentView(el)
  const onAction = vi.fn()
  view.onUserAction(onAction)
  return {
    el,
    render: (state) => view.render({ ...initialState(), ...state }),
    onAction,
  }
}

function click(el: FeedbackWidgetElement, selector: string): void {
  el.shadowRoot!.querySelector<HTMLElement>(selector)?.click()
}

function press(
  el: FeedbackWidgetElement,
  key: string,
  init: KeyboardEventInit = {},
): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  })
  el.shadowRoot!.dispatchEvent(ev)
  return ev
}

/** Queued focus management runs in a microtask. */
async function flushMicrotasks(): Promise<void> {
  await Promise.resolve()
}

function activeAction(el: FeedbackWidgetElement): string | undefined {
  return (el.shadowRoot!.activeElement as HTMLElement | null)?.dataset.action
}

// ---- Tests: target-confirm step -------------------------------------------

describe('target-confirm step', () => {
  it.each([
    ['the excerpt when both exist', 'An excerpt', 'A label', 'An excerpt'],
    ['the label when the excerpt is null', null, 'Menu button', 'Menu button'],
    ['the label when the excerpt is empty', '', 'Menu button', 'Menu button'],
    ['an empty quote when neither exists', null, null, ''],
  ] as const)('previews %s', (_name, excerpt, label, expected) => {
    const { el, render } = mountView()

    render({
      step: 'target-confirm',
      target: makeTarget({ excerpt, label }),
    })

    expect(
      el.shadowRoot!.querySelector('.fw-target-excerpt')?.textContent,
    ).toBe(`« ${expected} »`)
  })

  it('shows the section heading when the target carries one', () => {
    const { el, render } = mountView()

    render({
      step: 'target-confirm',
      target: makeTarget({ excerpt: 'x', headingText: 'Pricing' }),
    })

    expect(
      el.shadowRoot!.querySelector('.fw-target-heading')?.textContent,
    ).toBe('§ Pricing')
  })

  it('omits the heading line when the target has no heading text', () => {
    const { el, render } = mountView()

    render({
      step: 'target-confirm',
      target: makeTarget({ excerpt: 'x', headingText: null }),
    })

    expect(el.shadowRoot!.querySelector('.fw-target-heading')).toBeNull()
  })

  it('shows the no-target message and no preview when nothing is targeted', () => {
    const { el, render } = mountView()

    render({ step: 'target-confirm', target: null })

    expect(el.shadowRoot!.querySelector('.fw-target-preview')).toBeNull()
    expect(el.shadowRoot!.textContent).toContain(
      LOCALES.fr.targetConfirm.noTarget,
    )
  })

  it('escapes HTML coming from the page excerpt and heading', () => {
    const { el, render } = mountView()

    render({
      step: 'target-confirm',
      target: makeTarget({
        excerpt: '<img src=x onerror=alert(1)>',
        headingText: '<b>Bold</b>',
      }),
    })

    const shadow = el.shadowRoot!
    expect(shadow.querySelector('img')).toBeNull()
    expect(shadow.querySelector('.fw-target-heading b')).toBeNull()
    expect(shadow.querySelector('.fw-target-excerpt')?.textContent).toContain(
      '<img src=x onerror=alert(1)>',
    )
  })

  it.each([
    ['reject-target', 'target-confirm'],
    ['confirm-target', 'target-confirm'],
    ['cancel-pointing', 'pointing'],
  ] as const)('clicking %s on step %s emits that action', (kind, step) => {
    const { el, render, onAction } = mountView()
    render({ step })

    click(el, `[data-action="${kind}"]`)

    expect(onAction).toHaveBeenCalledWith({ kind })
  })

  it('does not render the trigger or the modal chrome while pointing', () => {
    const { el, render } = mountView()

    render({ step: 'pointing' })

    const shadow = el.shadowRoot!
    expect(shadow.querySelector('[data-action="open"]')).toBeNull()
    expect(shadow.querySelector('.fw-backdrop')).toBeNull()
  })
})

// ---- Tests: modal chrome, sending, confirmed, error -----------------------

describe('modal chrome and terminal steps', () => {
  it.each([
    ['the close button', '.fw-close'],
    ['the backdrop', '.fw-backdrop'],
  ] as const)('clicking %s emits `close`', (_name, selector) => {
    const { el, render, onAction } = mountView()
    render({ step: 'type' })

    click(el, selector)

    expect(onAction).toHaveBeenCalledWith({ kind: 'close' })
  })

  it('hides the trigger while a modal step is showing', () => {
    const { el, render } = mountView()

    render({ step: 'type' })

    expect(el.shadowRoot!.querySelector('[data-action="open"]')).toBeNull()
  })

  it('shows the sending title and a spinner, with no form to resubmit', () => {
    const { el, render } = mountView()

    render({ step: 'sending' })

    const shadow = el.shadowRoot!
    expect(shadow.querySelector('.fw-title')?.textContent).toBe(
      LOCALES.fr.sending,
    )
    expect(shadow.querySelector('.fw-spinner')).not.toBeNull()
    expect(shadow.querySelector('form')).toBeNull()
  })

  it('shows the confirmation copy on the confirmed step', () => {
    const { el, render } = mountView()

    render({ step: 'confirmed' })

    const shadow = el.shadowRoot!
    // innerHTML: the French title carries an `&nbsp;` entity.
    expect(shadow.querySelector('.fw-title')?.innerHTML).toBe(
      LOCALES.fr.confirmed.title,
    )
    expect(shadow.querySelector('.fw-subtitle')?.innerHTML).toBe(
      LOCALES.fr.confirmed.subtitle,
    )
  })

  it.each([
    ['close', 'close'],
    ['reset', 'reset'],
  ] as const)(
    'clicking %s on the confirmed step emits `%s`',
    (action, kind) => {
      const { el, render, onAction } = mountView()
      render({ step: 'confirmed' })

      click(el, `[data-action="${action}"]`)

      expect(onAction).toHaveBeenCalledWith({ kind })
    },
  )

  it('shows the supplied error message on the error step', () => {
    const { el, render } = mountView()

    render({ step: 'error', errorMessage: 'Server said no.' })

    const shadow = el.shadowRoot!
    expect(shadow.querySelector('.fw-title')?.textContent).toBe(
      LOCALES.fr.error.title,
    )
    expect(shadow.querySelector('.fw-subtitle')?.textContent).toBe(
      'Server said no.',
    )
  })

  it('falls back to the default error message when none is supplied', () => {
    const { el, render } = mountView()

    render({ step: 'error', errorMessage: null })

    expect(el.shadowRoot!.querySelector('.fw-subtitle')?.textContent).toBe(
      LOCALES.fr.error.defaultMessage,
    )
  })

  it('escapes HTML inside the error message', () => {
    const { el, render } = mountView()

    render({ step: 'error', errorMessage: '<script>boom()</script> & "q"' })

    const shadow = el.shadowRoot!
    expect(shadow.querySelector('script')).toBeNull()
    expect(shadow.querySelector('.fw-subtitle')?.textContent).toBe(
      '<script>boom()</script> & "q"',
    )
  })

  it.each([
    ['submit', 'submit'],
    ['close', 'close'],
  ] as const)('clicking %s on the error step emits `%s`', (action, kind) => {
    const { el, render, onAction } = mountView()
    render({ step: 'error', errorMessage: 'x' })

    click(el, `[data-action="${action}"]`)

    expect(onAction).toHaveBeenCalledWith({ kind })
  })

  it('renders an empty modal body (no crash) for an unknown step', () => {
    const { el, render } = mountView()

    expect(() =>
      render({ step: 'bogus' as unknown as WidgetState['step'] }),
    ).not.toThrow()

    const shadow = el.shadowRoot!
    expect(shadow.querySelector('.fw-modal')).not.toBeNull()
    expect(shadow.querySelector('.fw-title')).toBeNull()
  })
})

// ---- Tests: category / sub-category rendering -----------------------------

describe('type and sub-category steps — edge cases', () => {
  it('skips a configured category that has no icon', () => {
    const { el, render } = mountView()
    el.setOptions({
      categories: ['bug', 'retired' as unknown as TopLevelCategory],
    })

    render({ step: 'type' })

    const rendered = Array.from(
      el.shadowRoot!.querySelectorAll<HTMLElement>('[data-category]'),
    ).map((b) => b.dataset.category)
    expect(rendered).toEqual(['bug'])
  })

  it('emits one select-category action per category button', () => {
    const { el, render, onAction } = mountView()
    render({ step: 'type' })

    click(el, '[data-category="praise"]')

    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onAction).toHaveBeenCalledWith({
      kind: 'select-category',
      category: 'praise',
    })
  })

  it('falls back to the category picker when the sub-category step has no category', () => {
    const { el, render } = mountView()

    render({ step: 'sub-category', selectedCategory: null })

    expect(el.shadowRoot!.querySelectorAll('[data-sub-category]')).toHaveLength(
      0,
    )
    expect(
      el.shadowRoot!.querySelectorAll('[data-category]').length,
    ).toBeGreaterThan(0)
  })

  it('shows only the family in the breadcrumb until a sub-category is chosen on precision', () => {
    const { el, render } = mountView()

    render({
      step: 'precision',
      selectedCategory: 'bug',
      selectedSubCategory: null,
    })

    const crumb = el.shadowRoot!.querySelector('nav.fw-breadcrumb')
    expect(crumb?.textContent).toBe(LOCALES.fr.categoryLabels.bug)
  })

  it('renders no breadcrumb when no category is selected', () => {
    const { el, render } = mountView()

    render({ step: 'precision', selectedCategory: null })

    expect(el.shadowRoot!.querySelector('nav.fw-breadcrumb')).toBeNull()
  })

  it('does not emit anything for a sub-category button clicked on a different step render', () => {
    const { el, render, onAction } = mountView()
    render({ step: 'sub-category', selectedCategory: 'content' })

    click(el, '[data-sub-category="typo"]')

    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onAction).toHaveBeenCalledWith({
      kind: 'select-sub-category',
      subCategory: 'typo',
    })
  })
})

// ---- Tests: precision form ------------------------------------------------

describe('precision step — form behaviour', () => {
  it('prefills the textarea and reporter input from the state', () => {
    const { el, render } = mountView()

    render({
      step: 'precision',
      selectedCategory: 'praise',
      userMessage: 'Great docs',
      reporterName: 'Léa',
    })

    const shadow = el.shadowRoot!
    expect(shadow.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe(
      'Great docs',
    )
    expect(
      shadow.querySelector<HTMLInputElement>('input[name="reporter"]')?.value,
    ).toBe('Léa')
  })

  it('escapes the draft message so markup cannot be injected', () => {
    const { el, render } = mountView()

    render({
      step: 'precision',
      selectedCategory: 'praise',
      userMessage: '</textarea><script>x()</script>',
      reporterName: '"><img src=x>',
    })

    const shadow = el.shadowRoot!
    expect(shadow.querySelector('script')).toBeNull()
    expect(shadow.querySelector('img')).toBeNull()
    expect(shadow.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe(
      '</textarea><script>x()</script>',
    )
  })

  it('shows no inline error when the state carries none', () => {
    const { el, render } = mountView()

    render({ step: 'precision', selectedCategory: 'praise' })

    expect(el.shadowRoot!.querySelector('.fw-inline-error')).toBeNull()
  })

  it('applies the configured maximum length to the textarea', () => {
    const { el, render } = mountView()
    el.setOptions({ maxMessageLength: 123 })

    render({ step: 'precision', selectedCategory: 'praise' })

    expect(
      el.shadowRoot!.querySelector('textarea')?.getAttribute('maxlength'),
    ).toBe('123')
  })

  it('typing in the reporter input emits `update-reporter`', () => {
    const { el, render, onAction } = mountView()
    render({ step: 'precision', selectedCategory: 'praise' })

    const input = el.shadowRoot!.querySelector<HTMLInputElement>(
      'input[name="reporter"]',
    )!
    input.value = 'Sam'
    input.dispatchEvent(new Event('input', { bubbles: true }))

    expect(onAction).toHaveBeenCalledWith({
      kind: 'update-reporter',
      value: 'Sam',
    })
  })

  it('emits an empty value when the textarea is cleared', () => {
    const { el, render, onAction } = mountView()
    render({
      step: 'precision',
      selectedCategory: 'praise',
      userMessage: 'to be cleared',
    })

    const textarea =
      el.shadowRoot!.querySelector<HTMLTextAreaElement>('textarea')!
    textarea.value = ''
    textarea.dispatchEvent(new Event('input', { bubbles: true }))

    expect(onAction).toHaveBeenCalledWith({ kind: 'update-message', value: '' })
  })

  it('prevents the native form submission and emits `submit` once', () => {
    const { el, render, onAction } = mountView()
    render({ step: 'precision', selectedCategory: 'praise' })
    const ev = new Event('submit', { bubbles: true, cancelable: true })

    el.shadowRoot!.querySelector('form')!.dispatchEvent(ev)

    expect(ev.defaultPrevented).toBe(true)
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onAction).toHaveBeenCalledWith({ kind: 'submit' })
  })

  it('emits nothing from form inputs on steps that render no form', () => {
    const { el, render, onAction } = mountView()
    render({ step: 'type' })

    expect(el.shadowRoot!.querySelector('form')).toBeNull()
    expect(el.shadowRoot!.querySelector('textarea')).toBeNull()
    expect(onAction).not.toHaveBeenCalled()
  })

  it('clicking the precision back button emits `back`', () => {
    const { el, render, onAction } = mountView()
    render({ step: 'precision', selectedCategory: 'praise' })

    click(el, '.fw-actions [data-action="back"]')

    expect(onAction).toHaveBeenCalledWith({ kind: 'back' })
  })
})

// ---- Tests: honeypot ------------------------------------------------------

describe('isHoneypotFilled', () => {
  it('returns true when the hidden field holds text', () => {
    const { el, render } = mountView()
    render({ step: 'precision', selectedCategory: 'praise' })

    el.shadowRoot!.querySelector<HTMLInputElement>('input.fw-honeypot')!.value =
      'http://spam.example'

    expect(el.isHoneypotFilled()).toBe(true)
  })

  it('returns false when the hidden field only holds whitespace', () => {
    const { el, render } = mountView()
    render({ step: 'precision', selectedCategory: 'praise' })

    el.shadowRoot!.querySelector<HTMLInputElement>('input.fw-honeypot')!.value =
      '   '

    expect(el.isHoneypotFilled()).toBe(false)
  })

  it('returns false on steps that render no honeypot', () => {
    const { el, render } = mountView()
    render({ step: 'type' })

    expect(el.isHoneypotFilled()).toBe(false)
  })

  it('returns false before the element is connected (no shadow root yet)', () => {
    mountElement()
    const detached = document.createElement(TAG) as FeedbackWidgetElement

    expect(detached.isHoneypotFilled()).toBe(false)
  })
})

// ---- Tests: keyboard ------------------------------------------------------

describe('keyboard handling', () => {
  it('Escape on a regular step emits `close` and is default-prevented', () => {
    const { el, render, onAction } = mountView()
    render({ step: 'type' })

    const ev = press(el, 'Escape')

    expect(onAction).toHaveBeenCalledWith({ kind: 'close' })
    expect(ev.defaultPrevented).toBe(true)
  })

  it.each(['Enter', 'a', ' ', 'ArrowDown'])(
    'the %j key emits nothing and is left alone',
    (key) => {
      const { el, render, onAction } = mountView()
      render({ step: 'type' })

      const ev = press(el, key)

      expect(onAction).not.toHaveBeenCalled()
      expect(ev.defaultPrevented).toBe(false)
    },
  )

  it('Tab while the widget is closed is not trapped', () => {
    const { el, render } = mountView()
    render({ step: 'closed' })

    const ev = press(el, 'Tab')

    expect(ev.defaultPrevented).toBe(false)
  })
})

describe('keyboard focus trap', () => {
  // discard-confirm renders exactly: close (×), keep-editing, discard.
  const focusables = (el: FeedbackWidgetElement): HTMLElement[] =>
    Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('button'))

  it('Tab on the last control wraps focus to the first', () => {
    const { el, render } = mountView()
    render({ step: 'discard-confirm' })
    const all = focusables(el)
    all[all.length - 1]!.focus()

    const ev = press(el, 'Tab')

    expect(ev.defaultPrevented).toBe(true)
    expect(el.shadowRoot!.activeElement).toBe(all[0])
  })

  it('Shift+Tab on the first control wraps focus to the last', () => {
    const { el, render } = mountView()
    render({ step: 'discard-confirm' })
    const all = focusables(el)
    all[0]!.focus()

    const ev = press(el, 'Tab', { shiftKey: true })

    expect(ev.defaultPrevented).toBe(true)
    expect(el.shadowRoot!.activeElement).toBe(all[all.length - 1])
  })

  it('Tab from a middle control is left to the browser', () => {
    const { el, render } = mountView()
    render({ step: 'discard-confirm' })
    focusables(el)[1]!.focus()

    const ev = press(el, 'Tab')

    expect(ev.defaultPrevented).toBe(false)
  })

  it('Shift+Tab from a middle control is left to the browser', () => {
    const { el, render } = mountView()
    render({ step: 'discard-confirm' })
    focusables(el)[1]!.focus()

    const ev = press(el, 'Tab', { shiftKey: true })

    expect(ev.defaultPrevented).toBe(false)
  })

  it('Tab on the last control of the pointing bar stays inside the bar', () => {
    const { el, render } = mountView()
    render({ step: 'pointing' })
    const cancel = el.shadowRoot!.querySelector<HTMLElement>(
      '[data-action="cancel-pointing"]',
    )!
    cancel.focus()

    const ev = press(el, 'Tab')

    expect(ev.defaultPrevented).toBe(true)
    expect(el.shadowRoot!.activeElement).toBe(cancel)
  })
})

// ---- Tests: focus management ----------------------------------------------

describe('focus management', () => {
  it('moves focus to the first actionable control when a step opens', async () => {
    const { el, render } = mountView()

    render({ step: 'discard-confirm' })
    await flushMicrotasks()

    // keep-editing is rendered before discard on purpose.
    expect(activeAction(el)).toBe('keep-editing')
  })

  it('focuses the textarea on the precision step', async () => {
    const { el, render } = mountView()

    render({ step: 'precision', selectedCategory: 'praise' })
    await flushMicrotasks()

    expect(el.shadowRoot!.activeElement).toBe(
      el.shadowRoot!.querySelector('textarea'),
    )
  })

  it('restores focus to the previously focused host element once closed', async () => {
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.focus()
    const { el, render } = mountView()
    outside.focus()

    render({ step: 'type' })
    await flushMicrotasks()
    render({ step: 'closed' })
    await flushMicrotasks()

    expect(document.activeElement).toBe(outside)
    expect(el.shadowRoot!.activeElement).toBeNull()
  })

  it('returns focus to the re-rendered trigger when opened from it', async () => {
    const { el, render } = mountView()
    el.shadowRoot!.querySelector<HTMLElement>('.fw-trigger')!.focus()

    render({ step: 'type' })
    await flushMicrotasks()
    render({ step: 'closed' })
    await flushMicrotasks()

    const trigger = el.shadowRoot!.querySelector('.fw-trigger')
    expect(el.shadowRoot!.activeElement).toBe(trigger)
    expect(document.activeElement).toBe(el)
  })

  it('leaves focus alone on close when nothing was focused before opening', async () => {
    const { el, render } = mountView()
    ;(document.activeElement as HTMLElement | null)?.blur()

    render({ step: 'type' })
    await flushMicrotasks()
    render({ step: 'closed' })
    await flushMicrotasks()

    expect(el.shadowRoot!.activeElement).toBeNull()
  })

  it('does not re-focus any control when the same step is re-rendered', async () => {
    const { el, render } = mountView()
    render({ step: 'precision', selectedCategory: 'praise' })
    await flushMicrotasks()

    // Same step again, e.g. the controller re-rendering a validation error.
    render({
      step: 'precision',
      selectedCategory: 'praise',
      errorMessage: 'again',
    })
    await flushMicrotasks()

    expect(el.shadowRoot!.activeElement).toBeNull()
  })
})

// ---- Tests: setOptions edge cases -----------------------------------------

describe('setOptions — edge cases', () => {
  it('keeps the current value when a key is passed as undefined', () => {
    const { el, render } = mountView()
    el.setOptions({ categories: ['bug', 'praise'] })

    el.setOptions({ categories: undefined, maxMessageLength: 42 })
    render({ step: 'type' })

    expect(el.shadowRoot!.querySelectorAll('[data-category]')).toHaveLength(2)
  })

  it('accepts being called with no argument at all', () => {
    const { el } = mountView()

    expect(() => el.setOptions()).not.toThrow()
    expect(el.getAttribute('data-position')).toBe('bottom-right')
  })

  it.each(['bottom-left', 'bottom-center'] as const)(
    'reflects position %s as the data-position attribute',
    (position) => {
      const { el } = mountView()

      el.setOptions({ position })

      expect(el.getAttribute('data-position')).toBe(position)
    },
  )

  it('re-renders the current step with the new messages', () => {
    const { el, render } = mountView()
    render({ step: 'type' })

    el.setOptions({ messages: LOCALES.en })

    expect(el.shadowRoot!.textContent).toContain('Choose the type of problem.')
  })
})

// ---- Tests: lifecycle -----------------------------------------------------

describe('disconnectedCallback', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('runs the host-supplied teardown when the element is removed', () => {
    const el = mountElement()
    const teardown = vi.fn()
    el.setDisconnectHandler(teardown)

    el.remove()

    expect(teardown).toHaveBeenCalledOnce()
  })

  it('does not throw when removed without a teardown handler', () => {
    const el = mountElement()

    expect(() => el.remove()).not.toThrow()
  })

  it('stops reacting to the keyboard once removed', () => {
    const { el, render, onAction } = mountView()
    render({ step: 'type' })
    const root = el.shadowRoot!
    el.remove()

    root.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )

    expect(onAction).not.toHaveBeenCalled()
  })

  it('listens to the keyboard again when re-attached', () => {
    const { el, render, onAction } = mountView()
    render({ step: 'type' })
    el.remove()

    document.body.appendChild(el)
    press(el, 'Escape')

    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onAction).toHaveBeenCalledWith({ kind: 'close' })
  })

  it('does not register the keyboard listener twice across re-attachment', () => {
    const { el, render, onAction } = mountView()
    render({ step: 'type' })
    el.remove()
    document.body.appendChild(el)

    press(el, 'Escape')

    expect(onAction).toHaveBeenCalledTimes(1)
  })
})

describe('updateState before connection', () => {
  it('does not throw when state arrives before the element is connected', () => {
    mountElement()
    const detached = document.createElement(TAG) as FeedbackWidgetElement

    expect(() => detached.updateState(initialState())).not.toThrow()
    expect(() => detached.setOptions({ theme: 'dark' })).not.toThrow()
    expect(detached.getAttribute('data-theme')).toBe('dark')
  })
})

// ---- Tests: lifecycle idempotence and browser edge cases ------------------

/** The lifecycle callbacks are public on the class but not on the typed interface. */
interface LifecycleElement extends FeedbackWidgetElement {
  connectedCallback(): void
  disconnectedCallback(): void
}

describe('lifecycle callbacks — idempotence', () => {
  it('connecting an already connected element does not duplicate the keyboard listener', () => {
    const { el, render, onAction } = mountView()
    render({ step: 'type' })

    ;(el as LifecycleElement).connectedCallback()
    press(el, 'Escape')

    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('disconnecting an element that never connected still runs the teardown', () => {
    mountElement()
    const detached = document.createElement(TAG) as LifecycleElement
    const teardown = vi.fn()
    detached.setDisconnectHandler(teardown)

    expect(() => detached.disconnectedCallback()).not.toThrow()

    expect(teardown).toHaveBeenCalledOnce()
  })

  it('disconnecting twice leaves the element inert and does not throw', () => {
    const { el, render, onAction } = mountView()
    render({ step: 'type' })
    el.remove()

    expect(() => (el as LifecycleElement).disconnectedCallback()).not.toThrow()

    el.shadowRoot!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    expect(onAction).not.toHaveBeenCalled()
  })
})

describe('focus restoration — browser edge cases', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('opens and closes cleanly when the document reports no active element', async () => {
    vi.spyOn(document, 'activeElement', 'get').mockReturnValue(null)
    const { el, render } = mountView()

    render({ step: 'type' })
    await flushMicrotasks()
    render({ step: 'closed' })
    await flushMicrotasks()

    expect(el.shadowRoot!.querySelector('[data-action="open"]')).not.toBeNull()
  })
})

describe('sub-category step — taxonomy drift', () => {
  const table = SUB_CATEGORIES_BY_CATEGORY as unknown as Record<
    string,
    string[]
  >

  afterEach(() => {
    table.bug = table.bug!.filter((sub) => sub !== 'brand-new')
  })

  it('does not render a sub-category that has no icon yet', () => {
    // A sub-category added to the core table before the view learned its icon.
    table.bug!.push('brand-new')
    const { el, render } = mountView()

    render({ step: 'sub-category', selectedCategory: 'bug' })

    const rendered = Array.from(
      el.shadowRoot!.querySelectorAll<HTMLElement>('[data-sub-category]'),
    ).map((b) => b.dataset.subCategory)
    expect(rendered).not.toContain('brand-new')
    expect(rendered).toContain('crash')
  })
})
