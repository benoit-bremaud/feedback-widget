import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mountFeedbackWidget, WIDGET_VERSION } from './widget'

/**
 * widget.ts tests — focused on the public API surface (`mountFeedbackWidget`)
 * and the `FeedbackWidgetHandle` it returns. The heavy adapters
 * (transport, outbox, rate-limiter, detector, view) are mocked at the
 * module boundary so the tests exercise orchestration, not the adapters
 * themselves (those are covered by their own `.test.ts` files).
 */

// ---- Adapter mocks --------------------------------------------------------

const transportSend = vi.fn()
const rateLimiterRecord = vi.fn()
const rateLimiterCanSubmit = vi.fn(() => true)
const outboxEnqueue = vi.fn()
const outboxDrain = vi.fn()
const detectorStart = vi.fn()
const detectorStop = vi.fn()
const detectorRefresh = vi.fn()
const detectorGetCurrentTarget = vi.fn()
const detectorEnablePointing = vi.fn()
const detectorDisablePointing = vi.fn()
const detectorClearHighlight = vi.fn()
const detectorDestroy = vi.fn()
const viewRender = vi.fn()
const viewShowConfirmation = vi.fn()
const viewShowMailtoFallback = vi.fn()
let onUserActionCallback:
  ((action: { kind: string; [k: string]: unknown }) => void) | null = null

// Captured from the (mocked) adapter factories to assert wiring.
let rateLimiterKey: string | undefined
let outboxKey: string | undefined
let detectorRootSelector: string | undefined

vi.mock('./adapters/HttpTransport', () => ({
  createHttpTransport: () => ({ send: transportSend }),
  defaultBackoff: (n: number) => n * 100,
}))

vi.mock('./adapters/LocalStorageRateLimiter', () => ({
  createLocalStorageRateLimiter: (deps: { key: string }) => {
    rateLimiterKey = deps.key
    return {
      canSubmit: rateLimiterCanSubmit,
      recordSubmission: rateLimiterRecord,
    }
  },
}))

vi.mock('./adapters/LocalStorageOutbox', () => ({
  createLocalStorageOutbox: (deps: { key: string }) => {
    outboxKey = deps.key
    return {
      enqueue: outboxEnqueue,
      drain: outboxDrain,
      purgeExpired: vi.fn(async () => undefined),
      size: vi.fn(async () => 0),
    }
  },
}))

vi.mock('./adapters/IntersectionViewportDetector', () => ({
  createIntersectionViewportDetector: (deps: { rootSelector?: string }) => {
    detectorRootSelector = deps.rootSelector
    return {
      startObserving: detectorStart,
      stopObserving: detectorStop,
      refresh: detectorRefresh,
      getCurrentTarget: detectorGetCurrentTarget,
      enablePointingMode: detectorEnablePointing,
      disablePointingMode: detectorDisablePointing,
      clearHighlight: detectorClearHighlight,
      destroy: detectorDestroy,
    }
  },
}))

class FakeFeedbackWidgetElement extends HTMLElement {
  setOptions = vi.fn()
  isHoneypotFilled = vi.fn(() => false)
  setDisconnectHandler = vi.fn()
}

vi.mock('./adapters/WebComponentView', () => ({
  defineFeedbackWidgetElement: () => FakeFeedbackWidgetElement,
  createWebComponentView: () => ({
    render: viewRender,
    showConfirmation: viewShowConfirmation,
    showMailtoFallback: viewShowMailtoFallback,
    onUserAction: (cb: typeof onUserActionCallback) => {
      onUserActionCallback = cb
    },
  }),
}))

// ---- Test setup -----------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  onUserActionCallback = null
  rateLimiterKey = undefined
  outboxKey = undefined
  detectorRootSelector = undefined
  document.body.innerHTML = ''
  // Reset the customElements registry where possible.
  // happy-dom allows (re)definition of the same name across tests if we
  // create a fresh registry, but the simpler path is to use a unique tag
  // per module import — since we import once, we redefine idempotently.
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---- Minimal valid config -------------------------------------------------

const validConfig = {
  projectId: 'test-project',
  endpoint: 'https://example.test/feedback',
  token: 'test-token',
  categories: ['bug', 'content'],
  maxMessageLength: 500,
  minFormOpenMs: 0,
  maxTransportAttempts: 3,
  transportTimeoutMs: 1000,
  rateLimitWindowMs: 60_000,
  rateLimitMaxAttempts: 5,
  position: 'bottom-right' as const,
  mailtoFallback: null,
}

