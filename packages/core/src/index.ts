// domain
export type {
  Category,
  Device,
  Viewport,
  TargetBlock,
  SchemaVersion,
  FeedbackPayload,
} from './domain/Feedback'
export {
  CURRENT_SCHEMA_VERSION,
  CATEGORIES,
  isValidCategory,
  requiresUserMessage,
} from './domain/Feedback'

// ports
export type { OutboxQueue } from './ports/OutboxQueue'
export type { RateLimiter } from './ports/RateLimiter'
export type { Transport, TransportResult } from './ports/Transport'
export type { ViewportDetector } from './ports/ViewportDetector'
export type { WidgetStep, WidgetState, UserAction, View } from './ports/View'

// use-cases
export {
  buildFeedbackPayload,
  EMPTY_TARGET,
} from './use-cases/BuildFeedbackPayload'
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
export { resolveConfig } from './config/WidgetConfig'
