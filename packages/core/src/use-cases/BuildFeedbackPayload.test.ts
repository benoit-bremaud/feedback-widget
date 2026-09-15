import { describe, it, expect } from 'vitest'
import { buildFeedbackPayload } from './BuildFeedbackPayload'
import type { BrowserContext } from '../domain/Feedback'

describe('use-cases/buildFeedbackPayload', () => {
  const baseContext: BrowserContext = {
    projectId: 'brasse-bouillon',
    url: 'https://example.test/page',
    referrer: 'https://example.test/',
    userAgent: 'UA/1.0',
    viewport: { w: 412, h: 915 },
    locale: 'fr-FR',
    timestamp: '2026-04-24T12:00:00.000Z',
    widgetVersion: '0.3.0',
    scrollDepth: 0.42,
    sessionId: '01HK3M-AAAA-BBBB-CCCC-DDDDEEEEFFFF',
  }

  it('builds a flat payload merging context, category, message, reporter, and target', () => {
    const target = {
      tag: 'button',
      label: 'Acheter',
      selector: '#cta',
      headingText: 'Panier',
      excerpt: 'Acheter',
    }
    const payload = buildFeedbackPayload({
      ...baseContext,
      category: 'content',
      subCategory: 'typo',
      message: 'Missing an "s" on the index page',
      reporterName: 'Pauline',
      target,
    })

    expect(payload).toEqual({
      ...baseContext,
      category: 'content',
      subCategory: 'typo',
      message: 'Missing an "s" on the index page',
      reporterName: 'Pauline',
      target,
    })
  })

  it('carries a null reporterName and target for anonymous, page-level feedback', () => {
    const payload = buildFeedbackPayload({
      ...baseContext,
      category: 'praise',
      subCategory: null,
      message: 'Anonymous note about the page',
      reporterName: null,
      target: null,
    })
    expect(payload.reporterName).toBeNull()
    expect(payload.target).toBeNull()
  })

  it('preserves the discriminated category-subCategory pairing', () => {
    const bug = buildFeedbackPayload({
      ...baseContext,
      category: 'bug',
      subCategory: 'crash',
      message: 'App crashes on load',
      reporterName: null,
    })
    expect(bug.category).toBe('bug')
    expect(bug.subCategory).toBe('crash')

    const content = buildFeedbackPayload({
      ...baseContext,
      category: 'content',
      subCategory: 'dead-link',
      message: 'The install link 404s',
      reporterName: null,
    })
    expect(content.category).toBe('content')
    expect(content.subCategory).toBe('dead-link')
  })

  it('rejects a sub-category under "praise"', () => {
    expect(() =>
      buildFeedbackPayload({
        ...baseContext,
        category: 'praise',
        subCategory: 'crash',
        message: 'Praise carries no sub-category',
        reporterName: null,
      }),
    ).toThrow(/must not carry a sub-category/)
  })

  it('rejects a sub-category belonging to another category', () => {
    expect(() =>
      buildFeedbackPayload({
        ...baseContext,
        // `typo` is a content sub-category, not a bug one.
        category: 'bug',
        subCategory: 'typo',
        message: 'Cross-category pairing must not build',
        reporterName: null,
      }),
    ).toThrow(/invalid sub-category/)
  })

  it('rejects a missing sub-category on a category that requires one', () => {
    expect(() =>
      buildFeedbackPayload({
        ...baseContext,
        category: 'unclear',
        subCategory: null,
        message: 'Missing sub-category must not build',
        reporterName: null,
      }),
    ).toThrow(/invalid sub-category/)
  })

  it('normalizes an omitted target to null on a sub-categorized payload', () => {
    const payload = buildFeedbackPayload({
      ...baseContext,
      category: 'bug',
      subCategory: 'crash',
      message: 'App crashes on load',
      reporterName: null,
    })

    expect(payload.target).toBeNull()
  })

  it('preserves a null referrer (top-level navigation)', () => {
    const payload = buildFeedbackPayload({
      ...baseContext,
      referrer: null,
      category: 'suggestion',
      subCategory: 'new-feature',
      message: 'Add a dark mode',
      reporterName: null,
    })
    expect(payload.referrer).toBeNull()
  })

  it('keeps the auto-capture viewport intact', () => {
    const payload = buildFeedbackPayload({
      ...baseContext,
      viewport: { w: 1920, h: 1080 },
      category: 'unclear',
      subCategory: 'navigation',
      message: 'I cannot find the docs',
      reporterName: null,
    })
    expect(payload.viewport).toEqual({ w: 1920, h: 1080 })
  })
})
