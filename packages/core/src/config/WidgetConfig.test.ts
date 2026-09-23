import { describe, it, expect } from 'vitest'
import {
  resolveConfig,
  normalizeLocale,
  MIN_MESSAGE_LENGTH,
  MAX_MESSAGE_LENGTH,
} from './WidgetConfig'
import type { WidgetConfig } from './WidgetConfig'

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

  it('clamps maxMessageLength up to the submit floor so users cannot be locked out', () => {
    const resolved = resolveConfig({
      endpoint: 'https://api.test/',
      projectId: 'impropedia',
      maxMessageLength: 3,
    })

    expect(resolved.maxMessageLength).toBe(MIN_MESSAGE_LENGTH)
  })

  it('keeps a maxMessageLength within bounds unchanged', () => {
    const resolved = resolveConfig({
      endpoint: 'https://api.test/',
      projectId: 'impropedia',
      maxMessageLength: 250,
    })

    expect(resolved.maxMessageLength).toBe(250)
  })

  it('clamps maxMessageLength down to the contract cap', () => {
    const resolved = resolveConfig({
      endpoint: 'https://api.test/',
      projectId: 'impropedia',
      maxMessageLength: 9999,
    })

    expect(resolved.maxMessageLength).toBe(MAX_MESSAGE_LENGTH)
  })

  it('applies the v0.5.0 multi-project defaults', () => {
    const resolved = resolveConfig({
      endpoint: 'https://api.test/',
      projectId: 'demo',
    })

    expect(resolved.rootSelector).toBeNull()
    expect(resolved.theme).toBeNull()
    expect(resolved.locale).toBe('fr')
    expect(resolved.storageNamespace).toBe('feedback-widget')
  })

  it('respects the v0.5.0 overrides', () => {
    const resolved = resolveConfig({
      endpoint: 'https://api.test/',
      projectId: 'demo',
      rootSelector: '#root',
      theme: 'dark',
      locale: 'en',
      storageNamespace: 'acme',
    })

    expect(resolved.rootSelector).toBe('#root')
    expect(resolved.theme).toBe('dark')
    expect(resolved.locale).toBe('en')
    expect(resolved.storageNamespace).toBe('acme')
  })
})

describe('config/normalizeLocale', () => {
  it('passes through supported locales unchanged', () => {
    expect(normalizeLocale('fr')).toBe('fr')
    expect(normalizeLocale('en')).toBe('en')
  })

  it('strips the BCP-47 region subtag and keeps the language', () => {
    expect(normalizeLocale('en-US')).toBe('en')
    expect(normalizeLocale('fr-FR')).toBe('fr')
    expect(normalizeLocale('en-GB')).toBe('en')
    expect(normalizeLocale('fr-CA')).toBe('fr')
  })

  it('is case-insensitive on the language subtag', () => {
    expect(normalizeLocale('EN')).toBe('en')
    expect(normalizeLocale('Fr-fR')).toBe('fr')
  })

  it('falls back to the default for unsupported language subtags', () => {
    expect(normalizeLocale('de')).toBe('fr')
    expect(normalizeLocale('es-ES')).toBe('fr')
    expect(normalizeLocale('zh-CN')).toBe('fr')
  })

  it('falls back to the default for non-string / empty / nullish inputs', () => {
    expect(normalizeLocale(undefined)).toBe('fr')
    expect(normalizeLocale(null)).toBe('fr')
    expect(normalizeLocale('')).toBe('fr')
    expect(normalizeLocale(42)).toBe('fr')
    expect(normalizeLocale({})).toBe('fr')
  })

  it('respects an explicit fallback override', () => {
    expect(normalizeLocale('de', 'en')).toBe('en')
    expect(normalizeLocale(undefined, 'en')).toBe('en')
  })
})

