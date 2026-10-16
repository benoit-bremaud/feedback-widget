import type { FeedbackPayload } from '@benoit-bremaud/feedback-widget-core'
import type { OutboxQueue } from '@benoit-bremaud/feedback-widget-core'

/** Dependencies of `createLocalStorageOutbox`; `now` and `generateId` are injectable for tests. */
export interface LocalStorageOutboxDeps {
  storage: Storage
  key: string
  now: () => number
  generateId?: () => string
}

interface OutboxEntry {
  id: string
  enqueuedAt: number
  payload: FeedbackPayload
}

// Hard cap on queued entries so a long offline streak can't fill the host
// origin's localStorage. When exceeded, the oldest entries are dropped (FIFO).
const MAX_OUTBOX_ENTRIES = 50

/**
 * `OutboxQueue` persisted in `localStorage`. Bounded (50 entries, oldest dropped first) and tolerant: unavailable or corrupt storage reads as empty and writes are skipped silently.
 *
 * `drain` removes only the entries it confirmed sent, so payloads enqueued meanwhile are kept.
 */
export function createLocalStorageOutbox(
  deps: LocalStorageOutboxDeps,
): OutboxQueue {
  const generateId = deps.generateId ?? defaultGenerateId

  const load = (): OutboxEntry[] => {
    try {
      const raw = deps.storage.getItem(deps.key)
      if (!raw) return []
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.filter(isOutboxEntry)
    } catch {
      return []
    }
  }

  const save = (entries: OutboxEntry[]): void => {
    try {
      deps.storage.setItem(deps.key, JSON.stringify(entries))
    } catch {
      // Storage may be unavailable — degrade silently.
    }
  }

  // Remove from current storage only the entries whose id is in `ids`.
  // This is the critical read-modify-write step that defends against the
  // drain/enqueue race: concurrent enqueues added after drain started
  // are preserved because we re-read storage at save time and drop only
  // the ids we actually processed.
  const removeByIds = (ids: Set<string>): void => {
    if (ids.size === 0) return
    const current = load()
    save(current.filter((e) => !ids.has(e.id)))
  }

  return {
    async enqueue(payload: FeedbackPayload): Promise<void> {
      const entries = load()
      entries.push({ id: generateId(), enqueuedAt: deps.now(), payload })
      // Keep only the most recent MAX_OUTBOX_ENTRIES (drop oldest) so the
      // queue can never grow unbounded in the host's localStorage.
      save(
        entries.length > MAX_OUTBOX_ENTRIES
          ? entries.slice(entries.length - MAX_OUTBOX_ENTRIES)
          : entries,
      )
    },

    async drain(send): Promise<void> {
      const snapshot = load()
      if (snapshot.length === 0) return

      const sentIds = new Set<string>()
      for (const entry of snapshot) {
        try {
          const ok = await send(entry.payload)
          if (ok) sentIds.add(entry.id)
        } catch {
          // Keep entry for next retry.
        }
      }

      removeByIds(sentIds)
    },

    async purgeExpired(maxAgeMs: number): Promise<void> {
      const cutoff = deps.now() - maxAgeMs
      const entries = load().filter((e) => e.enqueuedAt > cutoff)
      save(entries)
    },

    async size(): Promise<number> {
      return load().length
    },
  }
}

/**
 * Supported runtime requirement: the host environment MUST expose the
 * Web Crypto API (`globalThis.crypto`) with at least `randomUUID` or
 * `getRandomValues`. All runtimes we ship for in `package.json`
 * `engines` (Node ≥ 20) and every evergreen browser (Chrome ≥ 92,
 * Firefox ≥ 95, Safari ≥ 15.4, Edge ≥ 92) satisfy this.
 *
 * When neither function exists (ancient browsers, sandboxes that
 * strip Web Crypto) the function throws rather than fall back to
 * `Math.random()`. `Math.random` is not cryptographically secure
 * (SonarCloud rule typescript:S2245 — "Weak Cryptography"); falling
 * back to it would silently weaken every ID generated in that
 * environment. Fail-loud is the safer default here — the caller
 * (`enqueue`) surfaces the error to the widget which can disable the
 * outbox cleanly rather than store weak IDs.
 *
 * Note: this is a breaking change vs the pre-PR #37 fallback that
 * used `Math.random()`. Consumers on unsupported runtimes must
 * upgrade or inject a custom `generateId` via `createLocalStorageOutbox`
 * options.
 */
function defaultGenerateId(): string {
  const cryptoRef: Crypto | undefined =
    typeof globalThis !== 'undefined' ? globalThis.crypto : undefined
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    return cryptoRef.randomUUID()
  }
  if (cryptoRef && typeof cryptoRef.getRandomValues === 'function') {
    const bytes = new Uint8Array(6)
    cryptoRef.getRandomValues(bytes)
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(
      '',
    )
    return `fw-${Date.now().toString(36)}-${hex}`
  }
  throw new Error(
    'feedback-widget: no Crypto API available (crypto.randomUUID or crypto.getRandomValues required).',
  )
}

function isOutboxEntry(value: unknown): value is OutboxEntry {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.enqueuedAt === 'number' &&
    typeof v.payload === 'object' &&
    v.payload !== null
  )
}
