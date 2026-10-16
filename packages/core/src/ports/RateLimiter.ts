/** Port for the client-side submission throttle. `canSubmit` is a pure check; only `recordSubmission` consumes budget, and only after a successful send. */
export interface RateLimiter {
  canSubmit(): boolean
  recordSubmission(): void
}
