import type {
  BrowserContext,
  FeedbackPayload,
  FeedbackTarget,
  SubCategory,
  TopLevelCategory,
} from '../domain/Feedback'
import { isValidSubCategory } from '../domain/Feedback'

// Loosely-typed input matching how the UI tracks state: the
// auto-captured BrowserContext, plus a top-level category and a
// nullable sub-category held independently, plus the free-text
// message. `buildFeedbackPayload` validates the category/sub-category
// pairing at runtime and produces the strictly-typed FeedbackPayload.
export type BuildPayloadInput = BrowserContext & {
  category: TopLevelCategory
  subCategory: SubCategory | null
  message: string
  reporterName: string | null
  // The element the feedback targets, or null for page-level feedback.
  target: FeedbackTarget | null
}

// Builds the canonical FeedbackPayload from its constituent parts and
// enforces the core invariant: `praise` carries no sub-category, every
// other category carries a sub-category valid for that category.
// Throws on violation — these are programming errors the view layer is
// expected to prevent, not user-facing validation.
export function buildFeedbackPayload(
  input: BuildPayloadInput,
): FeedbackPayload {
  const context: BrowserContext = {
    projectId: input.projectId,
    url: input.url,
    referrer: input.referrer,
    userAgent: input.userAgent,
    viewport: input.viewport,
    locale: input.locale,
    timestamp: input.timestamp,
    widgetVersion: input.widgetVersion,
    scrollDepth: input.scrollDepth,
    sessionId: input.sessionId,
  }

  // Normalize to null so the payload always honors the documented
  // `FeedbackTarget | null` contract, even if a JS caller (or a file
  // excluded from typechecking) omits `target` (would be `undefined`).
  const target = input.target ?? null

  if (input.category === 'praise') {
    if (input.subCategory !== null) {
      throw new Error(
        'buildFeedbackPayload: category "praise" must not carry a sub-category',
      )
    }
    return {
      ...context,
      message: input.message,
      reporterName: input.reporterName,
      target,
      category: 'praise',
      subCategory: null,
    }
  }

  if (
    input.subCategory === null ||
    !isValidSubCategory(input.category, input.subCategory)
  ) {
    throw new Error(
      `buildFeedbackPayload: invalid sub-category "${input.subCategory}" for category "${input.category}"`,
    )
  }

  // The runtime guard above proves the category/sub-category pairing is
  // valid, but TypeScript cannot reconstruct the discriminated
  // CategorizedFeedback union from the widened input types. The single
  // cast is sound because of that guard.
  return {
    ...context,
    message: input.message,
    reporterName: input.reporterName,
    target,
    category: input.category,
    subCategory: input.subCategory,
  } as FeedbackPayload
}
