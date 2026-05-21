import { describe, it, expect } from 'vitest'
import { createBrowserContextCollector } from './BrowserContextCollector'

// Minimal fakes for the browser globals the collector reads. Each test
// builds exactly the shape it needs so the assertions stay focused.
function makeWin(overrides: Partial<Window> = {}): Window {
  return {
    location: { href: 'https://example.test/page' },
    innerWidth: 1024,
    innerHeight: 768,
    scrollY: 0,
    navigator: { userAgent: 'UA/Test', language: 'fr-FR' },
    ...overrides,
  } as unknown as Window
}

function makeDoc(overrides: Partial<Document> = {}): Document {
  return {
    referrer: 'https://example.test/',
    documentElement: { scrollHeight: 768 },
    ...overrides,
  } as unknown as Document
}

const baseOptions = {
  projectId: 'brasse-bouillon',
  widgetVersion: '0.3.0',
  sessionId: 'sess-123',
}

describe('adapters/BrowserContextCollector', () => {
  it('collects all 10 fields from the injected globals', () => {
    const collector = createBrowserContextCollector({
      ...baseOptions,
      win: makeWin(),
      doc: makeDoc(),
    })

    const ctx = collector.collect()

    expect(ctx.projectId).toBe('brasse-bouillon')
    expect(ctx.url).toBe('https://example.test/page')
    expect(ctx.referrer).toBe('https://example.test/')
    expect(ctx.userAgent).toBe('UA/Test')
    expect(ctx.viewport).toEqual({ w: 1024, h: 768 })
    expect(ctx.locale).toBe('fr-FR')
    expect(typeof ctx.timestamp).toBe('string')
    expect(new Date(ctx.timestamp).toISOString()).toBe(ctx.timestamp)
    expect(ctx.widgetVersion).toBe('0.3.0')
    expect(ctx.scrollDepth).toBe(0)
    expect(ctx.sessionId).toBe('sess-123')
  })

  it('reports null referrer when the document referrer is empty', () => {
    const collector = createBrowserContextCollector({
      ...baseOptions,
      win: makeWin(),
      doc: makeDoc({ referrer: '' } as Partial<Document>),
    })

    expect(collector.collect().referrer).toBeNull()
  })

  it('computes scrollDepth as the fraction of the page scrolled', () => {
    // viewport 768, content 1768 → scrollable 1000; scrollY 250 → 0.25
    const collector = createBrowserContextCollector({
      ...baseOptions,
      win: makeWin({ scrollY: 250 } as Partial<Window>),
      doc: makeDoc({
        documentElement: { scrollHeight: 1768 },
      } as unknown as Partial<Document>),
    })

    expect(collector.collect().scrollDepth).toBe(0.25)
  })

  it('clamps scrollDepth to 1 when scrolled past the computed bottom', () => {
    const collector = createBrowserContextCollector({
      ...baseOptions,
      win: makeWin({ scrollY: 5000 } as Partial<Window>),
      doc: makeDoc({
        documentElement: { scrollHeight: 1768 },
      } as unknown as Partial<Document>),
    })

    expect(collector.collect().scrollDepth).toBe(1)
  })

  it('reports scrollDepth 0 when the page is not scrollable', () => {
    // content shorter than viewport → nothing to scroll
    const collector = createBrowserContextCollector({
      ...baseOptions,
      win: makeWin({ scrollY: 0 } as Partial<Window>),
      doc: makeDoc({
        documentElement: { scrollHeight: 400 },
      } as unknown as Partial<Document>),
    })

    expect(collector.collect().scrollDepth).toBe(0)
  })

  it('degrades to safe defaults when globals are missing', () => {
    const collector = createBrowserContextCollector({
      ...baseOptions,
      win: {} as unknown as Window,
      doc: {} as unknown as Document,
    })

    const ctx = collector.collect()

    expect(ctx.url).toBe('')
    expect(ctx.referrer).toBeNull()
    expect(ctx.viewport).toEqual({ w: 0, h: 0 })
    expect(ctx.scrollDepth).toBe(0)
  })

  it('produces a fresh timestamp on each collect call', async () => {
    const collector = createBrowserContextCollector({
      ...baseOptions,
      win: makeWin(),
      doc: makeDoc(),
    })

    const first = collector.collect().timestamp
    await new Promise((resolve) => setTimeout(resolve, 2))
    const second = collector.collect().timestamp

    expect(new Date(second).getTime()).toBeGreaterThanOrEqual(
      new Date(first).getTime(),
    )
  })
})