// ---- Tests: mountFeedbackWidget ------------------------------------------

describe('mountFeedbackWidget — happy path', () => {
  it('registers the custom element, appends it to the body, and returns a handle with refresh', () => {
    const handle = mountFeedbackWidget(validConfig)

    expect(handle).toHaveProperty('refresh')
    expect(typeof handle.refresh).toBe('function')
    expect(customElements.get('feedback-widget')).toBe(
      FakeFeedbackWidgetElement,
    )
    expect(document.querySelector('feedback-widget')).not.toBeNull()
  })

  it('wires every adapter (detector.startObserving + initial view render)', () => {
    mountFeedbackWidget(validConfig)

    expect(detectorStart).toHaveBeenCalledOnce()
    expect(viewRender).toHaveBeenCalled()
  })

  it('forwards maxMessageLength / categories / position to element.setOptions', () => {
    mountFeedbackWidget(validConfig)

    const el =
      document.querySelector<FakeFeedbackWidgetElement>('feedback-widget')
    expect(el?.setOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        maxMessageLength: 500,
        position: 'bottom-right',
      }),
    )
  })

  it('handle.refresh calls detector.refresh', () => {
    const handle = mountFeedbackWidget(validConfig)

    handle.refresh()

    expect(detectorRefresh).toHaveBeenCalledOnce()
  })

  it('registers a disconnect handler that tears the detector down (v0.5.2)', () => {
    mountFeedbackWidget(validConfig)

    const el =
      document.querySelector<FakeFeedbackWidgetElement>('feedback-widget')
    expect(el?.setDisconnectHandler).toHaveBeenCalledOnce()

    // Invoking the registered teardown must destroy the detector, so no
    // document listeners / observer / injected styles leak on unmount.
    const teardown = el?.setDisconnectHandler.mock.calls[0]?.[0] as () => void
    teardown()
    expect(detectorDestroy).toHaveBeenCalledOnce()
  })
})

describe('mountFeedbackWidget — sad / edge paths', () => {
  it('throws on an invalid endpoint without appending a stale element (v0.5.2)', () => {
    expect(() =>
      mountFeedbackWidget({ ...validConfig, endpoint: 'not-a-url' }),
    ).toThrow(/endpoint/i)
    expect(document.querySelector('feedback-widget')).toBeNull()
  })

  it('returns a NOOP handle when window is undefined (SSR guard)', () => {
    // Temporarily replace the global window with undefined via the
    // `typeof` check in mountFeedbackWidget. Since we cannot actually
    // `delete window` in happy-dom, we stub `customElements` to the
    // `undefined` branch by stashing and restoring it. Wrapped in
    // try/finally so a failing assertion never leaks the deleted
    // global into later tests.
    const originalCustomElements = globalThis.customElements
    try {
      // @ts-expect-error intentional removal for SSR-guard test
      delete (globalThis as { customElements?: unknown }).customElements

      const handle = mountFeedbackWidget(validConfig)
      handle.refresh() // must not throw — it's the NOOP handle
    } finally {
      ;(globalThis as { customElements: unknown }).customElements =
        originalCustomElements
    }
  })

  it('reuses the existing element + handle when mounted twice', () => {
    const first = mountFeedbackWidget(validConfig)
    detectorRefresh.mockClear()

    const second = mountFeedbackWidget(validConfig)

    // Same handle reference
    expect(second).toBe(first)
    // And refresh was called because mountFeedbackWidget path found an existing element
    expect(detectorRefresh).toHaveBeenCalled()
    // Still only one element in the DOM
    expect(
      document.querySelectorAll('feedback-widget').length,
    ).toBeLessThanOrEqual(1)
  })
})

// ---- Tests: controller state machine via onUserAction --------------------

