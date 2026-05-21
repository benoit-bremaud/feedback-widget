import type { TopLevelCategory } from '../domain/Feedback'

// Bounds for the free-text message, part of the v0.3.0 payload
// contract (10–2000 chars). Shared between the view (inline
// validation) and resolveConfig, which clamps maxMessageLength into
// [MIN, MAX] so an integrator can neither lock users out with a
// ceiling below the floor nor emit payloads above the contract cap.
export const MIN_MESSAGE_LENGTH = 10
export const MAX_MESSAGE_LENGTH = 2000

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
  }
}
