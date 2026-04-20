import { describe, it, expect } from 'vitest';
import {
  CATEGORIES,
  CURRENT_SCHEMA_VERSION,
  isValidCategory,
  requiresUserMessage,
} from './Feedback';

describe('domain/Feedback', () => {
  it('exposes all 6 canonical categories', () => {
    expect(CATEGORIES).toEqual(['bug', 'typo', 'error', 'ambiguous', 'suggestion', 'other']);
  });

  it('requires user message only for "other"', () => {
    expect(requiresUserMessage('other')).toBe(true);
    expect(requiresUserMessage('bug')).toBe(false);
    expect(requiresUserMessage('typo')).toBe(false);
  });

  it('validates known categories and rejects unknown ones', () => {
    expect(isValidCategory('bug')).toBe(true);
    expect(isValidCategory('unknown')).toBe(false);
    expect(isValidCategory('')).toBe(false);
  });

  it('current schema version is 1.0', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe('1.0');
  });
});
