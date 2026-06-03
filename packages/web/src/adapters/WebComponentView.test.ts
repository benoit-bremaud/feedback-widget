import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WidgetState } from '@benoit-bremaud/feedback-widget-core'
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
    el.setOptions({ categories: ['bug', 'typo', 'other'] })
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
      selectedCategory: 'other',
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

describe('createWebComponentView — confirmation + fallback', () => {
  it('showConfirmation renders the confirmed step', () => {
    const el = mountElement()
    const view = createWebComponentView(el)
    view.render(initialState())

    view.showConfirmation()

    expect(el.shadowRoot!.textContent?.toLowerCase()).toMatch(/merci|thank/)
  })

  it('showMailtoFallback renders the error step with the mailto URL + supplied message', () => {
    const el = mountElement()
    const view = createWebComponentView(el)
    view.render(initialState())

    view.showMailtoFallback('mailto:ops@example.test?subject=test', 'pipe down')

    const shadow = el.shadowRoot!
    // The adapter puts the mailto URL + message into the errorMessage on
    // the error step — assert both substrings appear in the shadow DOM.
    expect(shadow.textContent).toContain('pipe down')
    expect(shadow.textContent).toContain('mailto:ops@example.test')
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
    el.setOptions({ categories: ['bug', 'typo'] })
    const view = createWebComponentView(el)
    const onAction = vi.fn()
    view.onUserAction(onAction)
    view.render({ ...initialState(), step: 'type' })

    const button = el.shadowRoot!.querySelector<HTMLButtonElement>(
      '[data-category="typo"]',
    )
    button?.click()

    expect(onAction).toHaveBeenCalledWith({
      kind: 'select-category',
      category: 'typo',
    })
  })

  it('renders the 5 sub-category buttons for the selected category', () => {
    const el = mountElement()
    const view = createWebComponentView(el)
    view.render({
      ...initialState(),
      step: 'sub-category',
      selectedCategory: 'bug',
    })

    const buttons = el.shadowRoot!.querySelectorAll('[data-sub-category]')
    expect(buttons).toHaveLength(5)
    expect(
      el.shadowRoot!.querySelector('[data-sub-category="crash"]'),
    ).not.toBeNull()
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

  it('shows a category › sub-category breadcrumb on the precision step', () => {
    const el = mountElement()
    const view = createWebComponentView(el)
    view.render({
      ...initialState(),
      step: 'precision',
      selectedCategory: 'bug',
      selectedSubCategory: 'crash',
    })

    const title = el.shadowRoot!.querySelector('.fw-title')?.textContent ?? ''
    expect(title).toContain('Bug')
    expect(title).toContain('Plantage')
  })

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
      selectedCategory: 'other',
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
      selectedCategory: 'other',
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

    expect(el.shadowRoot!.textContent).toContain(
      'Choisis le type de problème.',
    )
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
