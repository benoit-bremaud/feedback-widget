import type { FeedbackPayload } from '@benoit-bremaud/feedback-widget-core'
import type {
  Transport,
  TransportResult,
} from '@benoit-bremaud/feedback-widget-core'

/** Dependencies of `createHttpTransport`; `fetchImpl` and `sleep` are injected so retries are testable without network or real delays. */
export interface HttpTransportDeps {
  endpoint: string
  token?: string
  maxAttempts: number
  timeoutMs: number
  backoffMs: (attempt: number) => number
  fetchImpl: typeof fetch
  sleep: (ms: number) => Promise<void>
}

const hasAbortController = typeof AbortController !== 'undefined'

/**
 * `Transport` that POSTs the JSON payload to the endpoint, sending the optional token as `X-Feedback-Token`.
 *
 * Each attempt has a timeout. 2xx succeeds; 429 and other 4xx stop immediately (`rate-limited` / `invalid`); network errors and any other non-2xx response (5xx in practice) are retried with backoff up to `maxAttempts`, then reported as `network` / `server`.
 */
export function createHttpTransport(deps: HttpTransportDeps): Transport {
  return {
    async send(payload: FeedbackPayload): Promise<TransportResult> {
      let lastStatus: number | null = null

      for (let attempt = 1; attempt <= deps.maxAttempts; attempt++) {
        let controller: AbortController | null = null
        let timer: ReturnType<typeof setTimeout> | undefined
        if (hasAbortController) {
          controller = new AbortController()
          const localController = controller
          timer = setTimeout(() => localController.abort(), deps.timeoutMs)
        }

        try {
          const response = await deps.fetchImpl(deps.endpoint, {
            method: 'POST',
            headers: buildHeaders(deps.token),
            body: JSON.stringify(payload),
            signal: controller?.signal,
          })

          lastStatus = response.status

          if (response.ok) {
            return { ok: true, status: response.status }
          }

          if (response.status === 429) {
            return {
              ok: false,
              status: response.status,
              reason: 'rate-limited',
            }
          }

          if (response.status >= 400 && response.status < 500) {
            return { ok: false, status: response.status, reason: 'invalid' }
          }
        } catch {
          lastStatus = null
        } finally {
          if (timer !== undefined) clearTimeout(timer)
        }

        if (attempt < deps.maxAttempts) {
          await deps.sleep(deps.backoffMs(attempt))
        }
      }

      return {
        ok: false,
        status: lastStatus,
        reason: lastStatus === null ? 'network' : 'server',
      }
    },
  }
}

function buildHeaders(token: string | undefined): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['X-Feedback-Token'] = token
  }
  return headers
}

/** Exponential backoff: 1s, 2s, 4s, ... for attempts 1, 2, 3, ... */
export function defaultBackoff(attempt: number): number {
  return 1000 * Math.pow(2, attempt - 1)
}
