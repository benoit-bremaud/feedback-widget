import {
  requiresSubCategory,
  MIN_MESSAGE_LENGTH,
  buildFeedbackPayload,
  submitFeedback,
  drainOutbox,
  resolveConfig,
  type FeedbackPayload,
  type WidgetState,
  type ViewportDetector,
  type WidgetConfig,
} from '@benoit-bremaud/feedback-widget-core'
import { createHttpTransport, defaultBackoff } from './adapters/HttpTransport'
import { createLocalStorageRateLimiter } from './adapters/LocalStorageRateLimiter'
import { createLocalStorageOutbox } from './adapters/LocalStorageOutbox'
import { createIntersectionViewportDetector } from './adapters/IntersectionViewportDetector'
import { createBrowserContextCollector } from './adapters/BrowserContextCollector'
import type { FeedbackWidgetElement } from './adapters/WebComponentView'
import {
  createWebComponentView,
  defineFeedbackWidgetElement,
} from './adapters/WebComponentView'
import { LOCALES } from './i18n'
import type { Messages } from './i18n'

const TAG_NAME = 'feedback-widget'
const OUTBOX_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
// Must track packages/web/package.json version. The version.test.ts
// node-env test guards against drift on future bumps.
export const WIDGET_VERSION = '0.5.0'

export interface FeedbackWidgetHandle {
  // Rescans observed blocks. Call this after a SPA navigation or any DOM
  // mutation that replaces the content area, so viewport detection and
  // pointing mode target the current page's blocks.
  refresh(): void
}

const NOOP_HANDLE: FeedbackWidgetHandle = { refresh: () => {} }

export function mountFeedbackWidget(
  config: WidgetConfig,
): FeedbackWidgetHandle {
  if (typeof window === 'undefined' || typeof customElements === 'undefined') {
    return NOOP_HANDLE
  }

  if (!customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, defineFeedbackWidgetElement())
  }

  const existing = document.querySelector<FeedbackWidgetElement>(TAG_NAME)
  if (existing) {
    const handle = handleRegistry.get(existing)
    if (handle) {
      handle.refresh()
      return handle
    }
  }

  const element = document.createElement(TAG_NAME) as FeedbackWidgetElement
  document.body.appendChild(element)

  const handle = attachController(element, resolveConfig(config))
  handleRegistry.set(element, handle)
  return handle
}

const handleRegistry = new WeakMap<
  FeedbackWidgetElement,
  FeedbackWidgetHandle
>()

