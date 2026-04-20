import type {
  Category,
  FeedbackPayload,
  TargetBlock,
  Viewport,
} from '../domain/Feedback';
import { CURRENT_SCHEMA_VERSION } from '../domain/Feedback';

export interface BuildPayloadInput {
  projectId: string;
  pageUrl: string;
  pageTitle: string;
  target: TargetBlock;
  category: Category;
  userMessage: string | null;
  reporterName: string | null;
  viewport: Viewport;
  userAgent: string;
  timestamp: string;
}

export function buildFeedbackPayload(input: BuildPayloadInput): FeedbackPayload {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    meta: {
      projectId: input.projectId,
      timestamp: input.timestamp,
      viewport: input.viewport,
      userAgent: input.userAgent,
    },
    identity: {
      reporterName: input.reporterName,
    },
    context: {
      pageUrl: input.pageUrl,
      pageTitle: input.pageTitle,
      target: input.target,
    },
    content: {
      category: input.category,
      userMessage: input.userMessage,
    },
  };
}

export const EMPTY_TARGET: TargetBlock = {
  headingId: null,
  headingText: null,
  blockIndex: null,
  blockTag: null,
  excerpt: null,
};
