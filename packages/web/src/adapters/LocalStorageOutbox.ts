import type { FeedbackPayload } from '@benoit-bremaud/feedback-widget-core'
import type { OutboxQueue } from '@benoit-bremaud/feedback-widget-core'

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
      save(entries)
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

function defaultGenerateId(): string {
  const cryptoRef: Crypto | undefined =
    typeof globalThis !== 'undefined' ? globalThis.crypto : undefined
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    return cryptoRef.randomUUID()
  }
  // Fallback for environments that expose `crypto` but not the newer
  // `randomUUID` (older WebViews, Node < 14.17). `getRandomValues` ships
  // cryptographically secure bytes everywhere `crypto` is available, so
  // no PRNG (Math.random) is ever used — the SonarCloud Weak-Cryptography
  // Hotspot on the previous implementation is resolved by design.
  if (cryptoRef && typeof cryptoRef.getRandomValues === 'function') {
    const bytes = new Uint8Array(6)
    cryptoRef.getRandomValues(bytes)
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(
      '',
    )
    return `fw-${Date.now().toString(36)}-${hex}`
  }
  // No Crypto API at all — unsupported target. Throw rather than fall
  // back to `Math.random()` (weak PRNG, not cryptographically secure).
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
