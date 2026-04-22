import type { FeedbackPayload } from '../domain/Feedback'

export type TransportResult =
  | { ok: true; status: number }
  | {
      ok: false
      status: number | null
      reason: 'rate-limited' | 'network' | 'server' | 'invalid'
    }

export interface Transport {
  send(payload: FeedbackPayload): Promise<TransportResult>
}
