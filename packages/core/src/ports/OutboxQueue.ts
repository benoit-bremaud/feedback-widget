import type { FeedbackPayload } from '../domain/Feedback';

export interface OutboxQueue {
  enqueue(payload: FeedbackPayload): Promise<void>;
  drain(send: (payload: FeedbackPayload) => Promise<boolean>): Promise<void>;
  purgeExpired(maxAgeMs: number): Promise<void>;
  size(): Promise<number>;
}
