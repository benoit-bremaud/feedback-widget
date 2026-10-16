import type { FeedbackPayload } from '../domain/Feedback'

/** Outcome of one `Transport.send` call. On failure, `reason` classifies it: `rate-limited` (HTTP 429), `invalid` (other 4xx, not retryable), `server` (non-2xx, non-4xx response after retries) or `network` (no response, `status` null). */
export type TransportResult =
  | { ok: true; status: number }
  | {
      ok: false
      status: number | null
      reason: 'rate-limited' | 'network' | 'server' | 'invalid'
    }

/** Port that delivers a payload to the feedback endpoint. Never throws: failures are reported through `TransportResult`. */
export interface Transport {
  send(payload: FeedbackPayload): Promise<TransportResult>
}
