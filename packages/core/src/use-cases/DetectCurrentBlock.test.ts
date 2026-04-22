import { describe, it, expect } from 'vitest'
import {
  extractExcerpt,
  pickBestCandidate,
  scoreCandidate,
} from './DetectCurrentBlock'

const viewport = { top: 0, bottom: 800, height: 800 }

describe('use-cases/DetectCurrentBlock', () => {
  it('returns null when no candidates', () => {
    expect(pickBestCandidate([], viewport)).toBeNull()
  })

  it('ignores candidates fully outside the viewport', () => {
    const best = pickBestCandidate(
      [
        { id: 'a', top: -500, bottom: -100, height: 400 },
        { id: 'b', top: 900, bottom: 1200, height: 300 },
      ],
      viewport,
    )
    expect(best).toBeNull()
  })

  it('picks the candidate with highest visible ratio', () => {
    const best = pickBestCandidate(
      [
        { id: 'partial', top: 700, bottom: 900, height: 200 },
        { id: 'full', top: 100, bottom: 300, height: 200 },
      ],
      viewport,
    )
    expect(best?.id).toBe('full')
  })

  it('breaks ties by preferring the block closer to viewport center', () => {
    const best = pickBestCandidate(
      [
        { id: 'top', top: 0, bottom: 200, height: 200 },
        { id: 'middle', top: 300, bottom: 500, height: 200 },
      ],
      viewport,
    )
    expect(best?.id).toBe('middle')
  })

  it('scoreCandidate computes visible ratio between 0 and 1', () => {
    const score = scoreCandidate(
      { id: 'x', top: -100, bottom: 100, height: 200 },
      viewport,
    )
    expect(score.visibleRatio).toBeCloseTo(0.5)
  })

  it('extractExcerpt normalises whitespace and truncates with ellipsis', () => {
    expect(extractExcerpt('  hello\n\nworld   ')).toBe('hello world')
    const long = 'a'.repeat(200)
    const excerpt = extractExcerpt(long, 50)
    expect(excerpt.length).toBe(51)
    expect(excerpt.endsWith('…')).toBe(true)
  })
})
