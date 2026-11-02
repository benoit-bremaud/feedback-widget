import { describe, it, expect } from 'vitest'
import {
  TOP_LEVEL_CATEGORIES,
  SUB_CATEGORIES_BY_CATEGORY,
  isValidCategory,
  isValidSubCategory,
  requiresSubCategory,
  type TopLevelCategory,
} from './Feedback'

describe('domain/Feedback', () => {
  describe('top-level categories', () => {
    it('exposes all 6 canonical top-level categories in order', () => {
      expect(TOP_LEVEL_CATEGORIES).toEqual([
        'bug',
        'display',
        'content',
        'unclear',
        'suggestion',
        'praise',
      ])
    })

    it('isValidCategory accepts every canonical category', () => {
      for (const category of TOP_LEVEL_CATEGORIES) {
        expect(isValidCategory(category)).toBe(true)
      }
    })

    it('isValidCategory rejects unknown values', () => {
      expect(isValidCategory('unknown')).toBe(false)
      expect(isValidCategory('')).toBe(false)
      expect(isValidCategory('Bug')).toBe(false)
    })
  })

  describe('sub-categories', () => {
    it('declares no sub-categories under "praise"', () => {
      expect(SUB_CATEGORIES_BY_CATEGORY.praise).toEqual([])
    })

    it.each([
      [
        'bug',
        [
          'no-effect',
          'crash',
          'form-rejected',
          'wrong-data',
          'personal-data',
          'other',
        ],
      ],
      [
        'display',
        ['broken-layout', 'mobile', 'missing-media', 'too-slow', 'other'],
      ],
      ['content', ['typo', 'wrong-info', 'outdated', 'dead-link', 'other']],
      [
        'unclear',
        ['wording', 'missing-info', 'navigation', 'question', 'other'],
      ],
      [
        'suggestion',
        ['new-feature', 'improvement', 'design', 'accessibility', 'other'],
      ],
    ] as const)('locks the canonical %s sub-categories', (category, subs) => {
      expect(SUB_CATEGORIES_BY_CATEGORY[category]).toEqual(subs)
    })

    it('exposes 26 sub-categories in total', () => {
      const total = Object.values(SUB_CATEGORIES_BY_CATEGORY).reduce(
        (sum, list) => sum + list.length,
        0,
      )

      expect(total).toBe(26)
    })

    it('ends every family that has sub-categories with "other"', () => {
      for (const subs of Object.values(SUB_CATEGORIES_BY_CATEGORY)) {
        if (subs.length > 0) expect(subs.at(-1)).toBe('other')
      }
    })

    it('reuses no sub-category across families except "other"', () => {
      const all = Object.values(SUB_CATEGORIES_BY_CATEGORY)
        .flat()
        .filter((sub) => sub !== 'other')

      expect(new Set(all).size).toBe(all.length)
    })
  })

  describe('requiresSubCategory', () => {
    it('returns false only for "praise"', () => {
      expect(requiresSubCategory('praise')).toBe(false)
    })

    it('returns true for every other top-level category', () => {
      const nonPraise = TOP_LEVEL_CATEGORIES.filter((c) => c !== 'praise')
      for (const category of nonPraise) {
        expect(requiresSubCategory(category)).toBe(true)
      }
    })
  })

  describe('isValidSubCategory', () => {
    it('accepts every sub-category for its parent category', () => {
      for (const category of TOP_LEVEL_CATEGORIES) {
        if (category === 'praise') {
          continue
        }
        for (const sub of SUB_CATEGORIES_BY_CATEGORY[category]) {
          expect(isValidSubCategory(category, sub)).toBe(true)
        }
      }
    })

    it('rejects sub-categories from a different parent category', () => {
      // `crash` is a bug sub-category, not a content one.
      expect(isValidSubCategory('content', 'crash')).toBe(false)
      expect(isValidSubCategory('unclear', 'typo')).toBe(false)
      expect(isValidSubCategory('suggestion', 'dead-link')).toBe(false)
    })

    it('rejects unknown values regardless of category', () => {
      expect(isValidSubCategory('bug', 'unknown')).toBe(false)
      expect(isValidSubCategory('content', '')).toBe(false)
    })

    it('returns false (and does not throw) for a retired category name from an untyped caller', () => {
      const retired = 'legacy-category' as unknown as TopLevelCategory

      expect(isValidSubCategory(retired, 'crash')).toBe(false)
      expect(isValidSubCategory(retired, '')).toBe(false)
    })

    it('always returns false for "praise" (no sub-categories allowed)', () => {
      expect(isValidSubCategory('praise', 'crash')).toBe(false)
      expect(isValidSubCategory('praise', '')).toBe(false)
    })
  })
})
