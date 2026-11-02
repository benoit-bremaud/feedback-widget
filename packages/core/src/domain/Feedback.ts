/**
 * The feedback taxonomy — single source of truth. Every category type
 * below is DERIVED from this table, so the unions and the runtime list
 * cannot drift apart: dropping a value here removes it from the type
 * too, instead of leaving a union member the widget never renders.
 *
 * A category names the reporter's INTENT, not the technical nature of
 * the defect — the latter is derived downstream from the auto-captured
 * context. Since v0.7.0 (#128, spec docs/architecture/specs/
 * feedback-taxonomy.md) there are six families: `display` splits visual
 * defects off `bug`, every family but `praise` ends with an `other`
 * escape, so a reporter never files a defect under the wrong slot for
 * lack of a precise one.
 *
 * Two contracts ride on this table:
 * - Array order IS the on-screen button order, so reordering is a
 *   user-visible change, not a refactor.
 * - Downstream consumers (feedback-pipeline-worker) duplicate it as
 *   their own allowlist, so any edit is BREAKING and needs a lockstep
 *   update there or valid submissions get rejected.
 */
export const SUB_CATEGORIES_BY_CATEGORY = {
  bug: [
    'no-effect',
    'crash',
    'form-rejected',
    'wrong-data',
    'personal-data',
    'other',
  ],
  display: ['broken-layout', 'mobile', 'missing-media', 'too-slow', 'other'],
  content: ['typo', 'wrong-info', 'outdated', 'dead-link', 'other'],
  unclear: ['wording', 'missing-info', 'navigation', 'question', 'other'],
  suggestion: [
    'new-feature',
    'improvement',
    'design',
    'accessibility',
    'other',
  ],
  // Free text only — the sole category carrying a null sub-category.
  praise: [],
} as const satisfies Record<string, readonly string[]>

/** Top-level feedback category, derived from the taxonomy table. */
export type TopLevelCategory = keyof typeof SUB_CATEGORIES_BY_CATEGORY

/** Sub-categories allowed under `bug`. */
export type BugSubCategory = (typeof SUB_CATEGORIES_BY_CATEGORY)['bug'][number]
/** Sub-categories allowed under `display`. */
export type DisplaySubCategory =
  (typeof SUB_CATEGORIES_BY_CATEGORY)['display'][number]
/** Sub-categories allowed under `content`; derived from `SUB_CATEGORIES_BY_CATEGORY`, so the Worker allowlist must change with it. */
export type ContentSubCategory =
  (typeof SUB_CATEGORIES_BY_CATEGORY)['content'][number]
/** Sub-categories allowed under `unclear`. */
export type UnclearSubCategory =
  (typeof SUB_CATEGORIES_BY_CATEGORY)['unclear'][number]
/** Sub-categories allowed under `suggestion`. */
export type SuggestionSubCategory =
  (typeof SUB_CATEGORIES_BY_CATEGORY)['suggestion'][number]

/**
 * Umbrella union of every sub-category across all top-level
 * categories. Useful for loosely-typed UI state where the parent
 * category is tracked separately; the category/sub-category pairing
 * is re-validated when the payload is built.
 */
export type SubCategory =
  | BugSubCategory
  | DisplaySubCategory
  | ContentSubCategory
  | UnclearSubCategory
  | SuggestionSubCategory

/**
 * Discriminated union pairing each top-level category with its
 * allowed sub-categories. `praise` carries a null sub-category.
 */
export type CategorizedFeedback =
  | { category: 'bug'; subCategory: BugSubCategory }
  | { category: 'display'; subCategory: DisplaySubCategory }
  | { category: 'content'; subCategory: ContentSubCategory }
  | { category: 'unclear'; subCategory: UnclearSubCategory }
  | { category: 'suggestion'; subCategory: SuggestionSubCategory }
  | { category: 'praise'; subCategory: null }

/**
 * A `family/sub-family` key, e.g. `bug/crash`. Mapped over each family's
 * own sub-families, so a pair that cannot exist (`praise/crash`) does
 * not type-check. Needed because `other` exists in several families.
 */
export type CategoryPair = {
  [
    C in TopLevelCategory
  ]: `${C}/${(typeof SUB_CATEGORIES_BY_CATEGORY)[C][number]}`
}[TopLevelCategory]

/**
 * Viewport size in CSS pixels. Replaces the v0.2.0 device-aware
 * Viewport — the receiver can derive device class from w/h if needed.
 */
export interface ViewportSize {
  w: number
  h: number
}

/**
 * Browser-side context auto-captured by the widget at submit time.
 * Returned by the ContextCollector port.
 */
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

/**
 * Flat feedback payload shape introduced by v0.3.0. Replaces the
 * v0.2.0 nested `{ schemaVersion, meta, identity, context, content }`
 * shape. Composed of:
 * - the auto-captured BrowserContext (10 fields)
 * - the user-picked CategorizedFeedback (category + subCategory)
 * - the free-text message (always required, validated 10-2000 chars
 *   at the view layer).
 */
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

/**
 * Descriptor of the element a feedback targets. Produced by the
 * ViewportDetector port (auto-detected content block when the widget
 * opens, or any element the user points at). Part of the
 * FeedbackPayload contract since v0.4.0 — the consumer relies on it to
 * attribute feedback to a specific element.
 *
 * Privacy: never carries a form field's content — entered value, prefilled
 * textarea text, contenteditable text or select options, including fields
 * inside a picked container — only labels, placeholders and non-field text.
 */
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

/**
 * Derived from the table above, so the render order and the type stay
 * in sync with it by construction.
 */
export const TOP_LEVEL_CATEGORIES = Object.keys(
  SUB_CATEGORIES_BY_CATEGORY,
) as readonly TopLevelCategory[]

/** Type guard: true when `value` is a known top-level category. */
export function isValidCategory(value: string): value is TopLevelCategory {
  return (TOP_LEVEL_CATEGORIES as readonly string[]).includes(value)
}

/** True when the category declares at least one sub-category (false for `praise`). */
export function requiresSubCategory(category: TopLevelCategory): boolean {
  return SUB_CATEGORIES_BY_CATEGORY[category].length > 0
}

/**
 * Always false for a category that declares no sub-category (`praise`)
 * — callers must gate on `requiresSubCategory` first rather than
 * reading false as "the user picked an invalid value". Guards the
 * lookup too: an untyped caller can pass a retired category name.
 */
export function isValidSubCategory(
  category: TopLevelCategory,
  value: string,
): boolean {
  if (!isValidCategory(category)) {
    return false
  }
  return (SUB_CATEGORIES_BY_CATEGORY[category] as readonly string[]).includes(
    value,
  )
}
