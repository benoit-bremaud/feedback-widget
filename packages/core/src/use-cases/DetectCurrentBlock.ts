export interface CandidateRect {
  id: string
  top: number
  bottom: number
  height: number
}

export interface ViewportRect {
  top: number
  bottom: number
  height: number
}

export interface BlockScore {
  id: string
  visibleRatio: number
  centerDistance: number
}

export function scoreCandidate(
  candidate: CandidateRect,
  viewport: ViewportRect,
): BlockScore {
  const visibleTop = Math.max(candidate.top, viewport.top)
  const visibleBottom = Math.min(candidate.bottom, viewport.bottom)
  const visibleHeight = Math.max(0, visibleBottom - visibleTop)
  const visibleRatio =
    candidate.height > 0 ? visibleHeight / candidate.height : 0

  const viewportCenter = viewport.top + viewport.height / 2
  const candidateCenter = candidate.top + candidate.height / 2
  const centerDistance = Math.abs(candidateCenter - viewportCenter)

  return { id: candidate.id, visibleRatio, centerDistance }
}

export function pickBestCandidate(
  candidates: CandidateRect[],
  viewport: ViewportRect,
): BlockScore | null {
  if (candidates.length === 0) return null

  const scored = candidates
    .map((c) => scoreCandidate(c, viewport))
    .filter((s) => s.visibleRatio > 0)

  if (scored.length === 0) return null

  scored.sort((a, b) => {
    if (b.visibleRatio !== a.visibleRatio) {
      return b.visibleRatio - a.visibleRatio
    }
    return a.centerDistance - b.centerDistance
  })

  return scored[0] ?? null
}

export function extractExcerpt(text: string, maxChars = 150): string {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (trimmed.length <= maxChars) return trimmed
  return trimmed.slice(0, maxChars).trimEnd() + '…'
}
