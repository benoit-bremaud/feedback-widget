import type { OutboxQueue } from '../ports/OutboxQueue'
import type { Transport } from '../ports/Transport'

/** Dependencies of `drainOutbox`; `maxAgeMs` is the retention after which queued payloads are discarded. */
export interface DrainOutboxDeps {
  outbox: OutboxQueue
  transport: Transport
  maxAgeMs: number
}

/** Retry queued payloads: purge expired entries, then resend each one. Only entries the transport confirms are removed; the rest stay queued for the next drain. */
export async function drainOutbox(deps: DrainOutboxDeps): Promise<void> {
  await deps.outbox.purgeExpired(deps.maxAgeMs)
  await deps.outbox.drain(async (payload) => {
    const result = await deps.transport.send(payload)
    return result.ok
  })
}
