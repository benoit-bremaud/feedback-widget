import type { FeedbackPayload } from '@benoit-bremaud/feedback-widget-core';
import type { Transport, TransportResult } from '@benoit-bremaud/feedback-widget-core';

export interface HttpTransportDeps {
  endpoint: string;
  token?: string;
  maxAttempts: number;
  timeoutMs: number;
  backoffMs: (attempt: number) => number;
  fetchImpl: typeof fetch;
  sleep: (ms: number) => Promise<void>;
}

const hasAbortController = typeof AbortController !== 'undefined';

export function createHttpTransport(deps: HttpTransportDeps): Transport {
  return {
    async send(payload: FeedbackPayload): Promise<TransportResult> {
      let lastStatus: number | null = null;

      for (let attempt = 1; attempt <= deps.maxAttempts; attempt++) {
        let controller: AbortController | null = null;
        let timer: ReturnType<typeof setTimeout> | undefined;
        if (hasAbortController) {
          controller = new AbortController();
          const localController = controller;
          timer = setTimeout(() => localController.abort(), deps.timeoutMs);
        }

        try {
          const response = await deps.fetchImpl(deps.endpoint, {
            method: 'POST',
            headers: buildHeaders(deps.token),
            body: JSON.stringify(payload),
            signal: controller?.signal,
          });

          lastStatus = response.status;

          if (response.ok) {
            return { ok: true, status: response.status };
          }

          if (response.status === 429) {
            return { ok: false, status: response.status, reason: 'rate-limited' };
          }

          if (response.status >= 400 && response.status < 500) {
            return { ok: false, status: response.status, reason: 'invalid' };
          }
        } catch {
          lastStatus = null;
        } finally {
          if (timer !== undefined) clearTimeout(timer);
        }

        if (attempt < deps.maxAttempts) {
          await deps.sleep(deps.backoffMs(attempt));
        }
      }

      return {
        ok: false,
        status: lastStatus,
        reason: lastStatus === null ? 'network' : 'server',
      };
    },
  };
}

function buildHeaders(token: string | undefined): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['X-Feedback-Token'] = token;
  }
  return headers;
}

export function defaultBackoff(attempt: number): number {
  return 1000 * Math.pow(2, attempt - 1);
}
