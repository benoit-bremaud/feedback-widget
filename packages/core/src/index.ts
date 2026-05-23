// domain
export type {
  TopLevelCategory,
  BugSubCategory,
  TypoSubCategory,
  ErrorSubCategory,
  AmbiguousSubCategory,
  SuggestionSubCategory,
  SubCategory,
  CategorizedFeedback,
  ViewportSize,
  BrowserContext,
  FeedbackPayload,
  FeedbackTarget,
} from './domain/Feedback'
export {
  TOP_LEVEL_CATEGORIES,
  SUB_CATEGORIES_BY_CATEGORY,
  isValidCategory,
  isValidSubCategory,
  requiresSubCategory,
} from './domain/Feedback'

// ports
export type { ContextCollector } from './ports/ContextCollector'
export type { OutboxQueue } from './ports/OutboxQueue'
export type { RateLimiter } from './ports/RateLimiter'
export type { Transport, TransportResult } from './ports/Transport'
export type { ViewportDetector } from './ports/ViewportDetector'
export type { WidgetStep, WidgetState, UserAction, View } from './ports/View'

// use-cases
export { buildFeedbackPayload } from './use-cases/BuildFeedbackPayload'
export type { BuildPayloadInput } from './use-cases/BuildFeedbackPayload'
export {
  scoreCandidate,
  pickBestCandidate,
  extractExcerpt,
} from './use-cases/DetectCurrentBlock'
export type {
  CandidateRect,
  ViewportRect,
  BlockScore,
} from './use-cases/DetectCurrentBlock'
export { drainOutbox } from './use-cases/DrainOutbox'
export type { DrainOutboxDeps } from './use-cases/DrainOutbox'
export { submitFeedback } from './use-cases/SubmitFeedback'
export type {
  SubmitFeedbackDeps,
  SubmitFeedbackInput,
  SubmitFeedbackReason,
  SubmitFeedbackResult,
} from './use-cases/SubmitFeedback'
export { checkRateLimit, recordSubmission } from './use-cases/TrackRateLimit'
export type { TrackRateLimitResult } from './use-cases/TrackRateLimit'

// config
export type { WidgetConfig, ResolvedWidgetConfig } from './config/WidgetConfig'
export { resolveConfig, MIN_MESSAGE_LENGTH } from './config/WidgetConfig'