function attachController(
  element: FeedbackWidgetElement,
  config: ReturnType<typeof resolveConfig>,
): FeedbackWidgetHandle {
  const view = createWebComponentView(element)
  const messages = LOCALES[config.locale]

  element.setOptions({
    maxMessageLength: config.maxMessageLength,
    categories: config.categories ?? undefined,
    position: config.position,
    theme: config.theme,
    messages,
  })

  const rateLimiter = createLocalStorageRateLimiter({
    storage: window.localStorage,
    key: `${config.storageNamespace}.${config.projectId}`,
    windowMs: config.rateLimitWindowMs,
    maxAttempts: config.rateLimitMaxAttempts,
    now: () => Date.now(),
  })

  const transport = createHttpTransport({
    endpoint: config.endpoint,
    token: config.token ?? undefined,
    maxAttempts: config.maxTransportAttempts,
    timeoutMs: config.transportTimeoutMs,
    backoffMs: defaultBackoff,
    fetchImpl: window.fetch.bind(window),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  })

  const outbox = createLocalStorageOutbox({
    storage: window.localStorage,
    key: `${config.storageNamespace}.outbox.${config.projectId}`,
    now: () => Date.now(),
  })

  const detector: ViewportDetector = createIntersectionViewportDetector({
    doc: document,
    win: window,
    // Trim and drop empty/whitespace so a blank value falls back to the
    // detector's own default ('main') rather than being treated as a
    // (throwing) empty selector. Genuinely-invalid non-empty selectors are
    // caught inside the detector.
    rootSelector: config.rootSelector?.trim() || undefined,
  })

  const contextCollector = createBrowserContextCollector({
    projectId: config.projectId,
    widgetVersion: WIDGET_VERSION,
    sessionId: newSessionId(),
  })

  detector.startObserving()

  // Best-effort background retry of queued feedback. Swallowing is
  // intentional (it must never break mount), but log so a persistent
  // failure is at least visible in the console rather than a silent
  // unhandled rejection.
  void drainOutbox({ outbox, transport, maxAgeMs: OUTBOX_MAX_AGE_MS }).catch(
    (err: unknown) => {
      console.warn('feedback-widget: outbox drain failed', err)
    },
  )

  let state: WidgetState = initialState()
  let formOpenedAt = 0

  // setState renders by default. Pass { silent: true } to update the
  // controller's state without re-rendering the shadow DOM — used while
  // the user is typing in a textarea/input, since the DOM already
  // reflects the typed value and re-rendering would destroy the focused
  // element and lose the caret.
  const setState = (
    next: Partial<WidgetState>,
    opts: { silent?: boolean } = {},
  ): void => {
    state = { ...state, ...next }
    if (!opts.silent) {
      view.render(state)
    }
  }

  view.render(state)

  view.onUserAction((action) => {
    switch (action.kind) {
      case 'open':
        formOpenedAt = Date.now()
        setState({
          step: 'target-confirm',
          target: detector.getCurrentTarget(),
          errorMessage: null,
        })
        break

      case 'close':
        detector.disablePointingMode()
        detector.clearHighlight()
        setState(initialState())
        break

      case 'reset':
        formOpenedAt = Date.now()
        setState({
          step: 'target-confirm',
          target: detector.getCurrentTarget(),
          selectedCategory: null,
          selectedSubCategory: null,
          userMessage: '',
          reporterName: '',
          errorMessage: null,
        })
        break

      case 'confirm-target':
        setState({ step: 'type', errorMessage: null })
        break

      case 'reject-target':
        detector.enablePointingMode((picked) => {
          detector.disablePointingMode()
          setState({
            step: 'target-confirm',
            target: picked,
            errorMessage: null,
          })
        })
        setState({ step: 'pointing', errorMessage: null })
        break

      case 'cancel-pointing':
        detector.disablePointingMode()
        setState({
          step: 'target-confirm',
          errorMessage: null,
        })
        break

      case 'pick-target':
        setState({
          step: 'target-confirm',
          target: action.target,
          errorMessage: null,
        })
        break

      case 'select-category':
        // Progressive disclosure: a category with sub-categories opens
        // the sub-category step; `other` (no sub-categories) jumps
        // straight to the free-text precision step.
        if (requiresSubCategory(action.category)) {
          setState({
            step: 'sub-category',
            selectedCategory: action.category,
            selectedSubCategory: null,
            errorMessage: null,
          })
        } else {
          setState({
            step: 'precision',
            selectedCategory: action.category,
            selectedSubCategory: null,
            errorMessage: null,
          })
        }
        break

      case 'select-sub-category':
        setState({
          step: 'precision',
          selectedSubCategory: action.subCategory,
          errorMessage: null,
        })
        break

      case 'back': {
        // Contextual back: precision → sub-category (if the category has
        // sub-categories) or → type; sub-category → type.
        if (
          state.step === 'precision' &&
          state.selectedCategory !== null &&
          requiresSubCategory(state.selectedCategory)
        ) {
          setState({ step: 'sub-category', errorMessage: null })
        } else {
          // Returning to the category picker: clear the stale
          // sub-category so it can't outlive a category change.
          setState({
            step: 'type',
            selectedSubCategory: null,
            errorMessage: null,
          })
        }
        break
      }

      case 'update-message': {
        // Silent by default to preserve textarea focus while typing. But
        // we must render when:
        //  - an inline validation error was visible (so the user sees it
        //    disappear as they correct their input)
        //  - the value was actually normalised (paste >maxlength), so the
        //    DOM stays in sync with what handleSubmit will read from state
        const hadError = state.errorMessage !== null
        const truncated = action.value.slice(0, config.maxMessageLength)
        const wasTruncated = truncated !== action.value
        setState(
          { userMessage: truncated, errorMessage: null },
          { silent: !hadError && !wasTruncated },
        )
        break
      }

      case 'update-reporter': {
        // Same logic as update-message but without errorMessage tracking.
        const truncated = action.value.slice(0, 50)
        const wasTruncated = truncated !== action.value
        setState({ reporterName: truncated }, { silent: !wasTruncated })
        break
      }

      case 'submit':
        void handleSubmit()
        break
    }
  })

  // Validates the current state and builds the payload, or returns null
  // after routing the user to the step that needs fixing. Extracted from
  // handleSubmit so each function keeps a manageable branch count.
  const preparePayload = (): FeedbackPayload | null => {
    const category = state.selectedCategory
    if (!category) {
      setState({ step: 'type' })
      return null
    }

    // Non-`other` categories require a sub-category. If it is missing
    // (e.g. the user skipped the step), send them back to pick one.
    if (requiresSubCategory(category) && state.selectedSubCategory === null) {
      setState({ step: 'sub-category', errorMessage: null })
      return null
    }

    const message = state.userMessage.trim()
    if (message.length < MIN_MESSAGE_LENGTH) {
      setState({
        errorMessage: messages.validation.minMessage,
      })
      return null
    }

    // Building the payload can throw (buildFeedbackPayload enforces the
    // category/sub-category invariant; the collector reads browser
    // globals). Guard it so a failure surfaces as an error step instead
    // of leaving the user stuck on a "sending" spinner with their
    // message lost.
    try {
      const context = contextCollector.collect()
      return buildFeedbackPayload({
        ...context,
        category,
        subCategory: state.selectedSubCategory,
        message,
        reporterName: state.reporterName.trim() || null,
        target: state.target,
      })
    } catch {
      setState({
        step: 'error',
        errorMessage: messages.validation.buildError,
      })
      return null
    }
  }

  const handleSubmit = async (): Promise<void> => {
    // Read the honeypot before any re-render destroys the input.
    const honeypotFilled = element.isHoneypotFilled()
    const payload = preparePayload()
    if (payload === null) {
      return
    }

    setState({ step: 'sending' })

    const result = await submitFeedback(
      {
        transport,
        rateLimiter,
        now: () => Date.now(),
        minFormOpenMs: config.minFormOpenMs,
      },
      { payload, formOpenedAt, honeypotFilled },
    )

    if (result.ok) {
      view.showConfirmation()
      return
    }

    if (result.reason === 'honeypot' || result.reason === 'too-fast') {
      // Silently pretend success to avoid giving feedback to bots.
      view.showConfirmation()
      return
    }

    if (result.reason === 'rate-limited') {
      setState({
        step: 'error',
        errorMessage: messages.transport.rateLimited,
      })
      return
    }

    if (result.reason === 'invalid') {
      setState({
        step: 'error',
        errorMessage: messages.transport.invalid,
      })
      return
    }

    // network or server: enqueue for later retry, then show mailto
    // fallback if available. enqueue can throw (no Web Crypto for the
    // entry id); if it does we must not promise an automatic re-send.
    let enqueued = true
    try {
      await outbox.enqueue(payload)
    } catch {
      enqueued = false
    }

    const mailto = buildMailto(config.mailtoFallback, payload, messages.mailto)
    if (mailto) {
      const t = messages.transport
      const base = result.reason === 'network' ? t.networkBase : t.serverBase
      const suffix = enqueued
        ? t.mailtoSuffixEnqueued
        : t.mailtoSuffixNotEnqueued
      view.showMailtoFallback(mailto, `${base}${suffix}${t.mailtoLinkPrefix}`)
      return
    }

    if (!enqueued) {
      setState({
        step: 'error',
        errorMessage: messages.transport.noMailtoNotEnqueued,
      })
      return
    }

    setState({
      step: 'error',
      errorMessage:
        result.reason === 'network'
          ? messages.transport.noMailtoEnqueuedNetwork
          : messages.transport.noMailtoEnqueuedServer,
    })
  }

  return {
    refresh: () => {
      detector.refresh()
    },
  }
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

// Anonymous, session-scoped id shared by every submission from this
// widget instance. Prefers crypto.randomUUID, then getRandomValues.
// Unlike LocalStorageOutbox.defaultGenerateId (which THROWS without
// Web Crypto, because a weak outbox-entry id could collide and corrupt
// the queue), a session id is non-security-sensitive grouping metadata,
// so the no-crypto path degrades to a timestamp-only id rather than
// throwing. Do not "fix" this divergence by adding a throw — it would
// break sessions on runtimes without Web Crypto.
function newSessionId(): string {
  const cryptoRef: Crypto | undefined =
    typeof globalThis === 'undefined' ? undefined : globalThis.crypto
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    return cryptoRef.randomUUID()
  }
  if (cryptoRef && typeof cryptoRef.getRandomValues === 'function') {
    const bytes = new Uint8Array(8)
    cryptoRef.getRandomValues(bytes)
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(
      '',
    )
    return `fw-sess-${Date.now().toString(36)}-${hex}`
  }
  return `fw-sess-${Date.now().toString(36)}`
}

function buildMailto(
  base: string | null,
  payload: unknown,
  mailto: Messages['mailto'],
): string | null {
  if (!base) return null
  const subject = encodeURIComponent(mailto.subject)
  const body = encodeURIComponent(
    `${mailto.bodyIntro}\n\n${JSON.stringify(payload, null, 2)}`,
  )
  return `mailto:${base}?subject=${subject}&body=${body}`
}

export type { WidgetConfig }
export type { TopLevelCategory } from '@benoit-bremaud/feedback-widget-core'
