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

  it('builds a flat payload merging context, category, message, and reporter', () => {
    const payload = buildFeedbackPayload({
      ...baseContext,
      category: 'typo',
      subCategory: 'prose',
      message: 'Missing an "s" on the index page',
      reporterName: 'Pauline',
    })

    expect(payload).toEqual({
      ...baseContext,
      category: 'typo',
      subCategory: 'prose',
      message: 'Missing an "s" on the index page',
      reporterName: 'Pauline',
    })
  })

  it('carries a null reporterName for anonymous feedback', () => {
    const payload = buildFeedbackPayload({
      ...baseContext,
      category: 'other',
      subCategory: null,
      message: 'Anonymous note about the page',
      reporterName: null,
    })
    expect(payload.reporterName).toBeNull()
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

    const error = buildFeedbackPayload({
      ...baseContext,
      category: 'error',
      subCategory: 'http-5xx',
      message: 'Got a 500 on /api/foo',
      reporterName: null,
    })
    expect(error.category).toBe('error')
    expect(error.subCategory).toBe('http-5xx')
  })

  it('forces subCategory to null when category is "other"', () => {
    const payload = buildFeedbackPayload({
      ...baseContext,
      category: 'other',
      subCategory: null,
      message: 'Generic comment that does not fit anywhere',
      reporterName: null,
    })

    expect(payload.category).toBe('other')
    expect(payload.subCategory).toBeNull()
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
      category: 'ambiguous',
      subCategory: 'navigation',
      message: 'I cannot find the docs',
      reporterName: null,
    })
    expect(payload.viewport).toEqual({ w: 1920, h: 1080 })
  })
})
