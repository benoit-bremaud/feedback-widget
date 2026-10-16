import type { FeedbackPayload } from '../domain/Feedback'
import type { RateLimiter } from '../ports/RateLimiter'
import type { Transport, TransportResult } from '../ports/Transport'

/** Dependencies of `submitFeedback`. `now` is injected for deterministic tests; `minFormOpenMs` is the anti-bot minimum form-open time. */
export interface SubmitFeedbackDeps {
  transport: Transport
  rateLimiter: RateLimiter
  now: () => number
  minFormOpenMs: number
}

/** Payload to send plus the anti-abuse signals gathered by the view (form-open time, honeypot). */
export interface SubmitFeedbackInput {
  payload: FeedbackPayload
  formOpenedAt: number
  honeypotFilled: boolean
}

/** Why a submission was refused: `honeypot`, `too-fast` and `rate-limited` are decided locally; the others come from the transport. */
export type SubmitFeedbackReason =
  'rate-limited' | 'too-fast' | 'honeypot' | 'network' | 'server' | 'invalid'

/** Outcome of `submitFeedback`. `status` is the HTTP status when the transport reported one. */
export type SubmitFeedbackResult =
  | { ok: true }
  | { ok: false; reason: SubmitFeedbackReason; status?: number | null }

/** Run the local anti-abuse checks (honeypot, minimum form-open time, rate limit) in that order, then send the payload. The rate limiter is charged only after a successful send, so a failed attempt does not burn budget. */
export async function submitFeedback(
  deps: SubmitFeedbackDeps,
  input: SubmitFeedbackInput,
): Promise<SubmitFeedbackResult> {
  if (input.honeypotFilled) {
    return { ok: false, reason: 'honeypot' }
  }

  const elapsed = deps.now() - input.formOpenedAt
  if (elapsed < deps.minFormOpenMs) {
    return { ok: false, reason: 'too-fast' }
  }

  if (!deps.rateLimiter.canSubmit()) {
    return { ok: false, reason: 'rate-limited' }
  }

  const result: TransportResult = await deps.transport.send(input.payload)

  if (result.ok) {
    deps.rateLimiter.recordSubmission()
    return { ok: true }
  }

  return { ok: false, reason: result.reason, status: result.status }
}
