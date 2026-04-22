import { describe, it, expect } from 'vitest'
import { resolveConfig } from './WidgetConfig'

describe('config/resolveConfig', () => {
  it('applies sensible defaults when only required fields are provided', () => {
    const resolved = resolveConfig({
      endpoint: 'https://httpbin.org/post',
      projectId: 'impropedia',
    })

    expect(resolved.endpoint).toBe('https://httpbin.org/post')
    expect(resolved.projectId).toBe('impropedia')
    expect(resolved.token).toBeNull()
    expect(resolved.categories).toBeNull()
    expect(resolved.maxMessageLength).toBe(500)
    expect(resolved.rateLimitWindowMs).toBe(600_000)
    expect(resolved.rateLimitMaxAttempts).toBe(3)
    expect(resolved.minFormOpenMs).toBe(2000)
    expect(resolved.maxTransportAttempts).toBe(3)
    expect(resolved.transportTimeoutMs).toBe(10_000)
    expect(resolved.position).toBe('bottom-right')
  })

  it('respects an explicit transportTimeoutMs override', () => {
    const resolved = resolveConfig({
      endpoint: 'https://api.test/',
      projectId: 'impropedia',
      transportTimeoutMs: 3000,
    })

    expect(resolved.transportTimeoutMs).toBe(3000)
  })

  it('respects overrides on each field', () => {
    const resolved = resolveConfig({
      endpoint: 'https://api.test/',
      projectId: 'impropedia',
      token: 'pub-id',
      rateLimitMaxAttempts: 10,
      position: 'bottom-left',
      mailtoFallback: 'hello@example.test',
    })

    expect(resolved.token).toBe('pub-id')
    expect(resolved.rateLimitMaxAttempts).toBe(10)
    expect(resolved.position).toBe('bottom-left')
    expect(resolved.mailtoFallback).toBe('hello@example.test')
  })
})
