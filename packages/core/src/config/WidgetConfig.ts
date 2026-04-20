import type { Category } from '../domain/Feedback';

export interface WidgetConfig {
  endpoint: string;
  projectId: string;
  token?: string;
  categories?: readonly Category[];
  maxMessageLength?: number;
  rateLimitWindowMs?: number;
  rateLimitMaxAttempts?: number;
  minFormOpenMs?: number;
  maxTransportAttempts?: number;
  mailtoFallback?: string;
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
}

export interface ResolvedWidgetConfig extends Required<Omit<WidgetConfig, 'token' | 'categories' | 'mailtoFallback'>> {
  token: string | null;
  categories: readonly Category[] | null;
  mailtoFallback: string | null;
}

const DEFAULTS: Omit<ResolvedWidgetConfig, 'endpoint' | 'projectId'> = {
  token: null,
  categories: null,
  maxMessageLength: 500,
  rateLimitWindowMs: 10 * 60 * 1000,
  rateLimitMaxAttempts: 3,
  minFormOpenMs: 2000,
  maxTransportAttempts: 3,
  mailtoFallback: null,
  position: 'bottom-right',
};

export function resolveConfig(input: WidgetConfig): ResolvedWidgetConfig {
  return {
    ...DEFAULTS,
    endpoint: input.endpoint,
    projectId: input.projectId,
    token: input.token ?? null,
    categories: input.categories ?? null,
    maxMessageLength: input.maxMessageLength ?? DEFAULTS.maxMessageLength,
    rateLimitWindowMs: input.rateLimitWindowMs ?? DEFAULTS.rateLimitWindowMs,
    rateLimitMaxAttempts: input.rateLimitMaxAttempts ?? DEFAULTS.rateLimitMaxAttempts,
    minFormOpenMs: input.minFormOpenMs ?? DEFAULTS.minFormOpenMs,
    maxTransportAttempts: input.maxTransportAttempts ?? DEFAULTS.maxTransportAttempts,
    mailtoFallback: input.mailtoFallback ?? null,
    position: input.position ?? DEFAULTS.position,
  };
}
