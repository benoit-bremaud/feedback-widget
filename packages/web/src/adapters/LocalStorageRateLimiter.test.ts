import { describe, it, expect, beforeEach } from 'vitest'
import { createLocalStorageRateLimiter } from './LocalStorageRateLimiter'

function makeStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v)
    },
    removeItem: (k) => {
      map.delete(k)
    },
    key: (i) => Array.from(map.keys())[i] ?? null,
  }
}

describe('adapters/LocalStorageRateLimiter', () => {
  let storage: Storage
  let currentTime: number

  beforeEach(() => {
    storage = makeStorage()
    currentTime = 1_000_000
  })

  const makeLimiter = (maxAttempts: number, windowMs: number) =>
    createLocalStorageRateLimiter({
      storage,
      key: 'test.key',
      maxAttempts,
      windowMs,
      now: () => currentTime,
    })

  it('allows submissions up to the max', () => {
    const limiter = makeLimiter(3, 60_000)

    expect(limiter.canSubmit()).toBe(true)
    limiter.recordSubmission()
    expect(limiter.canSubmit()).toBe(true)
    limiter.recordSubmission()
    expect(limiter.canSubmit()).toBe(true)
    limiter.recordSubmission()
    expect(limiter.canSubmit()).toBe(false)
  })

  it('forgets entries older than the window', () => {
    const limiter = makeLimiter(2, 10_000)

    limiter.recordSubmission()
    limiter.recordSubmission()
    expect(limiter.canSubmit()).toBe(false)

    currentTime += 10_001
    expect(limiter.canSubmit()).toBe(true)
  })

  it('recovers from corrupted storage payloads', () => {
    storage.setItem('test.key', 'not-json')
    const limiter = makeLimiter(3, 60_000)
    expect(limiter.canSubmit()).toBe(true)
  })

  it('ignores non-numeric timestamps in stored array', () => {
    storage.setItem('test.key', JSON.stringify([currentTime, 'oops', null]))
    const limiter = makeLimiter(2, 60_000)
    expect(limiter.canSubmit()).toBe(true)
    limiter.recordSubmission()
    expect(limiter.canSubmit()).toBe(false)
  })
})