describe('config/resolveConfig — locale normalization (v0.5.1)', () => {
  it('normalizes a BCP-47 tag passed via the host config', () => {
    // The static `Locale` type would reject this at compile time, but a JS
    // host can pass it at runtime. We model that with an explicit cast.
    const resolved = resolveConfig({
      endpoint: 'https://api.test/',
      projectId: 'demo',
      locale: 'en-US' as unknown as WidgetConfig['locale'],
    })

    expect(resolved.locale).toBe('en')
  })

  it('falls back to the default for an unsupported runtime locale', () => {
    const resolved = resolveConfig({
      endpoint: 'https://api.test/',
      projectId: 'demo',
      locale: 'de' as unknown as WidgetConfig['locale'],
    })

    expect(resolved.locale).toBe('fr')
  })
})

describe('config/resolveConfig — runtime hardening (v0.5.2)', () => {
  const base: WidgetConfig = {
    endpoint: 'https://api.test/',
    projectId: 'demo',
  }

  // The static types would reject these at compile time, but an untyped JS
  // host (the <script> embed) can pass anything at runtime.
  const asHostInput = (values: readonly string[]): WidgetConfig['categories'] =>
    values as unknown as WidgetConfig['categories']

  it('rejects an unknown theme so data-theme never holds an unmatched value', () => {
    const resolved = resolveConfig({
      ...base,
      theme: 'blue' as unknown as WidgetConfig['theme'],
    })

    expect(resolved.theme).toBeNull()
  })

  it('falls back to the default position for an unknown position value', () => {
    const resolved = resolveConfig({
      ...base,
      position: 'top-right' as unknown as WidgetConfig['position'],
    })

    expect(resolved.position).toBe('bottom-right')
  })

  it('treats an empty categories array as "use the defaults"', () => {
    const resolved = resolveConfig({ ...base, categories: [] })

    expect(resolved.categories).toBeNull()
  })

  it('drops categories the widget cannot render', () => {
    const resolved = resolveConfig({
      ...base,
      // `typo` is a sub-category of `content` since v0.6.0, not a category.
      categories: asHostInput(['bug', 'typo', 'suggestion']),
    })

    expect(resolved.categories).toEqual(['bug', 'suggestion'])
  })

  it('falls back to the defaults when no configured category survives', () => {
    const resolved = resolveConfig({
      ...base,
      // A host still pinned to the pre-v0.6.0 taxonomy.
      categories: asHostInput(['typo', 'error', 'ambiguous', 'other']),
    })

    expect(resolved.categories).toBeNull()
  })

  it('throws on a non-absolute endpoint', () => {
    expect(() =>
      resolveConfig({ ...base, endpoint: '/relative/path' }),
    ).toThrow(/endpoint/i)
  })

  it('throws on an unsafe endpoint scheme (javascript:)', () => {
    expect(() =>
      resolveConfig({ ...base, endpoint: 'javascript:alert(1)' }),
    ).toThrow(/http/i)
  })

  it('clamps absurd numeric config into safe bounds', () => {
    const resolved = resolveConfig({
      ...base,
      maxTransportAttempts: 1_000_000,
      transportTimeoutMs: 999_999_999,
      rateLimitMaxAttempts: 0,
    })

    expect(resolved.maxTransportAttempts).toBe(10)
    expect(resolved.transportTimeoutMs).toBe(60_000)
    expect(resolved.rateLimitMaxAttempts).toBe(1)
  })

  it('falls back to the default for a NaN / non-numeric maxMessageLength', () => {
    const resolved = resolveConfig({
      ...base,
      maxMessageLength: Number.NaN,
    })

    expect(resolved.maxMessageLength).toBe(500)
  })

  it('coerces a fractional numeric config value to an integer', () => {
    const resolved = resolveConfig({ ...base, maxTransportAttempts: 2.7 })

    expect(resolved.maxTransportAttempts).toBe(2)
  })

  it('rejects an http(s) URL with no host (e.g. https:///path)', () => {
    expect(() =>
      resolveConfig({ ...base, endpoint: 'https:///nope/path' }),
    ).toThrow(/endpoint/i)
  })
})

describe('config/normalizeLocale — DoS guard (v0.5.2)', () => {
  it('falls back to the default for a pathologically long input', () => {
    expect(normalizeLocale('e'.repeat(101))).toBe('fr')
  })
})
