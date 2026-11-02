import type {
  TopLevelCategory,
  SubCategory,
  FeedbackTarget,
} from '../domain/Feedback'

/** Steps of the widget flow, in the order a report normally goes through them (`closed` to `confirmed`, or `error`). */
export type WidgetStep =
  | 'closed'
  | 'target-confirm'
  | 'pointing'
  | 'type'
  | 'sub-category'
  | 'precision'
  | 'discard-confirm'
  | 'sending'
  | 'confirmed'
  | 'error'

/** Complete UI state handed to `View.render`. The view is a pure function of it. */
export interface WidgetState {
  step: WidgetStep
  target: FeedbackTarget | null
  selectedCategory: TopLevelCategory | null
  selectedSubCategory: SubCategory | null
  userMessage: string
  reporterName: string
  errorMessage: string | null
}

/** Intents emitted by the view; the controller turns them into `WidgetState` transitions. */
export type UserAction =
  | { kind: 'open' }
  | { kind: 'close' }
  | { kind: 'confirm-target' }
  | { kind: 'reject-target' }
  | { kind: 'cancel-pointing' }
  | { kind: 'pick-target'; target: FeedbackTarget }
  | { kind: 'select-category'; category: TopLevelCategory }
  | { kind: 'select-sub-category'; subCategory: SubCategory }
  | { kind: 'back' }
  | { kind: 'update-message'; value: string }
  | { kind: 'update-reporter'; value: string }
  | { kind: 'submit' }
  | { kind: 'reset' }
  | { kind: 'keep-editing' }
  | { kind: 'discard' }

/** Port for the widget presentation layer. It renders state and reports user intents; it holds no business logic. Every outcome, success and failure alike, reaches it through `render`, so `WidgetState.step` is the single source of the screen shown. */
export interface View {
  render(state: WidgetState): void
  onUserAction(cb: (action: UserAction) => void): void
}
