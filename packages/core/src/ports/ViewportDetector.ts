import type { TargetBlock } from '../domain/Feedback'

export interface ViewportDetector {
  getCurrentTarget(): TargetBlock | null
  startObserving(): void
  stopObserving(): void
  refresh(): void
  clearHighlight(): void
  enablePointingMode(onPick: (target: TargetBlock) => void): void
  disablePointingMode(): void
}
