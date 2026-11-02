import type {
  TopLevelCategory,
  SubCategory,
  Theme,
} from '@benoit-bremaud/feedback-widget-core'
import {
  TOP_LEVEL_CATEGORIES,
  SUB_CATEGORIES_BY_CATEGORY,
  isValidSubCategory,
} from '@benoit-bremaud/feedback-widget-core'
import type {
  UserAction,
  View,
  WidgetState,
} from '@benoit-bremaud/feedback-widget-core'
import type { Messages } from '../i18n'
import { LOCALES, promptFor } from '../i18n'

// Icons are locale-neutral, so they stay here; the text labels come from
// `Messages` (see ../i18n.ts) so the widget can render in any locale.
const CATEGORY_ICONS: Record<TopLevelCategory, string> = {
  bug: '🐛',
  display: '🎨',
  content: '✏️',
  unclear: '🤔',
  suggestion: '💡',
  praise: '💚',
}

const SUB_CATEGORY_ICONS: Record<SubCategory, string> = {
  // bug
  'no-effect': '🔧',
  crash: '💥',
  'form-rejected': '📋',
  'wrong-data': '🔢',
  'personal-data': '🔒',
  // display
  'broken-layout': '📐',
  mobile: '📱',
  'missing-media': '🖼️',
  'too-slow': '🐌',
  // content
  typo: '📝',
  'wrong-info': '❌',
  outdated: '📅',
  'dead-link': '🔗',
  // unclear
  wording: '💬',
  'missing-info': '🧩',
  navigation: '🧭',
  question: '❓',
  // suggestion
  'new-feature': '✨',
  improvement: '📈',
  design: '🖌️',
  accessibility: '♿',
  // every family but praise
  other: '➕',
}

/** Presentation options derived from the resolved config, applied through `setOptions`. */
export interface WidgetViewOptions {
  maxMessageLength: number
  categories: readonly TopLevelCategory[]
  position: 'bottom-right' | 'bottom-left' | 'bottom-center'
  theme: Theme | null
  messages: Messages
}

const DEFAULT_VIEW_OPTIONS: WidgetViewOptions = {
  maxMessageLength: 500,
  categories: TOP_LEVEL_CATEGORIES,
  position: 'bottom-right',
  theme: null,
  messages: LOCALES.fr,
}

/** Public surface of the `<feedback-widget>` custom element, used by the controller without depending on the concrete class. */
export interface FeedbackWidgetElement extends HTMLElement {
  setActionHandler(cb: (action: UserAction) => void): void
  setOptions(options: Partial<WidgetViewOptions>): void
  updateState(state: WidgetState): void
  isHoneypotFilled(): boolean
  /** Register teardown to run on disconnectedCallback (e.g. detector.destroy). */
  setDisconnectHandler(cb: () => void): void
}

