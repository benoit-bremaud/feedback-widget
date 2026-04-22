import type { OutboxQueue } from '../ports/OutboxQueue'
import type { Transport } from '../ports/Transport'

export interface DrainOutboxDeps {
  outbox: OutboxQueue
  transport: Transport
  maxAgeMs: number
}

export async function drainOutbox(deps: DrainOutboxDeps): Promise<void> {
  await deps.outbox.purgeExpired(deps.maxAgeMs)
  await deps.outbox.drain(async (payload) => {
    const result = await deps.transport.send(payload)
    return result.ok
  })
}
