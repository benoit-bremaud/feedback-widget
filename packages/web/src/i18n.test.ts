import { describe, it, expect } from 'vitest'
import { LOCALES } from './i18n'

// Flatten a messages tree into { 'a.b.c': value } so the two locales can be
// compared structurally and every leaf checked.
function flatten(obj: unknown, prefix = ''): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (obj && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key
      if (value && typeof value === 'object') {
        Object.assign(out, flatten(value, path))
      } else {
        out[path] = value
      }
    }
  }
  return out
}

describe('i18n/LOCALES', () => {
  const fr = flatten(LOCALES.fr)
  const en = flatten(LOCALES.en)

  it('fr and en expose exactly the same set of message keys', () => {
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort())
  })

  it('every fr message is a non-empty string', () => {
    for (const [path, value] of Object.entries(fr)) {
      expect(typeof value, path).toBe('string')
      expect((value as string).trim().length, path).toBeGreaterThan(0)
    }
  })

  it('every en message is a non-empty string', () => {
    for (const [path, value] of Object.entries(en)) {
      expect(typeof value, path).toBe('string')
      expect((value as string).trim().length, path).toBeGreaterThan(0)
    }
  })

  it('does not leave the FR string when EN is requested', () => {
    expect(LOCALES.fr.trigger.label).not.toBe(LOCALES.en.trigger.label)
    expect(LOCALES.en.trigger.label).toBe('Report')
  })
})
