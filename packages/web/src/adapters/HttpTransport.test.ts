import { describe, it, expect, vi } from 'vitest';
import type { FeedbackPayload } from '@benoit-bremaud/feedback-widget-core';
import { createHttpTransport } from './HttpTransport';

const payload: FeedbackPayload = {
  schemaVersion: '1.0',
  meta: {
    projectId: 'impropedia',
    timestamp: '2026-04-12T12:00:00.000Z',
    viewport: { width: 800, height: 600, device: 'desktop' },
    userAgent: 'UA/1.0',
  },
  identity: { reporterName: null },
  context: {
    pageUrl: 'https://example.test/',
    pageTitle: 'Test',
    target: {
      headingId: null,
      headingText: null,
      blockIndex: null,
      blockTag: null,
      excerpt: null,
    },
  },
  content: { category: 'bug', userMessage: null },
};

function mockResponse(status: number, ok = status >= 200 && status < 300) {
  return { status, ok } as Response;
}

describe('adapters/HttpTransport', () => {
  it('sends the payload as JSON with optional token header', async () => {
    const fetchImpl = vi.fn(async () => mockResponse(200));
    const transport = createHttpTransport({
      endpoint: 'https://api.test/endpoint',
      token: 'public-id',
      maxAttempts: 1,
      backoffMs: () => 0,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async () => {},
    });

    const result = await transport.send(payload);

    expect(result).toEqual({ ok: true, status: 200 });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.test/endpoint',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Feedback-Token': 'public-id',
        }),
        body: JSON.stringify(payload),
      }),
    );
  });

  it('returns rate-limited on 429 without retry', async () => {
    const fetchImpl = vi.fn(async () => mockResponse(429));
    const transport = createHttpTransport({
      endpoint: 'https://api.test/endpoint',
      maxAttempts: 3,
      backoffMs: () => 0,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async () => {},
    });

    const result = await transport.send(payload);

    expect(result).toEqual({ ok: false, status: 429, reason: 'rate-limited' });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('returns invalid on 4xx (except 429) without retry', async () => {
    const fetchImpl = vi.fn(async () => mockResponse(400));
    const transport = createHttpTransport({
      endpoint: 'https://api.test/endpoint',
      maxAttempts: 3,
      backoffMs: () => 0,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async () => {},
    });

    const result = await transport.send(payload);

    expect(result).toEqual({ ok: false, status: 400, reason: 'invalid' });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('retries on 5xx up to maxAttempts then returns server error', async () => {
    const fetchImpl = vi.fn(async () => mockResponse(503));
    const sleep = vi.fn(async () => {});
    const transport = createHttpTransport({
      endpoint: 'https://api.test/endpoint',
      maxAttempts: 3,
      backoffMs: (n) => n * 100,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep,
    });

    const result = await transport.send(payload);

    expect(result).toEqual({ ok: false, status: 503, reason: 'server' });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('retries on network errors and falls back to network reason', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('offline');
    });
    const transport = createHttpTransport({
      endpoint: 'https://api.test/endpoint',
      maxAttempts: 2,
      backoffMs: () => 0,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async () => {},
    });

    const result = await transport.send(payload);

    expect(result).toEqual({ ok: false, status: null, reason: 'network' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
