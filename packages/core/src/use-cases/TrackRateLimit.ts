import type { RateLimiter } from '../ports/RateLimiter'

export interface TrackRateLimitResult {
  allowed: boolean
}

export function checkRateLimit(limiter: RateLimiter): TrackRateLimitResult {
  return { allowed: limiter.canSubmit() }
}

export function recordSubmission(limiter: RateLimiter): void {
  limiter.recordSubmission()
}
