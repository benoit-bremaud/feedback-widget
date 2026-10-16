import type { RateLimiter } from '../ports/RateLimiter'

/** Result of `checkRateLimit`. */
export interface TrackRateLimitResult {
  allowed: boolean
}

/** Ask the limiter whether another submission is allowed, without consuming budget. */
export function checkRateLimit(limiter: RateLimiter): TrackRateLimitResult {
  return { allowed: limiter.canSubmit() }
}

/** Consume one unit of rate-limit budget; call after a successful send. */
export function recordSubmission(limiter: RateLimiter): void {
  limiter.recordSubmission()
}
