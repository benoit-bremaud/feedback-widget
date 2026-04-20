import { describe, it, expect } from 'vitest';
import { buildFeedbackPayload, EMPTY_TARGET } from './BuildFeedbackPayload';

describe('use-cases/buildFeedbackPayload', () => {
  const baseInput = {
    projectId: 'impropedia',
    pageUrl: 'https://example.test/page',
    pageTitle: 'Page de test',
    target: EMPTY_TARGET,
    category: 'typo' as const,
    userMessage: 'Il manque un s',
    reporterName: 'Pauline',
    viewport: { width: 412, height: 915, device: 'mobile' as const },
    userAgent: 'UA/1.0',
    timestamp: '2026-04-12T12:00:00.000Z',
  };

  it('builds a payload conforming to the 4-section schema', () => {
    const payload = buildFeedbackPayload(baseInput);

    expect(payload.schemaVersion).toBe('1.0');
    expect(payload.meta.projectId).toBe('impropedia');
    expect(payload.meta.timestamp).toBe('2026-04-12T12:00:00.000Z');
    expect(payload.meta.viewport.device).toBe('mobile');
    expect(payload.identity.reporterName).toBe('Pauline');
    expect(payload.context.pageUrl).toBe('https://example.test/page');
    expect(payload.context.target).toEqual(EMPTY_TARGET);
    expect(payload.content.category).toBe('typo');
    expect(payload.content.userMessage).toBe('Il manque un s');
  });

  it('preserves null values for optional fields', () => {
    const payload = buildFeedbackPayload({
      ...baseInput,
      userMessage: null,
      reporterName: null,
    });

    expect(payload.identity.reporterName).toBeNull();
    expect(payload.content.userMessage).toBeNull();
  });

  it('EMPTY_TARGET has all nullable fields set to null', () => {
    expect(EMPTY_TARGET).toEqual({
      headingId: null,
      headingText: null,
      blockIndex: null,
      blockTag: null,
      excerpt: null,
    });
  });
});
