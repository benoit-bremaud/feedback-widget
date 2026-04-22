import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mountFeedbackWidget } from './widget'

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
const viewRender = vi.fn()
const viewShowConfirmation = vi.fn()
const viewShowMailtoFallback = vi.fn()
let onUserActionCallback:
  | ((action: { kind: string; [k: string]: unknown }) => void)
  | null = null

vi.mock('./adapters/HttpTransport', () => ({
  createHttpTransport: () => ({ send: transportSend }),
  defaultBackoff: (n: number) => n * 100,
}))

vi.mock('./adapters/LocalStorageRateLimiter', () => ({
  createLocalStorageRateLimiter: () => ({
    canSubmit: rateLimiterCanSubmit,
    recordSubmission: rateLimiterRecord,
  }),
}))

vi.mock('./adapters/LocalStorageOutbox', () => ({
  createLocalStorageOutbox: () => ({
    enqueue: outboxEnqueue,
    drain: outboxDrain,
    purgeExpired: vi.fn(async () => undefined),
    size: vi.fn(async () => 0),
  }),
}))

vi.mock('./adapters/IntersectionViewportDetector', () => ({
  createIntersectionViewportDetector: () => ({
    startObserving: detectorStart,
    stopObserving: detectorStop,
    refresh: detectorRefresh,
    getCurrentTarget: detectorGetCurrentTarget,
    enablePointingMode: detectorEnablePointing,
    disablePointingMode: detectorDisablePointing,
    clearHighlight: detectorClearHighlight,
  }),
}))

class FakeFeedbackWidgetElement extends HTMLElement {
  setOptions = vi.fn()
  isHoneypotFilled = vi.fn(() => false)
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
  categories: ['bug', 'typo'],
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
})

describe('mountFeedbackWidget — sad / edge paths', () => {
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

  it('select-category sets category and moves to precision step', () => {
    mountFeedbackWidget(validConfig)
    onUserActionCallback?.({ kind: 'open' })
    onUserActionCallback?.({ kind: 'confirm-target' })
    viewRender.mockClear()

    onUserActionCallback?.({ kind: 'select-category', category: 'other' })

    const rendered = viewRender.mock.calls.at(-1)?.[0]
    expect(rendered?.step).toBe('precision')
    expect(rendered?.selectedCategory).toBe('other')
  })

  it('update-message silently updates state while no validation error is visible', () => {
    mountFeedbackWidget(validConfig)
    onUserActionCallback?.({ kind: 'open' })
    onUserActionCallback?.({ kind: 'confirm-target' })
    onUserActionCallback?.({ kind: 'select-category', category: 'other' })
    viewRender.mockClear()

    onUserActionCallback?.({ kind: 'update-message', value: 'typing' })

    // Silent: render must NOT have been re-called.
    expect(viewRender).not.toHaveBeenCalled()
  })

  it('update-message truncates values over maxMessageLength and renders once on paste-overflow', () => {
    mountFeedbackWidget(validConfig)
    onUserActionCallback?.({ kind: 'open' })
    onUserActionCallback?.({ kind: 'confirm-target' })
    onUserActionCallback?.({ kind: 'select-category', category: 'other' })
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
    onUserActionCallback?.({ kind: 'select-category', category: 'other' })
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
    onUserActionCallback?.({ kind: 'select-category', category: 'other' })
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
})
