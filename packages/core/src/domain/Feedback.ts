// Top-level feedback categories surfaced by the widget UI.
//
// A category names the reporter's INTENT, not the technical nature of
// the defect — the latter is derived downstream from the auto-captured
// context. Reworked in v0.6.0: the former `typo`/`error`/`ambiguous`
// trio overlapped and leaked developer vocabulary, and `other` was
// dropped as `unclear`/`suggestion` already absorb the vague cases.
export type TopLevelCategory =
  | 'bug'
  | 'content'
  | 'unclear'
  | 'suggestion'
  | 'praise'

// Sub-categories per top-level category.
export type BugSubCategory =
  | 'crash'
  | 'no-effect'
  | 'broken-display'
  | 'too-slow'

export type ContentSubCategory = 'typo' | 'wrong-info' | 'dead-link'

export type UnclearSubCategory = 'wording' | 'missing-info' | 'navigation'

export type SuggestionSubCategory =
  | 'new-feature'
  | 'improvement'
  | 'accessibility'

// Umbrella union of every sub-category across all top-level
// categories. Useful for loosely-typed UI state where the parent
// category is tracked separately; the category/sub-category pairing
// is re-validated when the payload is built.
export type SubCategory =
  | BugSubCategory
  | ContentSubCategory
  | UnclearSubCategory
  | SuggestionSubCategory

// Discriminated union pairing each top-level category with its
// allowed sub-categories. `praise` carries a null sub-category.
export type CategorizedFeedback =
  | { category: 'bug'; subCategory: BugSubCategory }
  | { category: 'content'; subCategory: ContentSubCategory }
  | { category: 'unclear'; subCategory: UnclearSubCategory }
  | { category: 'suggestion'; subCategory: SuggestionSubCategory }
  | { category: 'praise'; subCategory: null }

// Viewport size in CSS pixels. Replaces the v0.2.0 device-aware
// Viewport — the receiver can derive device class from w/h if needed.
export interface ViewportSize {
  w: number
  h: number
}

// Browser-side context auto-captured by the widget at submit time.
// Returned by the ContextCollector port.
export interface BrowserContext {
  projectId: string
  url: string
  referrer: string | null
  userAgent: string
  viewport: ViewportSize
  locale: string
  timestamp: string
  widgetVersion: string
  scrollDepth: number
  sessionId: string
}

// Flat feedback payload shape introduced by v0.3.0. Replaces the
// v0.2.0 nested `{ schemaVersion, meta, identity, context, content }`
// shape. Composed of:
// - the auto-captured BrowserContext (10 fields)
// - the user-picked CategorizedFeedback (category + subCategory)
// - the free-text message (always required, validated 10-2000 chars
//   at the view layer).
export type FeedbackPayload = BrowserContext &
  CategorizedFeedback & {
    message: string
    // Optional self-identification. Anonymous (null) unless the user
    // typed a name in the form. Carried through so the consumer
    // pipeline can attribute the feedback if provided.
    reporterName: string | null
    // The element the feedback is about, or null for page-level
    // feedback. Lets the consumer pipeline know WHICH element a report
    // targets (a button, a paragraph, …). Since v0.4.0.
    target: FeedbackTarget | null
  }

// Descriptor of the element a feedback targets. Produced by the
// ViewportDetector port (auto-detected content block when the widget
// opens, or any element the user points at). Part of the
// FeedbackPayload contract since v0.4.0 — the consumer relies on it to
// attribute feedback to a specific element.
//
// Privacy: never carries a form field's entered value (only its
// accessible label / placeholder / text), so no user input leaks here.
export interface FeedbackTarget {
  // Lowercased tag name of the element (e.g. 'button', 'p', 'a').
  tag: string
  // Human-readable accessible name: aria-label > alt > placeholder >
  // title > trimmed text content (truncated). Null when none applies.
  label: string | null
  // Bounded CSS path to relocate the element on the page. Null when it
  // cannot be computed.
  selector: string | null
  // Text of the nearest preceding section heading, for context.
  headingText: string | null
  // Short text excerpt of the element (mainly for content blocks; also
  // used by the widget UI preview).
  excerpt: string | null
}

export const TOP_LEVEL_CATEGORIES: readonly TopLevelCategory[] = [
  'bug',
  'content',
  'unclear',
  'suggestion',
  'praise',
] as const

export const SUB_CATEGORIES_BY_CATEGORY: Readonly<{
  bug: readonly BugSubCategory[]
  content: readonly ContentSubCategory[]
  unclear: readonly UnclearSubCategory[]
  suggestion: readonly SuggestionSubCategory[]
  praise: readonly never[]
}> = {
  bug: ['crash', 'no-effect', 'broken-display', 'too-slow'] as const,
  content: ['typo', 'wrong-info', 'dead-link'] as const,
  unclear: ['wording', 'missing-info', 'navigation'] as const,
  suggestion: ['new-feature', 'improvement', 'accessibility'] as const,
  praise: [] as const,
}

export function isValidCategory(value: string): value is TopLevelCategory {
  return (TOP_LEVEL_CATEGORIES as readonly string[]).includes(value)
}

// `praise` is the only category with no sub-category — it falls back
// to free text only.
export function requiresSubCategory(category: TopLevelCategory): boolean {
  return category !== 'praise'
}

export function isValidSubCategory(
  category: TopLevelCategory,
  value: string,
): boolean {
  if (category === 'praise') {
    return false
  }
  return (SUB_CATEGORIES_BY_CATEGORY[category] as readonly string[]).includes(
    value,
  )
}
