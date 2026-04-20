import type { FeedbackPayload } from '../domain/Feedback';
import type { RateLimiter } from '../ports/RateLimiter';
import type { Transport, TransportResult } from '../ports/Transport';

export interface SubmitFeedbackDeps {
  transport: Transport;
  rateLimiter: RateLimiter;
  now: () => number;
  minFormOpenMs: number;
}

export interface SubmitFeedbackInput {
  payload: FeedbackPayload;
  formOpenedAt: number;
  honeypotFilled: boolean;
}

export type SubmitFeedbackReason =
  | 'rate-limited'
  | 'too-fast'
  | 'honeypot'
  | 'network'
  | 'server'
  | 'invalid';

export type SubmitFeedbackResult =
  | { ok: true }
  | { ok: false; reason: SubmitFeedbackReason; status?: number | null };

export async function submitFeedback(
  deps: SubmitFeedbackDeps,
  input: SubmitFeedbackInput,
): Promise<SubmitFeedbackResult> {
  if (input.honeypotFilled) {
    return { ok: false, reason: 'honeypot' };
  }

  const elapsed = deps.now() - input.formOpenedAt;
  if (elapsed < deps.minFormOpenMs) {
    return { ok: false, reason: 'too-fast' };
  }

  if (!deps.rateLimiter.canSubmit()) {
    return { ok: false, reason: 'rate-limited' };
  }

  const result: TransportResult = await deps.transport.send(input.payload);

  if (result.ok) {
    deps.rateLimiter.recordSubmission();
    return { ok: true };
  }

  return { ok: false, reason: result.reason, status: result.status };
}
