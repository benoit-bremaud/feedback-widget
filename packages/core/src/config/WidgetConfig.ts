import type { TopLevelCategory } from '../domain/Feedback'

// Bounds for the free-text message, part of the v0.3.0 payload
// contract (10–2000 chars). Shared between the view (inline
// validation) and resolveConfig, which clamps maxMessageLength into
// [MIN, MAX] so an integrator can neither lock users out with a
// ceiling below the floor nor emit payloads above the contract cap.
export const MIN_MESSAGE_LENGTH = 10
export const MAX_MESSAGE_LENGTH = 2000

/** Widget colour scheme. */
export type Theme = 'dark' | 'light'

/**
 * The complete set of widget UI languages. `Locale` is derived from this, so
 * the runtime list and the compile-time union cannot drift apart.
 */
const SUPPORTED_LOCALES = ['fr', 'en'] as const

/** Widget UI language. */
export type Locale = (typeof SUPPORTED_LOCALES)[number]

/**
 * Coerce a host-supplied locale string into one of the supported `Locale`
 * values. A TypeScript host is constrained to the `Locale` union, but JS
 * hosts (and runtime config loaded from JSON, query params, `navigator.
 * language`, …) may pass a BCP-47 tag like `'en-US'` or `'fr-FR'`. Without
 * this guard, `LOCALES[config.locale]` is `undefined` and downstream code
 * crashes at the first render.
 *
 * Strategy: lowercase the input, take the language subtag (everything before
 * the first `-`), accept it if it is in `SUPPORTED_LOCALES`, otherwise fall
 * back to the default. Non-strings (`undefined`, numbers, etc.) also fall
 * back to the default — `resolveConfig` is the runtime boundary.
 */
export function normalizeLocale(
  input: unknown,
  fallback: Locale = 'fr',
): Locale {
  if (typeof input !== 'string') return fallback
  const base = input.toLowerCase().split('-')[0]
  return (SUPPORTED_LOCALES as readonly string[]).includes(base ?? '')
    ? (base as Locale)
    : fallback
}

export interface WidgetConfig {
  endpoint: string
  projectId: string
  token?: string
  categories?: readonly TopLevelCategory[]
  maxMessageLength?: number
  rateLimitWindowMs?: number
  rateLimitMaxAttempts?: number
  minFormOpenMs?: number
  maxTransportAttempts?: number
  transportTimeoutMs?: number
  mailtoFallback?: string
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center'
  /**
   * CSS selector for the root element the pointing-mode picker scans for
   * targetable blocks. Defaults to `'main'` (the detector falls back to
   * `document.body` when not found). Set this when the reportable content
   * lives outside `<main>` — e.g. modals/portals rendered as siblings of it.
   */
  rootSelector?: string
  /**
   * Force the widget colour scheme. When omitted the widget keeps its light
   * palette. A host passes its own resolved theme so the bubble matches the
   * surrounding UI.
   */
  theme?: Theme
  /** UI language for the widget's own strings. Defaults to `'fr'`. */
  locale?: Locale
  /**
   * localStorage key prefix for the per-project rate-limit and outbox state.
   * Defaults to `'feedback-widget'`. Override to isolate storage from other
   * widget instances sharing the same origin.
   */
  storageNamespace?: string
}

export interface ResolvedWidgetConfig extends Required<
  Omit<
    WidgetConfig,
    'token' | 'categories' | 'mailtoFallback' | 'rootSelector' | 'theme'
  >
> {
  token: string | null
  categories: readonly TopLevelCategory[] | null
  mailtoFallback: string | null
  rootSelector: string | null
  theme: Theme | null
}

const DEFAULTS: Omit<ResolvedWidgetConfig, 'endpoint' | 'projectId'> = {
  token: null,
  categories: null,
  maxMessageLength: 500,
  rateLimitWindowMs: 10 * 60 * 1000,
  rateLimitMaxAttempts: 3,
  minFormOpenMs: 2000,
  maxTransportAttempts: 3,
  transportTimeoutMs: 10_000,
  mailtoFallback: null,
  position: 'bottom-right',
  rootSelector: null,
  theme: null,
  locale: 'fr',
  storageNamespace: 'feedback-widget',
}

export function resolveConfig(input: WidgetConfig): ResolvedWidgetConfig {
  return {
    ...DEFAULTS,
    endpoint: input.endpoint,
    projectId: input.projectId,
    token: input.token ?? null,
    categories: input.categories ?? null,
    // Clamp into [MIN, MAX]: a ceiling below the floor would lock users
    // out behind the inline error; a ceiling above MAX would let the
    // widget emit messages longer than the stated payload contract.
    maxMessageLength: Math.min(
      MAX_MESSAGE_LENGTH,
      Math.max(
        MIN_MESSAGE_LENGTH,
        input.maxMessageLength ?? DEFAULTS.maxMessageLength,
      ),
    ),
    rateLimitWindowMs: input.rateLimitWindowMs ?? DEFAULTS.rateLimitWindowMs,
    rateLimitMaxAttempts:
      input.rateLimitMaxAttempts ?? DEFAULTS.rateLimitMaxAttempts,
    minFormOpenMs: input.minFormOpenMs ?? DEFAULTS.minFormOpenMs,
    maxTransportAttempts:
      input.maxTransportAttempts ?? DEFAULTS.maxTransportAttempts,
    transportTimeoutMs: input.transportTimeoutMs ?? DEFAULTS.transportTimeoutMs,
    mailtoFallback: input.mailtoFallback ?? null,
    position: input.position ?? DEFAULTS.position,
    rootSelector: input.rootSelector ?? null,
    theme: input.theme ?? null,
    // Defensive normalization — runtime callers (JS, JSON config, query
    // params) may pass a BCP-47 tag like `'en-US'` that the static `Locale`
    // type would reject at compile time but doesn't block at runtime.
    locale: normalizeLocale(input.locale, DEFAULTS.locale),
    storageNamespace: input.storageNamespace ?? DEFAULTS.storageNamespace,
  }
}
