import type { TopLevelCategory } from '../domain/Feedback'

// Minimum length the free-text message must reach to be submittable.
// Shared between the view (inline validation) and resolveConfig (which
// clamps maxMessageLength so an integrator can never set a ceiling
// below the floor and lock users out).
export const MIN_MESSAGE_LENGTH = 10

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
}

export interface ResolvedWidgetConfig extends Required<
  Omit<WidgetConfig, 'token' | 'categories' | 'mailtoFallback'>
> {
  token: string | null
  categories: readonly TopLevelCategory[] | null
  mailtoFallback: string | null
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
}

export function resolveConfig(input: WidgetConfig): ResolvedWidgetConfig {
  return {
    ...DEFAULTS,
    endpoint: input.endpoint,
    projectId: input.projectId,
    token: input.token ?? null,
    categories: input.categories ?? null,
    // Clamp to MIN_MESSAGE_LENGTH so a misconfigured ceiling below the
    // submit floor can't permanently block users behind the inline error.
    maxMessageLength: Math.max(
      MIN_MESSAGE_LENGTH,
      input.maxMessageLength ?? DEFAULTS.maxMessageLength,
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
  }
}
