import { describe, expect, it } from 'vitest'
import {
  LEGACY_STORAGE_PREFIX,
  migrateLegacyStorage,
} from './migrateLegacyStorage'

// Minimal in-memory Storage stub mirroring the one used elsewhere in the
// adapter test suite. Iteration order matches insertion order, which is
// good enough for testing prefix scanning since the helper is order-agnostic.
function makeStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map<string, string>(Object.entries(seed))
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v)
    },
    removeItem: (k) => {
      map.delete(k)
    },
    key: (i) => Array.from(map.keys())[i] ?? null,
  }
}

function entries(storage: Storage): Record<string, string> {
  const out: Record<string, string> = {}
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i)
    if (k !== null) {
      const v = storage.getItem(k)
      if (v !== null) out[k] = v
    }
  }
  return out
}

describe('adapters/migrateLegacyStorage', () => {
  it('moves every legacy.<suffix> entry under current.<suffix>', () => {
    const storage = makeStorage({
      [`${LEGACY_STORAGE_PREFIX}.outbox.alpha`]: '[{"id":"x"}]',
      [`${LEGACY_STORAGE_PREFIX}.alpha`]: '{"count":2}',
      'unrelated.key': 'untouched',
    })

    const migrated = migrateLegacyStorage({
      storage,
      currentPrefix: 'feedback-widget',
    })

    expect(migrated).toBe(2)
    expect(entries(storage)).toEqual({
      'feedback-widget.outbox.alpha': '[{"id":"x"}]',
      'feedback-widget.alpha': '{"count":2}',
      'unrelated.key': 'untouched',
    })
  })

  it('is idempotent — a second run does nothing', () => {
    const storage = makeStorage({
      [`${LEGACY_STORAGE_PREFIX}.outbox.alpha`]: '[]',
    })

    expect(
      migrateLegacyStorage({ storage, currentPrefix: 'feedback-widget' }),
    ).toBe(1)
    expect(
      migrateLegacyStorage({ storage, currentPrefix: 'feedback-widget' }),
    ).toBe(0)
    expect(storage.getItem('feedback-widget.outbox.alpha')).toBe('[]')
    expect(
      storage.getItem(`${LEGACY_STORAGE_PREFIX}.outbox.alpha`),
    ).toBeNull()
  })

  it('does not overwrite fresher data already under the new namespace', () => {
    const storage = makeStorage({
      [`${LEGACY_STORAGE_PREFIX}.outbox.alpha`]: '[{"id":"OLD"}]',
      'feedback-widget.outbox.alpha': '[{"id":"NEW"}]',
    })

    const migrated = migrateLegacyStorage({
      storage,
      currentPrefix: 'feedback-widget',
    })

    expect(migrated).toBe(0) // the new value wins, legacy is discarded
    expect(storage.getItem('feedback-widget.outbox.alpha')).toBe('[{"id":"NEW"}]')
    // The legacy key is still cleaned up even when the new key won.
    expect(
      storage.getItem(`${LEGACY_STORAGE_PREFIX}.outbox.alpha`),
    ).toBeNull()
  })

  it('does nothing when legacyPrefix === currentPrefix (host pinned legacy)', () => {
    const storage = makeStorage({
      [`${LEGACY_STORAGE_PREFIX}.outbox.alpha`]: '[]',
    })

    const migrated = migrateLegacyStorage({
      storage,
      currentPrefix: LEGACY_STORAGE_PREFIX,
    })

    expect(migrated).toBe(0)
    expect(storage.getItem(`${LEGACY_STORAGE_PREFIX}.outbox.alpha`)).toBe('[]')
  })

  it('does not match keys that share the prefix without the trailing dot', () => {
    const storage = makeStorage({
      // A host with a key that happens to start with the legacy prefix but
      // is NOT a v0.4 widget key — must be left alone.
      [`${LEGACY_STORAGE_PREFIX}-config`]: 'mine',
      [`${LEGACY_STORAGE_PREFIX}.outbox.alpha`]: '[]',
    })

    migrateLegacyStorage({ storage, currentPrefix: 'feedback-widget' })

    expect(storage.getItem(`${LEGACY_STORAGE_PREFIX}-config`)).toBe('mine')
    expect(storage.getItem('feedback-widget.outbox.alpha')).toBe('[]')
  })

  it('honours an explicit legacyPrefix override', () => {
    const storage = makeStorage({
      'old-name.outbox.alpha': '[]',
    })

    const migrated = migrateLegacyStorage({
      storage,
      legacyPrefix: 'old-name',
      currentPrefix: 'feedback-widget',
    })

    expect(migrated).toBe(1)
    expect(storage.getItem('feedback-widget.outbox.alpha')).toBe('[]')
    expect(storage.getItem('old-name.outbox.alpha')).toBeNull()
  })

  it('handles many legacy keys without skipping any (index renumbering)', () => {
    const seed: Record<string, string> = {}
    for (let i = 0; i < 20; i++) {
      seed[`${LEGACY_STORAGE_PREFIX}.k${i}`] = String(i)
    }
    const storage = makeStorage(seed)

    const migrated = migrateLegacyStorage({
      storage,
      currentPrefix: 'feedback-widget',
    })

    expect(migrated).toBe(20)
    for (let i = 0; i < 20; i++) {
      expect(storage.getItem(`feedback-widget.k${i}`)).toBe(String(i))
      expect(storage.getItem(`${LEGACY_STORAGE_PREFIX}.k${i}`)).toBeNull()
    }
  })
})
