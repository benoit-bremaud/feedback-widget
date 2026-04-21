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
      timeoutMs: 10_000,
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

  it('passes a distinct AbortSignal to fetch for each attempt', async () => {
    let call = 0;
    const fetchImpl = vi.fn(async () => {
      call += 1;
      return call === 1 ? mockResponse(503) : mockResponse(200);
    });
    const transport = createHttpTransport({
      endpoint: 'https://api.test/endpoint',
      maxAttempts: 2,
      timeoutMs: 10_000,
      backoffMs: () => 0,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async () => {},
    });

    await transport.send(payload);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const init1 = fetchImpl.mock.calls[0][1] as RequestInit;
    const init2 = fetchImpl.mock.calls[1][1] as RequestInit;
    expect(init1.signal).toBeInstanceOf(AbortSignal);
    expect(init2.signal).toBeInstanceOf(AbortSignal);
    expect(init1.signal).not.toBe(init2.signal);
    expect(init1.signal?.aborted).toBe(false);
    expect(init2.signal?.aborted).toBe(false);
  });

  it('returns rate-limited on 429 without retry', async () => {
    const fetchImpl = vi.fn(async () => mockResponse(429));
    const transport = createHttpTransport({
      endpoint: 'https://api.test/endpoint',
      maxAttempts: 3,
      timeoutMs: 10_000,
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
      timeoutMs: 10_000,
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
      timeoutMs: 10_000,
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
      timeoutMs: 10_000,
      backoffMs: () => 0,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async () => {},
    });

    const result = await transport.send(payload);

    expect(result).toEqual({ ok: false, status: null, reason: 'network' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('aborts the fetch when the request exceeds timeoutMs', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn((_url: string, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        });
      });

      const transport = createHttpTransport({
        endpoint: 'https://api.test/endpoint',
        maxAttempts: 1,
        timeoutMs: 5_000,
        backoffMs: () => 0,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        sleep: async () => {},
      });

      const sendPromise = transport.send(payload);
      await vi.advanceTimersByTimeAsync(5_000);
      const result = await sendPromise;

      expect(result).toEqual({ ok: false, status: null, reason: 'network' });
      const init = fetchImpl.mock.calls[0][1] as RequestInit;
      expect(init.signal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('retries after a timeout and succeeds on a later attempt', async () => {
    vi.useFakeTimers();
    try {
      let call = 0;
      const fetchImpl = vi.fn((_url: string, init?: RequestInit) => {
        call += 1;
        if (call === 1) {
          return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('aborted', 'AbortError'));
            });
          });
        }
        return Promise.resolve(mockResponse(200));
      });

      const transport = createHttpTransport({
        endpoint: 'https://api.test/endpoint',
        maxAttempts: 3,
        timeoutMs: 5_000,
        backoffMs: () => 0,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        sleep: async () => {},
      });

      const sendPromise = transport.send(payload);
      await vi.advanceTimersByTimeAsync(5_000);
      const result = await sendPromise;

      expect(result).toEqual({ ok: true, status: 200 });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns network reason after every attempt times out', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn((_url: string, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        });
      });

      const transport = createHttpTransport({
        endpoint: 'https://api.test/endpoint',
        maxAttempts: 3,
        timeoutMs: 5_000,
        backoffMs: () => 0,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        sleep: async () => {},
      });

      const sendPromise = transport.send(payload);
      await vi.advanceTimersByTimeAsync(5_000);
      await vi.advanceTimersByTimeAsync(5_000);
      await vi.advanceTimersByTimeAsync(5_000);
      const result = await sendPromise;

      expect(result).toEqual({ ok: false, status: null, reason: 'network' });
      expect(fetchImpl).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