describe('controller — user-action state transitions', () => {
  beforeEach(() => {
    detectorGetCurrentTarget.mockReturnValue(null)
  })

  it('open action moves to target-confirm and queries the current target', () => {
    mountFeedbackWidget(validConfig)
    viewRender.mockClear()

    onUserActionCallback?.({ kind: 'open' })

    expect(detectorGetCurrentTarget).toHaveBeenCalled()
    const lastCallArg = viewRender.mock.calls.at(-1)?.[0]
    expect(lastCallArg?.step).toBe('target-confirm')
  })

  it('close action disables pointing mode, clears highlight, and resets to initial state', () => {
    mountFeedbackWidget(validConfig)
    onUserActionCallback?.({ kind: 'open' })
    viewRender.mockClear()

    onUserActionCallback?.({ kind: 'close' })

    expect(detectorDisablePointing).toHaveBeenCalled()
    expect(detectorClearHighlight).toHaveBeenCalled()
    const lastCallArg = viewRender.mock.calls.at(-1)?.[0]
    expect(lastCallArg?.step).toBe('closed')
  })

  it('confirm-target moves to type step', () => {
    mountFeedbackWidget(validConfig)
    onUserActionCallback?.({ kind: 'open' })
    viewRender.mockClear()

    onUserActionCallback?.({ kind: 'confirm-target' })

    expect(viewRender.mock.calls.at(-1)?.[0]?.step).toBe('type')
  })

  it('reject-target enables pointing mode and moves to pointing step', () => {
    mountFeedbackWidget(validConfig)
    onUserActionCallback?.({ kind: 'open' })
    viewRender.mockClear()

    onUserActionCallback?.({ kind: 'reject-target' })

    expect(detectorEnablePointing).toHaveBeenCalled()
    expect(viewRender.mock.calls.at(-1)?.[0]?.step).toBe('pointing')
  })

  it('cancel-pointing disables pointing mode and returns to target-confirm', () => {
    mountFeedbackWidget(validConfig)
    onUserActionCallback?.({ kind: 'open' })
    onUserActionCallback?.({ kind: 'reject-target' })
    viewRender.mockClear()

    onUserActionCallback?.({ kind: 'cancel-pointing' })

    expect(detectorDisablePointing).toHaveBeenCalled()
    expect(viewRender.mock.calls.at(-1)?.[0]?.step).toBe('target-confirm')
  })

  it('pick-target sets the target and moves to target-confirm', () => {
    mountFeedbackWidget(validConfig)
    onUserActionCallback?.({ kind: 'open' })
    viewRender.mockClear()
    const target = {
      headingId: 'h1',
      headingText: 'Heading',
      blockIndex: 0,
      blockTag: 'p',
      excerpt: 'picked excerpt',
    }

    onUserActionCallback?.({ kind: 'pick-target', target })

    const rendered = viewRender.mock.calls.at(-1)?.[0]
    expect(rendered?.step).toBe('target-confirm')
    expect(rendered?.target).toEqual(target)
  })

  it('select-category "praise" skips sub-category and moves straight to precision', () => {
    mountFeedbackWidget(validConfig)
    onUserActionCallback?.({ kind: 'open' })
    onUserActionCallback?.({ kind: 'confirm-target' })
    viewRender.mockClear()

    onUserActionCallback?.({ kind: 'select-category', category: 'praise' })

    const rendered = viewRender.mock.calls.at(-1)?.[0]
    expect(rendered?.step).toBe('precision')
    expect(rendered?.selectedCategory).toBe('praise')
    expect(rendered?.selectedSubCategory).toBeNull()
  })

  it('select-category on a category with sub-categories opens the sub-category step', () => {
    mountFeedbackWidget(validConfig)
    onUserActionCallback?.({ kind: 'open' })
    onUserActionCallback?.({ kind: 'confirm-target' })
    viewRender.mockClear()

    onUserActionCallback?.({ kind: 'select-category', category: 'bug' })

    const rendered = viewRender.mock.calls.at(-1)?.[0]
    expect(rendered?.step).toBe('sub-category')
    expect(rendered?.selectedCategory).toBe('bug')
    expect(rendered?.selectedSubCategory).toBeNull()
  })

  it('select-sub-category records the sub-category and advances to precision', () => {
    mountFeedbackWidget(validConfig)
    onUserActionCallback?.({ kind: 'open' })
    onUserActionCallback?.({ kind: 'confirm-target' })
    onUserActionCallback?.({ kind: 'select-category', category: 'bug' })
    viewRender.mockClear()

    onUserActionCallback?.({
      kind: 'select-sub-category',
      subCategory: 'crash',
    })

    const rendered = viewRender.mock.calls.at(-1)?.[0]
    expect(rendered?.step).toBe('precision')
    expect(rendered?.selectedSubCategory).toBe('crash')
  })

  it('back from sub-category returns to the category picker', () => {
    mountFeedbackWidget(validConfig)
    onUserActionCallback?.({ kind: 'open' })
    onUserActionCallback?.({ kind: 'confirm-target' })
    onUserActionCallback?.({ kind: 'select-category', category: 'bug' })
    viewRender.mockClear()

    onUserActionCallback?.({ kind: 'back' })

    expect(viewRender.mock.calls.at(-1)?.[0]?.step).toBe('type')
  })

  it('back from precision returns to sub-category for a category with sub-categories', () => {
    mountFeedbackWidget(validConfig)
    onUserActionCallback?.({ kind: 'open' })
    onUserActionCallback?.({ kind: 'confirm-target' })
    onUserActionCallback?.({ kind: 'select-category', category: 'bug' })
    onUserActionCallback?.({
      kind: 'select-sub-category',
      subCategory: 'crash',
    })
    viewRender.mockClear()

    onUserActionCallback?.({ kind: 'back' })

    expect(viewRender.mock.calls.at(-1)?.[0]?.step).toBe('sub-category')
  })

  it('back from precision returns to the category picker for "praise"', () => {
    mountFeedbackWidget(validConfig)
    onUserActionCallback?.({ kind: 'open' })
    onUserActionCallback?.({ kind: 'confirm-target' })
    onUserActionCallback?.({ kind: 'select-category', category: 'praise' })
    viewRender.mockClear()

    onUserActionCallback?.({ kind: 'back' })

    expect(viewRender.mock.calls.at(-1)?.[0]?.step).toBe('type')
  })

  it('update-message silently updates state while no validation error is visible', () => {
    mountFeedbackWidget(validConfig)
    onUserActionCallback?.({ kind: 'open' })
    onUserActionCallback?.({ kind: 'confirm-target' })
    onUserActionCallback?.({ kind: 'select-category', category: 'praise' })
    viewRender.mockClear()

    onUserActionCallback?.({ kind: 'update-message', value: 'typing' })

    // Silent: render must NOT have been re-called.
    expect(viewRender).not.toHaveBeenCalled()
  })

  it('update-message truncates values over maxMessageLength and renders once on paste-overflow', () => {
    mountFeedbackWidget(validConfig)
    onUserActionCallback?.({ kind: 'open' })
    onUserActionCallback?.({ kind: 'confirm-target' })
    onUserActionCallback?.({ kind: 'select-category', category: 'praise' })
    viewRender.mockClear()

    const longValue = 'x'.repeat(600)
    onUserActionCallback?.({ kind: 'update-message', value: longValue })

    // Not silent because the value was truncated → render was called.
    expect(viewRender).toHaveBeenCalled()
    const rendered = viewRender.mock.calls.at(-1)?.[0]
    expect(rendered?.userMessage.length).toBe(500)
  })

  it('update-reporter truncates values over 50 chars', () => {
    mountFeedbackWidget(validConfig)
    onUserActionCallback?.({ kind: 'open' })
    viewRender.mockClear()

    const longName = 'x'.repeat(80)
    onUserActionCallback?.({ kind: 'update-reporter', value: longName })

    expect(viewRender).toHaveBeenCalled()
    const rendered = viewRender.mock.calls.at(-1)?.[0]
    expect(rendered?.reporterName.length).toBe(50)
  })
})

