import type { Category } from '@benoit-bremaud/feedback-widget-core'
import { CATEGORIES } from '@benoit-bremaud/feedback-widget-core'
import type {
  UserAction,
  View,
  WidgetState,
} from '@benoit-bremaud/feedback-widget-core'

const CATEGORY_LABELS: Record<Category, { icon: string; label: string }> = {
  bug: { icon: '🐛', label: 'Bug' },
  typo: { icon: '✏️', label: 'Faute de frappe' },
  error: { icon: '❌', label: 'Info erronée' },
  ambiguous: { icon: '🤔', label: 'Formulation ambiguë' },
  suggestion: { icon: '💡', label: 'Suggestion' },
  other: { icon: '➕', label: 'Autre' },
}

export interface WidgetViewOptions {
  maxMessageLength: number
  categories: readonly Category[]
  position: 'bottom-right' | 'bottom-left' | 'bottom-center'
}

const DEFAULT_VIEW_OPTIONS: WidgetViewOptions = {
  maxMessageLength: 500,
  categories: CATEGORIES,
  position: 'bottom-right',
}

export interface FeedbackWidgetElement extends HTMLElement {
  setActionHandler(cb: (action: UserAction) => void): void
  setOptions(options: Partial<WidgetViewOptions>): void
  updateState(state: WidgetState): void
  isHoneypotFilled(): boolean
}

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
      userMessage: '',
      reporterName: '',
      errorMessage: null,
    }
    private options: WidgetViewOptions = DEFAULT_VIEW_OPTIONS
    private previousStep: WidgetState['step'] = 'closed'
    private lastFocusedBeforeOpen: HTMLElement | null = null
    private boundKeyDown: ((ev: KeyboardEvent) => void) | null = null

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
      return `
        <div class="fw-pointing-bar" role="dialog" aria-modal="false" aria-labelledby="fw-title">
          <p class="fw-pointing-bar-text" id="fw-title">Tape sur le passage que tu veux signaler.</p>
          <button type="button" class="fw-btn fw-btn-ghost fw-btn-compact" data-action="cancel-pointing">Annuler</button>
        </div>
      `
    }

    private renderButton(): string {
      return `
      <button class="fw-trigger" type="button" aria-label="Signaler un problème sur cette page" data-action="open">
        <span aria-hidden="true">🚩</span>
        <span class="fw-trigger-label">Signaler</span>
      </button>
    `
    }

    private renderModal(): string {
      return `
      <div class="fw-backdrop" data-action="close"></div>
      <div class="fw-modal" role="dialog" aria-modal="true" aria-labelledby="fw-title">
        <button class="fw-close" type="button" aria-label="Fermer" data-action="close">×</button>
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
        case 'precision':
          return this.renderPrecisionStep()
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
      const excerpt = this.state.target?.excerpt ?? ''
      const headingText = this.state.target?.headingText ?? ''

      return `
      <h2 id="fw-title" class="fw-title">C'est bien ce passage&nbsp;?</h2>
      ${
        hasTarget
          ? `<div class="fw-target-preview">
             ${headingText ? `<p class="fw-target-heading">§ ${escapeHtml(headingText)}</p>` : ''}
             <p class="fw-target-excerpt">« ${escapeHtml(excerpt)} »</p>
           </div>`
          : `<p class="fw-subtitle">Aucun passage précis détecté — tu peux quand même continuer ou choisir un bloc.</p>`
      }
      <div class="fw-actions">
        <button type="button" class="fw-btn fw-btn-ghost" data-action="reject-target">Choisir un autre</button>
        <button type="button" class="fw-btn fw-btn-primary" data-action="confirm-target">Oui, continuer</button>
      </div>
    `
    }

    private renderTypeStep(): string {
      const buttons = this.options.categories
        .map((cat) => {
          const meta = CATEGORY_LABELS[cat]
          if (!meta) return ''
          return `
        <button type="button" class="fw-category" data-category="${cat}">
          <span class="fw-category-icon" aria-hidden="true">${meta.icon}</span>
          <span class="fw-category-label">${meta.label}</span>
        </button>
      `
        })
        .join('')

      return `
      <h2 id="fw-title" class="fw-title">Qu'est-ce qui ne va pas sur cette page&nbsp;?</h2>
      <p class="fw-subtitle">Choisis le type de problème.</p>
      <div class="fw-categories" role="group" aria-label="Type de problème">
        ${buttons}
      </div>
    `
    }

    private renderPrecisionStep(): string {
      const cat = this.state.selectedCategory
      const label = cat ? (CATEGORY_LABELS[cat]?.label ?? '') : ''
      const messageRequired = cat === 'other'
      const placeholder = messageRequired
        ? 'Décris ce que tu as vu (obligatoire)'
        : 'Précise (optionnel)'
      return `
      <h2 id="fw-title" class="fw-title">${label}</h2>
      <p class="fw-subtitle">Ajoute une précision si tu peux, et ton prénom si tu veux.</p>
      <form class="fw-form" data-action="submit-form" novalidate>
        <label class="fw-label">
          <span class="fw-label-text">Précision ${messageRequired ? '' : '(optionnel)'}</span>
          <textarea
            class="fw-textarea"
            name="message"
            maxlength="${this.options.maxMessageLength}"
            placeholder="${placeholder}"
            ${messageRequired ? 'required' : ''}
          >${escapeHtml(this.state.userMessage)}</textarea>
        </label>
        ${this.state.errorMessage ? `<p class="fw-inline-error" role="alert">${escapeHtml(this.state.errorMessage)}</p>` : ''}
        <label class="fw-label">
          <span class="fw-label-text">Prénom (optionnel)</span>
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
          <button type="button" class="fw-btn fw-btn-ghost" data-action="reset">Retour</button>
          <button type="submit" class="fw-btn fw-btn-primary">Envoyer</button>
        </div>
        <p class="fw-privacy">Les retours sont envoyés anonymement. Le prénom n'est utilisé que pour identifier ton feedback.</p>
      </form>
    `
    }

    private renderSendingStep(): string {
      return `
      <h2 id="fw-title" class="fw-title">Envoi en cours…</h2>
      <div class="fw-spinner" aria-hidden="true"></div>
    `
    }

    private renderConfirmedStep(): string {
      return `
      <h2 id="fw-title" class="fw-title">Merci&nbsp;! 🙏</h2>
      <p class="fw-subtitle">Ton retour a bien été envoyé.</p>
      <div class="fw-actions fw-actions-center">
        <button type="button" class="fw-btn fw-btn-ghost" data-action="close">Fermer</button>
        <button type="button" class="fw-btn fw-btn-primary" data-action="reset">Signaler autre chose</button>
      </div>
    `
    }

    private renderErrorStep(): string {
      return `
      <h2 id="fw-title" class="fw-title">Oups…</h2>
      <p class="fw-subtitle">${escapeHtml(this.state.errorMessage ?? 'Une erreur est survenue.')}</p>
      <div class="fw-actions fw-actions-center">
        <button type="button" class="fw-btn fw-btn-ghost" data-action="close">Fermer</button>
        <button type="button" class="fw-btn fw-btn-primary" data-action="submit">Réessayer</button>
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
          const cat = el.dataset.category as Category | undefined
          if (!cat) return
          el.addEventListener('click', () =>
            this.emit({ kind: 'select-category', category: cat }),
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
      const justOpened =
        this.previousStep === 'closed' && this.state.step !== 'closed'
      const justClosed =
        this.previousStep !== 'closed' && this.state.step === 'closed'

      if (justOpened) {
        this.lastFocusedBeforeOpen =
          (document.activeElement as HTMLElement | null) ?? null
      }

      if (stepChanged && this.state.step !== 'closed') {
        queueMicrotask(() => {
          const first = this.shadowRoot?.querySelector<HTMLElement>(
            'textarea, input:not(.fw-honeypot), button:not(.fw-close)',
          )
          first?.focus()
        })
      }

      if (justClosed && this.lastFocusedBeforeOpen) {
        const toRestore = this.lastFocusedBeforeOpen
        queueMicrotask(() => toRestore.focus())
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

export function createWebComponentView(element: FeedbackWidgetElement): View {
  let handler: ((action: UserAction) => void) | null = null
  let lastState: WidgetState = {
    step: 'closed',
    target: null,
    selectedCategory: null,
    userMessage: '',
    reporterName: '',
    errorMessage: null,
  }

  element.setActionHandler((action) => handler?.(action))

  return {
    render(state: WidgetState): void {
      lastState = state
      element.updateState(state)
    },
    onUserAction(cb: (action: UserAction) => void): void {
      handler = cb
    },
    showConfirmation(): void {
      const next: WidgetState = {
        step: 'confirmed',
        target: null,
        selectedCategory: null,
        userMessage: '',
        reporterName: '',
        errorMessage: null,
      }
      lastState = next
      element.updateState(next)
    },
    showMailtoFallback(mailtoUrl: string, message: string): void {
      const next: WidgetState = {
        ...lastState,
        step: 'error',
        errorMessage: `${message} — tu peux aussi nous écrire par mail : ${mailtoUrl}`,
      }
      lastState = next
      element.updateState(next)
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
    background: #c8102e;
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    opacity: 0.55;
    box-shadow: 0 4px 14px rgba(0,0,0,0.25);
    transition: opacity 120ms ease, transform 120ms ease;
  }
  .fw-trigger:hover,
  .fw-trigger:focus-visible {
    opacity: 1;
    transform: translateY(-1px);
    outline: 2px solid #fff;
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
    background: rgba(0,0,0,0.45);
    z-index: 1;
    pointer-events: auto;
  }
  .fw-modal {
    position: absolute;
    bottom: 16px;
    right: 16px;
    z-index: 2;
    pointer-events: auto;
    background: #fff;
    color: #111;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
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
    color: #666;
  }
  .fw-close:hover,
  .fw-close:focus-visible {
    color: #000;
    outline: none;
  }
  .fw-title {
    margin: 0 0 4px;
    font-size: 18px;
    padding-right: 32px;
  }
  .fw-subtitle {
    margin: 0 0 16px;
    font-size: 14px;
    color: #555;
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
    background: #f6f6f8;
    border: 1px solid #e0e0e5;
    border-radius: 10px;
    cursor: pointer;
    font-size: 14px;
    color: #111;
    transition: background 120ms ease, border-color 120ms ease;
  }
  .fw-category:hover,
  .fw-category:focus-visible {
    background: #fff;
    border-color: #c8102e;
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
    border: 1px solid #ccc;
    border-radius: 8px;
    background: #fff;
    color: #111;
  }
  .fw-textarea {
    min-height: 80px;
    resize: vertical;
  }
  .fw-textarea:focus,
  .fw-input:focus {
    outline: 2px solid #c8102e;
    outline-offset: 1px;
    border-color: #c8102e;
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
    background: #c8102e;
    color: #fff;
  }
  .fw-btn-primary:hover,
  .fw-btn-primary:focus-visible {
    background: #a50d25;
    outline: 2px solid #000;
    outline-offset: 2px;
  }
  .fw-btn-ghost {
    background: transparent;
    color: #111;
    border: 1px solid #ccc;
  }
  .fw-btn-ghost:hover,
  .fw-btn-ghost:focus-visible {
    background: #f0f0f2;
    outline: 2px solid #000;
    outline-offset: 2px;
  }
  .fw-privacy {
    margin: 8px 0 0;
    font-size: 12px;
    color: #666;
  }
  .fw-inline-error {
    margin: 0;
    padding: 8px 10px;
    background: #fff3f3;
    border: 1px solid #e5a5a5;
    border-radius: 6px;
    color: #a50d25;
    font-size: 13px;
  }
  .fw-target-preview {
    margin: 0 0 12px;
    padding: 10px 12px;
    background: #f6f6f8;
    border-left: 3px solid #c8102e;
    border-radius: 4px;
    font-size: 13px;
  }
  .fw-target-heading {
    margin: 0 0 4px;
    color: #555;
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .fw-target-excerpt {
    margin: 0;
    color: #222;
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
    background: #fff;
    color: #111;
    border-radius: 999px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.25);
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
    border: 3px solid #eee;
    border-top-color: #c8102e;
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
