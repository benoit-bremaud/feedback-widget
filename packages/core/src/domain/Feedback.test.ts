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
    it('exposes all 5 canonical top-level categories in order', () => {
      expect(TOP_LEVEL_CATEGORIES).toEqual([
        'bug',
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

    it('locks the canonical bug sub-categories', () => {
      expect(SUB_CATEGORIES_BY_CATEGORY.bug).toEqual([
        'crash',
        'no-effect',
        'broken-display',
        'too-slow',
      ])
    })

    it('locks the canonical content sub-categories', () => {
      expect(SUB_CATEGORIES_BY_CATEGORY.content).toEqual([
        'typo',
        'wrong-info',
        'dead-link',
      ])
    })

    it('locks the canonical unclear sub-categories', () => {
      expect(SUB_CATEGORIES_BY_CATEGORY.unclear).toEqual([
        'wording',
        'missing-info',
        'navigation',
      ])
    })

    it('locks the canonical suggestion sub-categories', () => {
      expect(SUB_CATEGORIES_BY_CATEGORY.suggestion).toEqual([
        'new-feature',
        'improvement',
        'accessibility',
      ])
    })

    it('exposes 13 sub-categories in total', () => {
      const total = Object.values(SUB_CATEGORIES_BY_CATEGORY).reduce(
        (sum, list) => sum + list.length,
        0,
      )
      expect(total).toBe(13)
    })

    it('never reuses the same sub-category under two categories', () => {
      const all = Object.values(SUB_CATEGORIES_BY_CATEGORY).flat()

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

    it('always returns false for "praise" (no sub-categories allowed)', () => {
      expect(isValidSubCategory('praise', 'crash')).toBe(false)
      expect(isValidSubCategory('praise', '')).toBe(false)
    })
  })
})
