// One-shot migration of localStorage entries written under the legacy
// hardcoded prefix (`impropedia.feedback-widget`) used by widget versions
// prior to v0.5.0, to the configurable `storageNamespace` introduced in
// v0.5.0. Without this, hosts that had failed submissions queued under the
// legacy outbox key (`impropedia.feedback-widget.outbox.<projectId>`) would
// see those entries orphaned after the bundle refresh: the new code reads
// from `<configured-namespace>.outbox.<projectId>` and never looks at the
// legacy key.
//
// The migration is safe to run on every mount:
// - Idempotent — once the legacy entries are moved + removed, subsequent
//   runs do nothing.
// - Non-destructive — if a key already exists under the new namespace
//   (e.g. the host already migrated manually, or the widget enqueued
//   something new since the bundle update), the new value wins and the
//   legacy value is discarded (best-effort: we never overwrite fresher
//   data with older data).
// - No-op when `legacyPrefix === currentPrefix` (a host that deliberately
//   pinned `storageNamespace: 'impropedia.feedback-widget'` to preserve
//   continuity).
//
// This helper is expected to outlive v0.5.x — once every known host has
// shipped a build that ran the migration at least once, it can be removed
// (target: v0.7.x or later). Tracked as tech debt in PROJECT_LOG.

/** Hardcoded localStorage prefix used by every widget version before v0.5.0. */
export const LEGACY_STORAGE_PREFIX = 'impropedia.feedback-widget'

export interface MigrateLegacyStorageDeps {
  storage: Storage
  legacyPrefix?: string
  currentPrefix: string
}

/**
 * Move every `<legacyPrefix>.<suffix>` localStorage entry under
 * `<currentPrefix>.<suffix>`, then remove the legacy entry. Returns the
 * number of keys actually migrated (useful for tests + diagnostics).
 *
 * Legacy keys are detected by their dotted prefix to avoid matching an
 * unrelated key that merely starts with the same characters (e.g. a host's
 * own `impropedia.feedback-widget-config` would NOT match — it lacks the
 * trailing dot).
 */
export function migrateLegacyStorage(deps: MigrateLegacyStorageDeps): number {
  const legacyPrefix = deps.legacyPrefix ?? LEGACY_STORAGE_PREFIX
  const currentPrefix = deps.currentPrefix
  if (legacyPrefix === currentPrefix) return 0

  const legacyDotPrefix = `${legacyPrefix}.`
  const currentDotPrefix = `${currentPrefix}.`

  // Collect first, mutate second: removing inside the index loop renumbers
  // the keys mid-iteration on every Storage implementation, which would
  // skip half of them silently.
  const legacyKeys: string[] = []
  for (let i = 0; i < deps.storage.length; i++) {
    const key = deps.storage.key(i)
    if (key !== null && key.startsWith(legacyDotPrefix)) legacyKeys.push(key)
  }

  let migrated = 0
  for (const legacyKey of legacyKeys) {
    const suffix = legacyKey.slice(legacyDotPrefix.length)
    const newKey = `${currentDotPrefix}${suffix}`
    const value = deps.storage.getItem(legacyKey)

    // The legacy key was visible to .key() but disappeared between then and
    // now (concurrent tab cleared it, quota eviction, …). Nothing to migrate.
    if (value === null) {
      deps.storage.removeItem(legacyKey)
      continue
    }

    // Don't overwrite fresher data under the new namespace. The legacy
    // value is always discarded (storage.removeItem below).
    if (deps.storage.getItem(newKey) === null) {
      try {
        deps.storage.setItem(newKey, value)
        migrated += 1
      } catch {
        // Quota / private browsing / disabled storage. Leave the legacy key
        // in place so a future mount can retry rather than silently dropping
        // the queued feedback.
        continue
      }
    }

    deps.storage.removeItem(legacyKey)
  }

  return migrated
}
