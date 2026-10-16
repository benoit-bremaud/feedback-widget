/** Vertical extent of a candidate block in CSS pixels, relative to the viewport top (as `getBoundingClientRect` reports it), so the scorer stays DOM-free. */
export interface CandidateRect {
  id: string
  top: number
  bottom: number
  height: number
}

/** Visible viewport in the same frame as `CandidateRect`: `top` is 0 and `height` is the window inner height. */
export interface ViewportRect {
  top: number
  bottom: number
  height: number
}

/** Score of a candidate: fraction of it that is visible, and distance of its centre from the viewport centre. */
export interface BlockScore {
  id: string
  visibleRatio: number
  centerDistance: number
}

/** Compute the `BlockScore` of a candidate against the viewport. A zero-height candidate gets a visible ratio of 0. */
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

/** Pick the most visible candidate, breaking ties by closeness to the viewport centre. Returns null when none is visible. */
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

/** Collapse whitespace and truncate to `maxChars`, appending an ellipsis when cut. */
export function extractExcerpt(text: string, maxChars = 150): string {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (trimmed.length <= maxChars) return trimmed
  return trimmed.slice(0, maxChars).trimEnd() + '…'
}