/** Build the `<feedback-widget>` custom element class (Shadow DOM). Rendering goes through one `innerHTML` in which every user-provided string is escaped. The caller registers it with `customElements.define`. */
export function defineFeedbackWidgetElement(): CustomElementConstructor {
  class FeedbackWidgetElementImpl
    extends HTMLElement
    implements FeedbackWidgetElement
  {
    private actionHandler: ((action: UserAction) => void) | null = null
    private state: WidgetState = {
      step: 'closed',
      target: null,
      selectedCategory: null,
      selectedSubCategory: null,
      userMessage: '',
      reporterName: '',
      errorMessage: null,
    }
    private options: WidgetViewOptions = DEFAULT_VIEW_OPTIONS
    private previousStep: WidgetState['step'] = 'closed'
    private lastFocusedBeforeOpen: HTMLElement | null = null
    private boundKeyDown: ((ev: KeyboardEvent) => void) | null = null
    private onDisconnect: (() => void) | null = null

    connectedCallback(): void {
      if (!this.shadowRoot) {
        this.attachShadow({ mode: 'open' })
      }
      if (this.shadowRoot && !this.boundKeyDown) {
        this.boundKeyDown = (ev: KeyboardEvent) => this.handleKeyDown(ev)
        this.shadowRoot.addEventListener(
          'keydown',
          this.boundKeyDown as EventListener,
        )
      }
      this.renderInternal()
    }

    // Cleanup on unmount (SPA navigation, dynamic removal): remove the
    // shadow-root keydown listener and run the host-supplied teardown
    // (detector.destroy) so no document-level listeners or observers leak.
    disconnectedCallback(): void {
      if (this.shadowRoot && this.boundKeyDown) {
        this.shadowRoot.removeEventListener(
          'keydown',
          this.boundKeyDown as EventListener,
        )
        this.boundKeyDown = null
      }
      this.onDisconnect?.()
    }

    setDisconnectHandler(cb: () => void): void {
      this.onDisconnect = cb
    }

    setOptions(options: Partial<WidgetViewOptions> = {}): void {
      // Filter out undefined values so the caller can pass `undefined` to
      // mean "keep the current value" rather than overwrite with undefined.
      // Without this guard, object-spread would clobber the prior value,
      // e.g. `{ categories: undefined }` would collapse the default
      // categories array and crash renderTypeStep.
      // Note: this does NOT reset to DEFAULT_VIEW_OPTIONS — to reset a
      // key, the caller must explicitly pass the desired default value.
      const defined: Partial<WidgetViewOptions> = {}
      for (const [key, value] of Object.entries(options)) {
        if (value !== undefined) {
          ;(defined as Record<string, unknown>)[key] = value
        }
      }
      this.options = { ...this.options, ...defined }
      this.setAttribute('data-position', this.options.position)
      // Drive the Shadow-DOM palette: a host-provided theme wins; absence
      // (null) leaves the default light scheme (no attribute).
      if (this.options.theme) {
        this.setAttribute('data-theme', this.options.theme)
      } else {
        this.removeAttribute('data-theme')
      }
      this.renderInternal()
    }

    setActionHandler(cb: (action: UserAction) => void): void {
      this.actionHandler = cb
    }

    updateState(state: WidgetState): void {
      this.state = state
      this.renderInternal()
    }

    private emit(action: UserAction): void {
      this.actionHandler?.(action)
    }

    private renderInternal(): void {
      if (!this.shadowRoot) return
      // The trigger is only rendered when the widget is closed. Hiding it
      // while any other step is active prevents accidental re-open (which
      // would leave pointing mode enabled with an orphan document-level
      // capture listener).
      const showTrigger = this.state.step === 'closed'
      // Record the opener BEFORE innerHTML replaces the trigger: once the
      // focused trigger is removed, `document.activeElement` is <body>.
      if (this.previousStep === 'closed' && !showTrigger) {
        this.lastFocusedBeforeOpen =
          (document.activeElement as HTMLElement | null) ?? null
      }
      this.shadowRoot.innerHTML = `
        <style>${STYLES}</style>
        ${showTrigger ? this.renderButton() : ''}
        ${this.renderChrome()}
      `
      this.bindEvents()
      this.manageFocusOnStepChange()
    }

    private renderChrome(): string {
      if (this.state.step === 'closed') return ''
      // In pointing mode the page must remain clickable, so we skip the
      // full modal (with its backdrop) and show a compact floating bar
      // with only the « Annuler » button. This prevents the backdrop
      // from intercepting clicks on content blocks.
      if (this.state.step === 'pointing') {
        return this.renderPointingBar()
      }
      return this.renderModal()
    }

    private renderPointingBar(): string {
      const m = this.options.messages
      return `
        <div class="fw-pointing-bar" role="dialog" aria-modal="false" aria-labelledby="fw-title">
          <p class="fw-pointing-bar-text" id="fw-title">${m.pointing.text}</p>
          <button type="button" class="fw-btn fw-btn-ghost fw-btn-compact" data-action="cancel-pointing">${m.cancel}</button>
        </div>
      `
    }

    private renderButton(): string {
      const m = this.options.messages
      return `
      <button class="fw-trigger" type="button" aria-label="${m.trigger.aria}" data-action="open">
        <span aria-hidden="true">🚩</span>
        <span class="fw-trigger-label">${m.trigger.label}</span>
      </button>
    `
    }

    private renderModal(): string {
      return `
      <div class="fw-backdrop" data-action="close"></div>
      <div class="fw-modal" role="dialog" aria-modal="true" aria-labelledby="fw-title">
        <button class="fw-close" type="button" aria-label="${this.options.messages.close}" data-action="close">×</button>
        ${this.renderStep()}
      </div>
    `
    }

    private renderStep(): string {
      // Note: 'pointing' is not handled here. renderChrome() short-circuits
      // to renderPointingBar() before reaching the modal renderer.
      switch (this.state.step) {
        case 'target-confirm':
          return this.renderTargetConfirmStep()
        case 'type':
          return this.renderTypeStep()
        case 'sub-category':
          return this.renderSubCategoryStep()
        case 'precision':
          return this.renderPrecisionStep()
        case 'discard-confirm':
          return this.renderDiscardConfirmStep()
        case 'sending':
          return this.renderSendingStep()
        case 'confirmed':
          return this.renderConfirmedStep()
        case 'error':
          return this.renderErrorStep()
        default:
          return ''
      }
    }

    private renderTargetConfirmStep(): string {
      const hasTarget = this.state.target !== null
      // Fall back to the accessible label when there is no text excerpt
      // (e.g. an icon-only button targeted in pointing mode).
      const excerpt =
        this.state.target?.excerpt || this.state.target?.label || ''
      const headingText = this.state.target?.headingText ?? ''
      const m = this.options.messages

      return `
      <h2 id="fw-title" class="fw-title">${m.targetConfirm.title}</h2>
      ${
        hasTarget
          ? `<div class="fw-target-preview">
             ${headingText ? `<p class="fw-target-heading">§ ${escapeHtml(headingText)}</p>` : ''}
             <p class="fw-target-excerpt">« ${escapeHtml(excerpt)} »</p>
           </div>`
          : `<p class="fw-subtitle">${m.targetConfirm.noTarget}</p>`
      }
      <div class="fw-actions">
        <button type="button" class="fw-btn fw-btn-ghost" data-action="reject-target">${m.targetConfirm.reject}</button>
        <button type="button" class="fw-btn fw-btn-primary" data-action="confirm-target">${m.targetConfirm.confirm}</button>
      </div>
    `
    }

    private renderTypeStep(): string {
      const m = this.options.messages
      const buttons = this.options.categories
        .map((cat) => {
          const icon = CATEGORY_ICONS[cat]
          if (!icon) return ''
          return `
        <button type="button" class="fw-category" data-category="${cat}">
          <span class="fw-category-icon" aria-hidden="true">${icon}</span>
          <span class="fw-category-label">${m.categoryLabels[cat]}</span>
        </button>
      `
        })
        .join('')

      return `
      <h2 id="fw-title" class="fw-title">${m.type.title}</h2>
      <p class="fw-subtitle">${m.type.subtitle}</p>
      <div class="fw-categories" role="group" aria-label="${m.type.aria}">
        ${buttons}
      </div>
    `
    }

    private renderSubCategoryStep(): string {
      const m = this.options.messages
      const cat = this.state.selectedCategory
      if (cat === null || cat === 'praise') {
        // Defensive: 'praise' has no sub-categories and should never reach
        // this step. Fall back to the category picker.
        return this.renderTypeStep()
      }
      const buttons = SUB_CATEGORIES_BY_CATEGORY[cat]
        .map((sub) => {
          const icon = SUB_CATEGORY_ICONS[sub]
          if (!icon) return ''
          return `
        <button type="button" class="fw-category" data-sub-category="${sub}">
          <span class="fw-category-icon" aria-hidden="true">${icon}</span>
          <span class="fw-category-label">${m.subCategoryLabels[sub]}</span>
        </button>
      `
        })
        .join('')

      return `
      ${this.renderBreadcrumb()}
      <h2 id="fw-title" class="fw-title">${m.subCategory.subtitle}</h2>
      <div class="fw-categories" role="group" aria-label="${m.subCategory.aria}">
        ${buttons}
      </div>
      <div class="fw-actions">
        <button type="button" class="fw-btn fw-btn-ghost" data-action="back">${m.back}</button>
      </div>
    `
    }

    private renderPrecisionStep(): string {
      const m = this.options.messages
      const cat = this.state.selectedCategory
      const sub = this.state.selectedSubCategory
      const guide = promptFor(m, cat, sub)
      return `
      ${this.renderBreadcrumb()}
      <h2 id="fw-title" class="fw-title">${guide.question}</h2>
      <form class="fw-form" data-action="submit-form" novalidate>
        <label class="fw-label">
          <span class="fw-label-text">${m.precision.descriptionLabel}</span>
          <textarea
            class="fw-textarea"
            name="message"
            maxlength="${this.options.maxMessageLength}"
            placeholder="${guide.placeholder}"
            required
          >${escapeHtml(this.state.userMessage)}</textarea>
        </label>
        ${this.state.errorMessage ? `<p class="fw-inline-error" role="alert">${escapeHtml(this.state.errorMessage)}</p>` : ''}
        <label class="fw-label">
          <span class="fw-label-text">${m.precision.reporterLabel}</span>
          <input
            class="fw-input"
            type="text"
            name="reporter"
            maxlength="50"
            value="${escapeHtml(this.state.reporterName)}"
            autocomplete="given-name"
          />
        </label>
        <input type="text" name="website" class="fw-honeypot" tabindex="-1" autocomplete="off" aria-hidden="true" />
        <div class="fw-actions">
          <button type="button" class="fw-btn fw-btn-ghost" data-action="back">${m.back}</button>
          <button type="submit" class="fw-btn fw-btn-primary">${m.precision.submit}</button>
        </div>
        <p class="fw-privacy">${m.precision.privacy}</p>
      </form>
    `
    }

    /**
     * `family › sub-family` on screens ④ and ⑤. Only the last link is
     * clickable and emits `back`, which already lands on the previous
     * screen, so no extra `UserAction` is needed (spec D5).
     */
    private renderBreadcrumb(): string {
      const m = this.options.messages
      const cat = this.state.selectedCategory
      if (cat === null) return ''
      const sub = this.state.selectedSubCategory
      const onPrecision = this.state.step === 'precision'
      const link = (label: string): string =>
        `<button type="button" class="fw-crumb-link" data-action="back">${label}</button>`
      const family = m.categoryLabels[cat]
      const parts =
        onPrecision && sub !== null
          ? [family, link(m.subCategoryLabels[sub])]
          : [link(family)]
      return `<nav class="fw-breadcrumb" aria-label="${m.breadcrumb}">${parts.join(' <span aria-hidden="true">›</span> ')}</nav>`
    }

    private renderDiscardConfirmStep(): string {
      const m = this.options.messages.discardConfirm
      // `keep-editing` comes first so it receives the focus.
      return `
      <h2 id="fw-title" class="fw-title">${m.title}</h2>
      <p class="fw-subtitle">${m.subtitle}</p>
      <div class="fw-actions fw-actions-center">
        <button type="button" class="fw-btn fw-btn-primary" data-action="keep-editing">${m.keepEditing}</button>
        <button type="button" class="fw-btn fw-btn-ghost" data-action="discard">${m.discard}</button>
      </div>
    `
    }

    private renderSendingStep(): string {
      return `
      <h2 id="fw-title" class="fw-title">${this.options.messages.sending}</h2>
      <div class="fw-spinner" aria-hidden="true"></div>
    `
    }

    private renderConfirmedStep(): string {
      const m = this.options.messages
      return `
      <h2 id="fw-title" class="fw-title">${m.confirmed.title}</h2>
      <p class="fw-subtitle">${m.confirmed.subtitle}</p>
      <div class="fw-actions fw-actions-center">
        <button type="button" class="fw-btn fw-btn-ghost" data-action="close">${m.close}</button>
        <button type="button" class="fw-btn fw-btn-primary" data-action="reset">${m.confirmed.reset}</button>
      </div>
    `
    }

    private renderErrorStep(): string {
      const m = this.options.messages
      return `
      <h2 id="fw-title" class="fw-title">${m.error.title}</h2>
      <p class="fw-subtitle">${escapeHtml(this.state.errorMessage ?? m.error.defaultMessage)}</p>
      <div class="fw-actions fw-actions-center">
        <button type="button" class="fw-btn fw-btn-ghost" data-action="close">${m.close}</button>
        <button type="button" class="fw-btn fw-btn-primary" data-action="submit">${m.error.retry}</button>
      </div>
    `
    }

    private bindEvents(): void {
      if (!this.shadowRoot) return

      this.shadowRoot
        .querySelectorAll<HTMLElement>('[data-action]')
        .forEach((el) => {
          const action = el.dataset.action
          if (action === 'open') {
            el.addEventListener('click', () => this.emit({ kind: 'open' }))
          } else if (action === 'close') {
            el.addEventListener('click', () => this.emit({ kind: 'close' }))
          } else if (action === 'reset') {
            el.addEventListener('click', () => this.emit({ kind: 'reset' }))
          } else if (action === 'keep-editing') {
            el.addEventListener('click', () =>
              this.emit({ kind: 'keep-editing' }),
            )
          } else if (action === 'discard') {
            el.addEventListener('click', () => this.emit({ kind: 'discard' }))
          } else if (action === 'back') {
            el.addEventListener('click', () => this.emit({ kind: 'back' }))
          } else if (action === 'submit') {
            el.addEventListener('click', () => this.emit({ kind: 'submit' }))
          } else if (action === 'confirm-target') {
            el.addEventListener('click', () =>
              this.emit({ kind: 'confirm-target' }),
            )
          } else if (action === 'reject-target') {
            el.addEventListener('click', () =>
              this.emit({ kind: 'reject-target' }),
            )
          } else if (action === 'cancel-pointing') {
            el.addEventListener('click', () =>
              this.emit({ kind: 'cancel-pointing' }),
            )
          }
        })

      this.shadowRoot
        .querySelectorAll<HTMLElement>('[data-category]')
        .forEach((el) => {
          const cat = el.dataset.category as TopLevelCategory | undefined
          if (!cat) return
          el.addEventListener('click', () =>
            this.emit({ kind: 'select-category', category: cat }),
          )
        })

      this.shadowRoot
        .querySelectorAll<HTMLElement>('[data-sub-category]')
        .forEach((el) => {
          const raw = el.dataset.subCategory
          const cat = this.state.selectedCategory
          // Validate the DOM-sourced string against the current
          // category before trusting the cast. buildFeedbackPayload is
          // the final backstop, but validating here keeps an invalid
          // value from ever entering the action stream.
          if (!raw || cat === null || !isValidSubCategory(cat, raw)) {
            return
          }
          const sub = raw as SubCategory
          el.addEventListener('click', () =>
            this.emit({ kind: 'select-sub-category', subCategory: sub }),
          )
        })

      const form = this.shadowRoot.querySelector<HTMLFormElement>(
        'form[data-action="submit-form"]',
      )
      if (form) {
        form.addEventListener('submit', (ev) => {
          ev.preventDefault()
          this.emit({ kind: 'submit' })
        })
      }

      const textarea = this.shadowRoot.querySelector<HTMLTextAreaElement>(
        'textarea[name="message"]',
      )
      if (textarea) {
        textarea.addEventListener('input', () => {
          this.emit({ kind: 'update-message', value: textarea.value })
        })
      }

      const reporter = this.shadowRoot.querySelector<HTMLInputElement>(
        'input[name="reporter"]',
      )
      if (reporter) {
        reporter.addEventListener('input', () => {
          this.emit({ kind: 'update-reporter', value: reporter.value })
        })
      }
    }

    private handleKeyDown(ev: KeyboardEvent): void {
      if (ev.key === 'Escape') {
        ev.preventDefault()
        this.emit({ kind: 'close' })
        return
      }
      if (ev.key === 'Tab' && this.state.step !== 'closed') {
        this.trapFocus(ev)
      }
    }

    private trapFocus(ev: KeyboardEvent): void {
      if (!this.shadowRoot) return
      const focusable = Array.from(
        this.shadowRoot.querySelectorAll<HTMLElement>(
          'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return
      const active = this.shadowRoot.activeElement as HTMLElement | null
      const activeIsRoot = (active as unknown) === this.shadowRoot
      if (ev.shiftKey && (active === first || activeIsRoot)) {
        ev.preventDefault()
        last.focus()
      } else if (!ev.shiftKey && active === last) {
        ev.preventDefault()
        first.focus()
      }
    }

    private manageFocusOnStepChange(): void {
      if (!this.shadowRoot) return
      const stepChanged = this.state.step !== this.previousStep
      const justClosed =
        this.previousStep !== 'closed' && this.state.step === 'closed'

      if (stepChanged && this.state.step !== 'closed') {
        queueMicrotask(() => {
          const first = this.shadowRoot?.querySelector<HTMLElement>(
            'textarea, input:not(.fw-honeypot), button:not(.fw-close):not(.fw-crumb-link)',
          )
          first?.focus()
        })
      }

      if (justClosed && this.lastFocusedBeforeOpen) {
        const opener = this.lastFocusedBeforeOpen
        // Opened from our own trigger, `document.activeElement` is this
        // shadow host, and the trigger was re-rendered: focus the new one.
        queueMicrotask(() => {
          const target =
            opener === this
              ? this.shadowRoot?.querySelector<HTMLElement>('.fw-trigger')
              : opener
          target?.focus()
        })
        this.lastFocusedBeforeOpen = null
      }

      this.previousStep = this.state.step
    }

    isHoneypotFilled(): boolean {
      if (!this.shadowRoot) return false
      const honeypot =
        this.shadowRoot.querySelector<HTMLInputElement>('input.fw-honeypot')
      return honeypot !== null && honeypot.value.trim().length > 0
    }
  }

  return FeedbackWidgetElementImpl
}

/** Adapt a `FeedbackWidgetElement` to the core `View` port. */
export function createWebComponentView(element: FeedbackWidgetElement): View {
  let handler: ((action: UserAction) => void) | null = null
  element.setActionHandler((action) => handler?.(action))

  return {
    render(state: WidgetState): void {
      element.updateState(state)
    },
    onUserAction(cb: (action: UserAction) => void): void {
      handler = cb
    },
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const STYLES = `
  :host {
    all: initial;
    position: fixed;
    inset: 0;
    z-index: 2147483000;
    pointer-events: none;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;

    /* Light palette (default). Dark overrides below. A host drives the
       scheme via the data-theme attribute (see setOptions). */
    --fw-accent: #c8102e;
    --fw-accent-strong: #a50d25;
    --fw-on-accent: #fff;
    --fw-surface: #fff;
    --fw-surface-2: #f6f6f8;
    --fw-fg: #111;
    --fw-muted: #555;
    --fw-border: #ccc;
    --fw-border-subtle: #e0e0e5;
    --fw-error-bg: #fff3f3;
    --fw-error-border: #e5a5a5;
    --fw-error-fg: #a50d25;
    --fw-focus-ring: #000;
    --fw-backdrop: rgba(0, 0, 0, 0.45);
    --fw-shadow: rgba(0, 0, 0, 0.3);
    --fw-shadow-soft: rgba(0, 0, 0, 0.25);
  }
  :host([data-theme="dark"]) {
    --fw-accent: #e8364f;
    --fw-accent-strong: #c8102e;
    --fw-on-accent: #fff;
    --fw-surface: #1f1f27;
    --fw-surface-2: #2a2a33;
    --fw-fg: #f2f2f5;
    --fw-muted: #a8a8b3;
    --fw-border: #45454f;
    --fw-border-subtle: #3a3a43;
    --fw-error-bg: #3a1f23;
    --fw-error-border: #7a3b42;
    --fw-error-fg: #ffb3bd;
    --fw-focus-ring: #fff;
    --fw-backdrop: rgba(0, 0, 0, 0.6);
    --fw-shadow: rgba(0, 0, 0, 0.6);
    --fw-shadow-soft: rgba(0, 0, 0, 0.5);
  }
  .fw-trigger {
    position: absolute;
    bottom: 16px;
    right: 16px;
    pointer-events: auto;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border: none;
    border-radius: 999px;
    background: var(--fw-accent);
    color: var(--fw-on-accent);
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    opacity: 0.55;
    box-shadow: 0 4px 14px var(--fw-shadow-soft);
    transition: opacity 120ms ease, transform 120ms ease;
  }
  .fw-trigger:hover,
  .fw-trigger:focus-visible {
    opacity: 1;
    transform: translateY(-1px);
    outline: 2px solid var(--fw-on-accent);
    outline-offset: 2px;
  }
  .fw-trigger-label {
    font-size: 14px;
  }
  @media (max-width: 480px) {
    .fw-trigger-label { display: none; }
    .fw-trigger { padding: 12px; font-size: 18px; }
  }
  .fw-backdrop {
    position: absolute;
    inset: 0;
    background: var(--fw-backdrop);
    z-index: 1;
    pointer-events: auto;
  }
  .fw-modal {
    position: absolute;
    bottom: 16px;
    right: 16px;
    z-index: 2;
    pointer-events: auto;
    background: var(--fw-surface);
    color: var(--fw-fg);
    border-radius: 12px;
    box-shadow: 0 10px 40px var(--fw-shadow);
    padding: 20px;
    width: min(420px, calc(100vw - 32px));
    max-height: calc(100vh - 32px);
    overflow-y: auto;
  }
  @media (max-width: 480px) {
    .fw-modal {
      bottom: 0; right: 0; left: 0;
      width: auto;
      border-radius: 12px 12px 0 0;
    }
  }
  .fw-close {
    position: absolute;
    top: 8px;
    right: 12px;
    background: none;
    border: none;
    font-size: 28px;
    line-height: 1;
    cursor: pointer;
    color: var(--fw-muted);
  }
  .fw-close:hover,
  .fw-close:focus-visible {
    color: var(--fw-fg);
    outline: none;
  }
  .fw-title {
    margin: 0 0 4px;
    font-size: 18px;
    padding-right: 32px;
  }
  .fw-breadcrumb {
    margin: 0 0 8px;
    font-size: 13px;
    color: var(--fw-muted);
  }
  .fw-crumb-link {
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    color: inherit;
    text-decoration: underline;
    cursor: pointer;
  }
  .fw-subtitle {
    margin: 0 0 16px;
    font-size: 14px;
    color: var(--fw-muted);
  }
  .fw-categories {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .fw-category {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 14px 8px;
    background: var(--fw-surface-2);
    border: 1px solid var(--fw-border-subtle);
    border-radius: 10px;
    cursor: pointer;
    font-size: 14px;
    color: var(--fw-fg);
    transition: background 120ms ease, border-color 120ms ease;
  }
  .fw-category:hover,
  .fw-category:focus-visible {
    background: var(--fw-surface);
    border-color: var(--fw-accent);
    outline: none;
  }
  .fw-category-icon {
    font-size: 24px;
  }
  .fw-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .fw-label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 14px;
  }
  .fw-label-text {
    font-weight: 600;
  }
  .fw-textarea, .fw-input {
    font: inherit;
    padding: 8px 10px;
    border: 1px solid var(--fw-border);
    border-radius: 8px;
    background: var(--fw-surface);
    color: var(--fw-fg);
  }
  .fw-textarea {
    min-height: 80px;
    resize: vertical;
  }
  .fw-textarea:focus,
  .fw-input:focus {
    outline: 2px solid var(--fw-accent);
    outline-offset: 1px;
    border-color: var(--fw-accent);
  }
  .fw-honeypot {
    position: absolute;
    left: -9999px;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }
  .fw-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 8px;
  }
  .fw-actions-center {
    justify-content: center;
  }
  .fw-btn {
    padding: 10px 16px;
    border-radius: 8px;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    border: none;
  }
  .fw-btn-primary {
    background: var(--fw-accent);
    color: var(--fw-on-accent);
  }
  .fw-btn-primary:hover,
  .fw-btn-primary:focus-visible {
    background: var(--fw-accent-strong);
    outline: 2px solid var(--fw-focus-ring);
    outline-offset: 2px;
  }
  .fw-btn-ghost {
    background: transparent;
    color: var(--fw-fg);
    border: 1px solid var(--fw-border);
  }
  .fw-btn-ghost:hover,
  .fw-btn-ghost:focus-visible {
    background: var(--fw-surface-2);
    outline: 2px solid var(--fw-focus-ring);
    outline-offset: 2px;
  }
  .fw-privacy {
    margin: 8px 0 0;
    font-size: 12px;
    color: var(--fw-muted);
  }
  .fw-inline-error {
    margin: 0;
    padding: 8px 10px;
    background: var(--fw-error-bg);
    border: 1px solid var(--fw-error-border);
    border-radius: 6px;
    color: var(--fw-error-fg);
    font-size: 13px;
  }
  .fw-target-preview {
    margin: 0 0 12px;
    padding: 10px 12px;
    background: var(--fw-surface-2);
    border-left: 3px solid var(--fw-accent);
    border-radius: 4px;
    font-size: 13px;
  }
  .fw-target-heading {
    margin: 0 0 4px;
    color: var(--fw-muted);
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .fw-target-excerpt {
    margin: 0;
    color: var(--fw-fg);
    font-style: italic;
    line-height: 1.4;
  }
  /* The pointing bar is intentionally centered regardless of the widget's
     configured position (bottom-left/right/center). Pointing mode is an
     ephemeral state where the user needs to see their whole page; a
     centered bar avoids hand-dominance bias on mobile and prevents the
     bar from overlapping the top-left/right reading area on desktop. */
  .fw-pointing-bar {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2;
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: var(--fw-surface);
    color: var(--fw-fg);
    border-radius: 999px;
    box-shadow: 0 4px 20px var(--fw-shadow-soft);
    max-width: calc(100vw - 32px);
  }
  .fw-pointing-bar-text {
    margin: 0;
    font-size: 14px;
    font-weight: 500;
  }
  @media (max-width: 480px) {
    .fw-pointing-bar {
      border-radius: 12px;
      padding: 12px 16px;
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
    }
    .fw-pointing-bar-text { text-align: center; }
  }
  .fw-btn-compact {
    padding: 6px 14px;
    font-size: 13px;
  }
  :host([data-position="bottom-left"]) .fw-trigger,
  :host([data-position="bottom-left"]) .fw-modal {
    right: auto;
    left: 16px;
  }
  :host([data-position="bottom-center"]) .fw-trigger,
  :host([data-position="bottom-center"]) .fw-modal {
    right: 50%;
    transform: translateX(50%);
  }
  .fw-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--fw-border);
    border-top-color: var(--fw-accent);
    border-radius: 50%;
    margin: 16px auto;
    animation: fw-spin 800ms linear infinite;
  }
  @keyframes fw-spin {
    to { transform: rotate(360deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    .fw-trigger { transition: none; }
    .fw-spinner { animation-duration: 2000ms; }
  }
`
