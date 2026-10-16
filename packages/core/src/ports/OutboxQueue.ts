import type { FeedbackPayload } from '../domain/Feedback'

/**
 * Port for a durable queue of payloads that could not be sent, retried later by `drainOutbox`.
 *
 * Implementations must tolerate unavailable storage by degrading silently.
 */
export interface OutboxQueue {
  enqueue(payload: FeedbackPayload): Promise<void>
  drain(send: (payload: FeedbackPayload) => Promise<boolean>): Promise<void>
  purgeExpired(maxAgeMs: number): Promise<void>
  size(): Promise<number>
}
