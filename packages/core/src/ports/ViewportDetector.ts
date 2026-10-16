import type { FeedbackTarget } from '../domain/Feedback'

/**
 * Port that finds the content block the user is looking at and lets them point at any other element, producing the `FeedbackTarget` of a report.
 *
 * Call `destroy` when the widget is removed so no listener or observer leaks.
 */
export interface ViewportDetector {
  getCurrentTarget(): FeedbackTarget | null
  startObserving(): void
  stopObserving(): void
  refresh(): void
  clearHighlight(): void
  enablePointingMode(onPick: (target: FeedbackTarget) => void): void
  disablePointingMode(): void
  /** Tear down all listeners, the observer, and the injected style node. */
  destroy(): void
}
