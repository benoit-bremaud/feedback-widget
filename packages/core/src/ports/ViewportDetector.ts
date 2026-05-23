import type { FeedbackTarget } from '../domain/Feedback'

export interface ViewportDetector {
  getCurrentTarget(): FeedbackTarget | null
  startObserving(): void
  stopObserving(): void
  refresh(): void
  clearHighlight(): void
  enablePointingMode(onPick: (target: FeedbackTarget) => void): void
  disablePointingMode(): void
}