// ---- Tests: handleSubmit branches ----------------------------------------

describe('handleSubmit — result branches', () => {
  const openToType = (): void => {
    onUserActionCallback?.({ kind: 'open' })
    onUserActionCallback?.({ kind: 'confirm-target' })
    onUserActionCallback?.({ kind: 'select-category', category: 'praise' })
    onUserActionCallback?.({
      kind: 'update-message',
      value: 'A meaningful ten-char-plus message.',
    })
  }

  beforeEach(() => {
    detectorGetCurrentTarget.mockReturnValue(null)
  })

  it('submit with no category returns to type step without calling transport', async () => {
    mountFeedbackWidget(validConfig)
    onUserActionCallback?.({ kind: 'open' })
    onUserActionCallback?.({ kind: 'confirm-target' })
    // No select-category here.
    viewRender.mockClear()

    onUserActionCallback?.({ kind: 'submit' })
    // Flush microtasks.
    await Promise.resolve()

    expect(transportSend).not.toHaveBeenCalled()
    expect(viewRender.mock.calls.at(-1)?.[0]?.step).toBe('type')
  })

  it('submit with a too-short message on a category that requires one sets an errorMessage', async () => {
    mountFeedbackWidget(validConfig)
    onUserActionCallback?.({ kind: 'open' })
    onUserActionCallback?.({ kind: 'confirm-target' })
    onUserActionCallback?.({ kind: 'select-category', category: 'praise' })
    onUserActionCallback?.({ kind: 'update-message', value: 'short' })
    viewRender.mockClear()

    onUserActionCallback?.({ kind: 'submit' })
    await Promise.resolve()

    expect(transportSend).not.toHaveBeenCalled()
    const rendered = viewRender.mock.calls.at(-1)?.[0]
    expect(rendered?.errorMessage).toMatch(/10 caract/)
  })

  it('successful submit shows the confirmation view', async () => {
    transportSend.mockResolvedValue({ ok: true, status: 204 })
    rateLimiterCanSubmit.mockReturnValue(true)
    mountFeedbackWidget(validConfig)
    openToType()

    onUserActionCallback?.({ kind: 'submit' })
    // Flush a few microtasks.
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(transportSend).toHaveBeenCalled()
    expect(viewShowConfirmation).toHaveBeenCalled()
  })

  it('builds a flat payload carrying category, sub-category, message, and the 10 auto-capture fields', async () => {
    transportSend.mockResolvedValue({ ok: true, status: 204 })
    rateLimiterCanSubmit.mockReturnValue(true)
    mountFeedbackWidget(validConfig)

    onUserActionCallback?.({ kind: 'open' })
    onUserActionCallback?.({ kind: 'confirm-target' })
    onUserActionCallback?.({ kind: 'select-category', category: 'bug' })
    onUserActionCallback?.({
      kind: 'select-sub-category',
      subCategory: 'crash',
    })
    onUserActionCallback?.({
      kind: 'update-message',
      value: 'The app crashes on load every time.',
    })

    onUserActionCallback?.({ kind: 'submit' })
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(transportSend).toHaveBeenCalledOnce()
    const payload = transportSend.mock.calls.at(-1)?.[0]
    // user-provided
    expect(payload.category).toBe('bug')
    expect(payload.subCategory).toBe('crash')
    expect(payload.message).toBe('The app crashes on load every time.')
    // 10 auto-capture fields present
    expect(payload.projectId).toBe('test-project')
    expect(typeof payload.url).toBe('string')
    expect('referrer' in payload).toBe(true)
    expect(typeof payload.userAgent).toBe('string')
    expect(payload.viewport).toHaveProperty('w')
    expect(payload.viewport).toHaveProperty('h')
    expect(typeof payload.locale).toBe('string')
    expect(typeof payload.timestamp).toBe('string')
    expect(payload.widgetVersion).toBe(WIDGET_VERSION)
    expect(typeof payload.scrollDepth).toBe('number')
    expect(typeof payload.sessionId).toBe('string')
    // reporterName is carried (null when the user typed no name)
    expect('reporterName' in payload).toBe(true)
    // nested v0.2.0 keys must be gone
    expect('meta' in payload).toBe(false)
    expect('content' in payload).toBe(false)
  })

  it('submit on a category requiring a sub-category without one bounces back to the sub-category step', async () => {
    mountFeedbackWidget(validConfig)
    onUserActionCallback?.({ kind: 'open' })
    onUserActionCallback?.({ kind: 'confirm-target' })
    onUserActionCallback?.({ kind: 'select-category', category: 'bug' })
    // Skip sub-category selection, jump straight to submit.
    onUserActionCallback?.({
      kind: 'update-message',
      value: 'A meaningful ten-char-plus message.',
    })
    viewRender.mockClear()

    onUserActionCallback?.({ kind: 'submit' })
    await Promise.resolve()

    expect(transportSend).not.toHaveBeenCalled()
    expect(viewRender.mock.calls.at(-1)?.[0]?.step).toBe('sub-category')
  })

  it('rate-limited submit shows an error step, not the confirmation', async () => {
    rateLimiterCanSubmit.mockReturnValue(false)
    mountFeedbackWidget(validConfig)
    openToType()
    viewRender.mockClear()

    onUserActionCallback?.({ kind: 'submit' })
    await Promise.resolve()
    await Promise.resolve()

    expect(viewShowConfirmation).not.toHaveBeenCalled()
    const rendered = viewRender.mock.calls.at(-1)?.[0]
    expect(rendered?.step).toBe('error')
    expect(rendered?.errorMessage).toBeTruthy()
  })

  it('invalid submit shows a format-rejected error step', async () => {
    transportSend.mockResolvedValue({
      ok: false,
      status: 400,
      reason: 'invalid',
    })
    rateLimiterCanSubmit.mockReturnValue(true)
    mountFeedbackWidget(validConfig)
    openToType()
    viewRender.mockClear()

    onUserActionCallback?.({ kind: 'submit' })
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    const rendered = viewRender.mock.calls.at(-1)?.[0]
    expect(rendered?.step).toBe('error')
    expect(rendered?.errorMessage).toMatch(/format invalide/)
  })

  it('network failure enqueues for retry and shows the queued error step (no mailto)', async () => {
    transportSend.mockResolvedValue({
      ok: false,
      status: null,
      reason: 'network',
    })
    rateLimiterCanSubmit.mockReturnValue(true)
    outboxEnqueue.mockResolvedValue(undefined)
    mountFeedbackWidget(validConfig)
    openToType()
    viewRender.mockClear()

    onUserActionCallback?.({ kind: 'submit' })
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(outboxEnqueue).toHaveBeenCalledOnce()
    const rendered = viewRender.mock.calls.at(-1)?.[0]
    expect(rendered?.step).toBe('error')
    expect(rendered?.errorMessage).toMatch(/file d’attente/)
  })

  it('network failure with a mailtoFallback shows the mailto fallback view', async () => {
    transportSend.mockResolvedValue({
      ok: false,
      status: null,
      reason: 'network',
    })
    rateLimiterCanSubmit.mockReturnValue(true)
    outboxEnqueue.mockResolvedValue(undefined)
    mountFeedbackWidget({ ...validConfig, mailtoFallback: 'ops@example.test' })
    openToType()

    onUserActionCallback?.({ kind: 'submit' })
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(viewShowMailtoFallback).toHaveBeenCalledOnce()
    const [url, message] = viewShowMailtoFallback.mock.calls.at(-1) ?? []
    expect(url).toContain('mailto:ops@example.test')
    expect(message).toMatch(/renvoyé automatiquement/)
  })

  it('does not promise auto-resend when enqueue itself fails', async () => {
    transportSend.mockResolvedValue({
      ok: false,
      status: 503,
      reason: 'server',
    })
    rateLimiterCanSubmit.mockReturnValue(true)
    outboxEnqueue.mockRejectedValue(new Error('no crypto'))
    mountFeedbackWidget(validConfig)
    openToType()
    viewRender.mockClear()

    onUserActionCallback?.({ kind: 'submit' })
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    const rendered = viewRender.mock.calls.at(-1)?.[0]
    expect(rendered?.step).toBe('error')
    expect(rendered?.errorMessage).toMatch(
      /n’a pas pu être envoyé ni mis en file/,
    )
  })
})

describe('mountFeedbackWidget — v0.5.0 wiring', () => {
  it('namespaces localStorage keys with the default storageNamespace', () => {
    mountFeedbackWidget(validConfig)

    expect(rateLimiterKey).toBe('feedback-widget.test-project')
    expect(outboxKey).toBe('feedback-widget.outbox.test-project')
  })

  it('honors a custom storageNamespace', () => {
    mountFeedbackWidget({ ...validConfig, storageNamespace: 'acme' })

    expect(rateLimiterKey).toBe('acme.test-project')
    expect(outboxKey).toBe('acme.outbox.test-project')
  })

  it('forwards rootSelector to the viewport detector', () => {
    mountFeedbackWidget({ ...validConfig, rootSelector: '#app' })

    expect(detectorRootSelector).toBe('#app')
  })

  it('leaves rootSelector undefined when unset (detector default applies)', () => {
    mountFeedbackWidget(validConfig)

    expect(detectorRootSelector).toBeUndefined()
  })

  it('drops a blank rootSelector so the detector keeps its default', () => {
    mountFeedbackWidget({ ...validConfig, rootSelector: '   ' })

    expect(detectorRootSelector).toBeUndefined()
  })
})
