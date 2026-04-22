import { describe, it, expect, vi } from 'vitest'
import type { FeedbackPayload } from '../domain/Feedback'
import type { OutboxQueue } from '../ports/OutboxQueue'
import type { Transport } from '../ports/Transport'
import { drainOutbox } from './DrainOutbox'

const payload: FeedbackPayload = {
  schemaVersion: '1.0',
  meta: {
    projectId: 'impropedia',
    timestamp: '2026-04-12T12:00:00.000Z',
    viewport: { width: 800, height: 600, device: 'desktop' },
    userAgent: 'UA/1.0',
  },
  identity: { reporterName: null },
  context: {
    pageUrl: 'https://example.test/',
    pageTitle: 'Test',
    target: {
      headingId: null,
      headingText: null,
      blockIndex: null,
      blockTag: null,
      excerpt: null,
    },
  },
  content: { category: 'bug', userMessage: null },
}

describe('use-cases/drainOutbox', () => {
  it('purges expired entries before draining', async () => {
    const calls: string[] = []
    const outbox: OutboxQueue = {
      enqueue: vi.fn(async () => {}),
      drain: vi.fn(async (send) => {
        calls.push('drain')
        await send(payload)
      }),
      purgeExpired: vi.fn(async () => {
        calls.push('purge')
      }),
      size: vi.fn(async () => 1),
    }

    const transport: Transport = {
      send: vi.fn(async () => ({ ok: true, status: 200 })),
    }

    await drainOutbox({ outbox, transport, maxAgeMs: 1000 })

    expect(calls).toEqual(['purge', 'drain'])
    expect(outbox.purgeExpired).toHaveBeenCalledWith(1000)
    expect(transport.send).toHaveBeenCalledWith(payload)
  })

  it('returns true to outbox.drain when transport succeeds', async () => {
    const outbox: OutboxQueue = {
      enqueue: vi.fn(async () => {}),
      drain: vi.fn(async (send) => {
        const ok = await send(payload)
        expect(ok).toBe(true)
      }),
      purgeExpired: vi.fn(async () => {}),
      size: vi.fn(async () => 1),
    }

    const transport: Transport = {
      send: vi.fn(async () => ({ ok: true, status: 200 })),
    }

    await drainOutbox({ outbox, transport, maxAgeMs: 1000 })
  })

  it('returns false to outbox.drain when transport fails', async () => {
    const outbox: OutboxQueue = {
      enqueue: vi.fn(async () => {}),
      drain: vi.fn(async (send) => {
        const ok = await send(payload)
        expect(ok).toBe(false)
      }),
      purgeExpired: vi.fn(async () => {}),
      size: vi.fn(async () => 1),
    }

    const transport: Transport = {
      send: vi.fn(async () => ({
        ok: false,
        status: 500,
        reason: 'server' as const,
      })),
    }

    await drainOutbox({ outbox, transport, maxAgeMs: 1000 })
  })
})
