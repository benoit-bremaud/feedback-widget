export interface RateLimiter {
  canSubmit(): boolean
  recordSubmission(): void
}
