import { describe, it, expect, vi } from 'vitest'
import type { FeedbackPayload } from '../domain/Feedback'
import type { RateLimiter } from '../ports/RateLimiter'
import type { Transport } from '../ports/Transport'
import { submitFeedback } from './SubmitFeedback'

const minimalPayload: FeedbackPayload = {
  projectId: 'impropedia',
  url: 'https://example.test/',
  referrer: null,
  userAgent: 'UA/1.0',
  viewport: { w: 800, h: 600 },
  locale: 'en-US',
  timestamp: '2026-04-24T12:00:00.000Z',
  widgetVersion: '0.3.0',
  scrollDepth: 0,
  sessionId: '01HK3M-0000-0000-0000-000000000000',
  category: 'content',
  subCategory: 'typo',
  message: 'Missing closing tag in the docs',
  reporterName: null,
}

function makeDeps(
  overrides: {
    transport?: Partial<Transport>
    rateLimiter?: Partial<RateLimiter>
    now?: number
    minFormOpenMs?: number
  } = {},
) {
  const transport: Transport = {
    send: vi.fn(async () => ({ ok: true, status: 200 })),
    ...overrides.transport,
  }
  const rateLimiter: RateLimiter = {
    canSubmit: vi.fn(() => true),
    recordSubmission: vi.fn(),
    ...overrides.rateLimiter,
  }
  return {
    deps: {
      transport,
      rateLimiter,
      now: () => overrides.now ?? 10_000,
      minFormOpenMs: overrides.minFormOpenMs ?? 2000,
    },
    transport,
    rateLimiter,
  }
}

describe('use-cases/submitFeedback', () => {
  it('rejects honeypot-filled submissions silently', async () => {
    const { deps, transport, rateLimiter } = makeDeps()

    const result = await submitFeedback(deps, {
      payload: minimalPayload,
      formOpenedAt: 0,
      honeypotFilled: true,
    })

    expect(result).toEqual({ ok: false, reason: 'honeypot' })
    expect(transport.send).not.toHaveBeenCalled()
    expect(rateLimiter.recordSubmission).not.toHaveBeenCalled()
  })

  it('rejects too-fast submissions', async () => {
    const { deps, transport } = makeDeps({ now: 1000, minFormOpenMs: 2000 })

    const result = await submitFeedback(deps, {
      payload: minimalPayload,
      formOpenedAt: 0,
      honeypotFilled: false,
    })

    expect(result).toEqual({ ok: false, reason: 'too-fast' })
    expect(transport.send).not.toHaveBeenCalled()
  })

  it('rejects when rate-limit is exceeded', async () => {
    const { deps, transport } = makeDeps({
      rateLimiter: { canSubmit: vi.fn(() => false), recordSubmission: vi.fn() },
    })

    const result = await submitFeedback(deps, {
      payload: minimalPayload,
      formOpenedAt: 0,
      honeypotFilled: false,
    })

    expect(result).toEqual({ ok: false, reason: 'rate-limited' })
    expect(transport.send).not.toHaveBeenCalled()
  })

  it('records submission on transport success', async () => {
    const { deps, transport, rateLimiter } = makeDeps()

    const result = await submitFeedback(deps, {
      payload: minimalPayload,
      formOpenedAt: 0,
      honeypotFilled: false,
    })

    expect(result).toEqual({ ok: true })
    expect(transport.send).toHaveBeenCalledOnce()
    expect(rateLimiter.recordSubmission).toHaveBeenCalledOnce()
  })

  it('does not record on transport failure', async () => {
    const { deps, transport, rateLimiter } = makeDeps({
      transport: {
        send: vi.fn(async () => ({
          ok: false,
          status: 500,
          reason: 'server' as const,
        })),
      },
    })

    const result = await submitFeedback(deps, {
      payload: minimalPayload,
      formOpenedAt: 0,
      honeypotFilled: false,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('server')
      expect(result.status).toBe(500)
    }
    expect(transport.send).toHaveBeenCalledOnce()
    expect(rateLimiter.recordSubmission).not.toHaveBeenCalled()
  })

  it('propagates specific transport reasons (rate-limited, network, invalid)', async () => {
    const cases = [
      { status: 429 as number | null, reason: 'rate-limited' as const },
      { status: null as number | null, reason: 'network' as const },
      { status: 400 as number | null, reason: 'invalid' as const },
    ]

    for (const c of cases) {
      const { deps } = makeDeps({
        transport: {
          send: vi.fn(async () => ({
            ok: false,
            status: c.status,
            reason: c.reason,
          })),
        },
      })

      const result = await submitFeedback(deps, {
        payload: minimalPayload,
        formOpenedAt: 0,
        honeypotFilled: false,
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toBe(c.reason)
      }
    }
  })
})
