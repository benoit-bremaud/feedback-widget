import { describe, it, expect } from 'vitest'
import {
  TOP_LEVEL_CATEGORIES,
  SUB_CATEGORIES_BY_CATEGORY,
  isValidCategory,
  isValidSubCategory,
  requiresSubCategory,
} from './Feedback'

describe('domain/Feedback', () => {
  describe('top-level categories', () => {
    it('exposes all 6 canonical top-level categories in order', () => {
      expect(TOP_LEVEL_CATEGORIES).toEqual([
        'bug',
        'typo',
        'error',
        'ambiguous',
        'suggestion',
        'other',
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
    it('declares 5 sub-categories per non-other category', () => {
      expect(SUB_CATEGORIES_BY_CATEGORY.bug).toHaveLength(5)
      expect(SUB_CATEGORIES_BY_CATEGORY.typo).toHaveLength(5)
      expect(SUB_CATEGORIES_BY_CATEGORY.error).toHaveLength(5)
      expect(SUB_CATEGORIES_BY_CATEGORY.ambiguous).toHaveLength(5)
      expect(SUB_CATEGORIES_BY_CATEGORY.suggestion).toHaveLength(5)
    })

    it('declares no sub-categories under "other"', () => {
      expect(SUB_CATEGORIES_BY_CATEGORY.other).toEqual([])
    })

    it('locks the canonical bug sub-categories', () => {
      expect(SUB_CATEGORIES_BY_CATEGORY.bug).toEqual([
        'crash',
        'broken-feature',
        'visual-glitch',
        'wrong-output',
        'regression',
      ])
    })

    it('locks the canonical typo sub-categories', () => {
      expect(SUB_CATEGORIES_BY_CATEGORY.typo).toEqual([
        'prose',
        'code-sample',
        'heading',
        'link-text',
        'alt-text',
      ])
    })

    it('locks the canonical error sub-categories', () => {
      expect(SUB_CATEGORIES_BY_CATEGORY.error).toEqual([
        'js-console',
        'http-404',
        'http-5xx',
        'broken-link',
        'missing-asset',
      ])
    })

    it('locks the canonical ambiguous sub-categories', () => {
      expect(SUB_CATEGORIES_BY_CATEGORY.ambiguous).toEqual([
        'wording',
        'navigation',
        'terminology',
        'example-unclear',
        'missing-context',
      ])
    })

    it('locks the canonical suggestion sub-categories', () => {
      expect(SUB_CATEGORIES_BY_CATEGORY.suggestion).toEqual([
        'new-feature',
        'improvement',
        'new-example',
        'content-refactor',
        'accessibility',
      ])
    })

    it('exposes 25 sub-categories in total', () => {
      const total = Object.values(SUB_CATEGORIES_BY_CATEGORY).reduce(
        (sum, list) => sum + list.length,
        0,
      )
      expect(total).toBe(25)
    })
  })

  describe('requiresSubCategory', () => {
    it('returns false only for "other"', () => {
      expect(requiresSubCategory('other')).toBe(false)
    })

    it('returns true for every other top-level category', () => {
      const nonOther = TOP_LEVEL_CATEGORIES.filter((c) => c !== 'other')
      for (const category of nonOther) {
        expect(requiresSubCategory(category)).toBe(true)
      }
    })
  })

  describe('isValidSubCategory', () => {
    it('accepts every sub-category for its parent category', () => {
      for (const category of TOP_LEVEL_CATEGORIES) {
        if (category === 'other') {
          continue
        }
        for (const sub of SUB_CATEGORIES_BY_CATEGORY[category]) {
          expect(isValidSubCategory(category, sub)).toBe(true)
        }
      }
    })

    it('rejects sub-categories from a different parent category', () => {
      // `crash` is a bug sub-category, not a typo one.
      expect(isValidSubCategory('typo', 'crash')).toBe(false)
      expect(isValidSubCategory('error', 'prose')).toBe(false)
      expect(isValidSubCategory('suggestion', 'http-404')).toBe(false)
    })

    it('rejects unknown values regardless of category', () => {
      expect(isValidSubCategory('bug', 'unknown')).toBe(false)
      expect(isValidSubCategory('typo', '')).toBe(false)
    })

    it('always returns false for "other" (no sub-categories allowed)', () => {
      expect(isValidSubCategory('other', 'crash')).toBe(false)
      expect(isValidSubCategory('other', '')).toBe(false)
    })
  })
})
