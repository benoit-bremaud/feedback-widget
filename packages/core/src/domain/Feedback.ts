export type Category =
  | 'bug'
  | 'typo'
  | 'error'
  | 'ambiguous'
  | 'suggestion'
  | 'other'

export type Device = 'mobile' | 'tablet' | 'desktop'

export interface Viewport {
  width: number
  height: number
  device: Device
}

export interface TargetBlock {
  headingId: string | null
  headingText: string | null
  blockIndex: number | null
  blockTag: string | null
  excerpt: string | null
}

export type SchemaVersion = string

export interface FeedbackPayload {
  schemaVersion: SchemaVersion
  meta: {
    projectId: string
    timestamp: string
    viewport: Viewport
    userAgent: string
  }
  identity: {
    reporterName: string | null
  }
  context: {
    pageUrl: string
    pageTitle: string
    target: TargetBlock
  }
  content: {
    category: Category
    userMessage: string | null
  }
}

export const CURRENT_SCHEMA_VERSION: SchemaVersion = '1.0'

export const CATEGORIES: readonly Category[] = [
  'bug',
  'typo',
  'error',
  'ambiguous',
  'suggestion',
  'other',
] as const

export function isValidCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value)
}

export function requiresUserMessage(category: Category): boolean {
  return category === 'other'
}
