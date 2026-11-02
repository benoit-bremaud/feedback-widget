import type { TopLevelCategory } from '../domain/Feedback'
import { isValidCategory } from '../domain/Feedback'

/**
 * Bounds for the free-text message, part of the v0.3.0 payload
 * contract (10–2000 chars). Shared between the view (inline
 * validation) and resolveConfig, which clamps maxMessageLength into
 * [MIN, MAX] so an integrator can neither lock users out with a
 * ceiling below the floor nor emit payloads above the contract cap.
 */
export const MIN_MESSAGE_LENGTH = 10
/** Upper bound (inclusive) for the message length, in characters. Part of the Worker payload contract. */
export const MAX_MESSAGE_LENGTH = 2000
/** Upper bound (inclusive) for the optional reporter name, in characters. Part of the Worker payload contract. */
export const MAX_REPORTER_NAME_LENGTH = 50

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
  // Cap the length before processing so a pathologically long string can't
  // turn into wasted work (cheap DoS guard).
  if (typeof input !== 'string' || input.length > 100) return fallback
  const base = input.toLowerCase().split('-')[0]
  return (SUPPORTED_LOCALES as readonly string[]).includes(base ?? '')
    ? (base as Locale)
    : fallback
}

/** Host-supplied widget configuration, as passed to `mountFeedbackWidget`. Only `endpoint` and `projectId` are required; every other field is optional, validated and clamped by `resolveConfig`. */
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
   * targetable blocks. Defaults to `'body'`, so the header, hero and footer
   * are pickable too (the detector falls back to `document.body` when the
   * selector matches nothing). Narrow it (e.g. `'main'`) to limit picking;
   * clicks outside the root are still swallowed while pointing.
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

/** `WidgetConfig` after `resolveConfig`: every field is present and within bounds. Optional values with no default are `null` rather than `undefined`. */
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

const POSITIONS = ['bottom-right', 'bottom-left', 'bottom-center'] as const
type Position = (typeof POSITIONS)[number]

// Clamp a numeric config value into [min, max] and coerce to an integer.
// Non-finite input (NaN, undefined, a string from JSON/query config) falls back
// to the default — so a hostile/misconfigured host can't hang the browser with
// huge retry counts or timeouts, NaN-poison maxMessageLength, feed a fractional
// value (a non-integer maxlength / retry count), or disable rate limiting.
function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.floor(Math.min(max, Math.max(min, value)))
}

function isValidTheme(v: unknown): v is Theme {
  return v === 'dark' || v === 'light'
}

function isValidPosition(v: unknown): v is Position {
  return (POSITIONS as readonly unknown[]).includes(v)
}

// The endpoint must be an absolute http(s) URL. Reject relative URLs and unsafe
// schemes (javascript:, data:, …): a clearly-broken endpoint should fail fast
// at mount rather than silently emitting useless POSTs. A regex is used rather
// than the `URL` constructor so the DOM-free core needs no host-global types.
function validateEndpoint(endpoint: string): string {
  if (!/^https?:\/\/[^/\s]+(\/\S*)?$/i.test(endpoint)) {
    throw new Error(
      `feedback-widget: endpoint must be an absolute http(s) URL, got "${endpoint}"`,
    )
  }
  return endpoint
}

// Keeps only categories the widget can actually render. Returns null (use
// the built-in defaults) when nothing survives — never an empty list.
function resolveCategories(
  input: readonly TopLevelCategory[] | undefined,
): readonly TopLevelCategory[] | null {
  if (!Array.isArray(input)) {
    return null
  }
  const known = input.filter((category) => isValidCategory(category))
  return known.length > 0 ? known : null
}

/**
 * Validate and normalise a host config into a `ResolvedWidgetConfig`.
 *
 * This is the runtime boundary for untyped hosts (script embed, JSON): numeric fields are clamped to safe integer ranges, unknown categories/themes/positions are dropped or defaulted, and the locale is normalised.
 *
 * @throws Error when `endpoint` is not an absolute http(s) URL.
 */
export function resolveConfig(input: WidgetConfig): ResolvedWidgetConfig {
  return {
    ...DEFAULTS,
    endpoint: validateEndpoint(input.endpoint),
    projectId: input.projectId,
    token: input.token ?? null,
    // Unknown category names are dropped rather than trusted: `input` comes
    // from an untyped host (the static <script> embed passes JSON), and the
    // view renders nothing for a name it has no icon for — so a config left
    // on a retired taxonomy would yield a category step with no buttons and
    // no way out. An empty result (or null/undefined) falls back to the
    // defaults for the same reason.
    categories: resolveCategories(input.categories),
    // Clamp into [MIN, MAX]: a ceiling below the floor would lock users out
    // behind the inline error; a ceiling above MAX would breach the payload
    // contract; a non-number would poison the textarea maxlength.
    maxMessageLength: clampInt(
      input.maxMessageLength,
      MIN_MESSAGE_LENGTH,
      MAX_MESSAGE_LENGTH,
      DEFAULTS.maxMessageLength,
    ),
    rateLimitWindowMs: clampInt(
      input.rateLimitWindowMs,
      1_000,
      24 * 60 * 60 * 1_000,
      DEFAULTS.rateLimitWindowMs,
    ),
    rateLimitMaxAttempts: clampInt(
      input.rateLimitMaxAttempts,
      1,
      100,
      DEFAULTS.rateLimitMaxAttempts,
    ),
    minFormOpenMs: clampInt(
      input.minFormOpenMs,
      0,
      60_000,
      DEFAULTS.minFormOpenMs,
    ),
    maxTransportAttempts: clampInt(
      input.maxTransportAttempts,
      1,
      10,
      DEFAULTS.maxTransportAttempts,
    ),
    transportTimeoutMs: clampInt(
      input.transportTimeoutMs,
      100,
      60_000,
      DEFAULTS.transportTimeoutMs,
    ),
    mailtoFallback: input.mailtoFallback ?? null,
    position: isValidPosition(input.position)
      ? input.position
      : DEFAULTS.position,
    rootSelector: input.rootSelector ?? null,
    // Reject an unknown theme so `data-theme` is always 'dark', 'light', or
    // absent (light) — never an unmatched value that silently stays light.
    theme: isValidTheme(input.theme) ? input.theme : null,
    // Defensive normalization — runtime callers (JS, JSON config, query
    // params) may pass a BCP-47 tag like `'en-US'` that the static `Locale`
    // type would reject at compile time but doesn't block at runtime.
    locale: normalizeLocale(input.locale, DEFAULTS.locale),
    storageNamespace: input.storageNamespace ?? DEFAULTS.storageNamespace,
  }
}
