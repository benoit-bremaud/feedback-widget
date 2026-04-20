import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FeedbackPayload } from '@benoit-bremaud/feedback-widget-core';
import { createLocalStorageOutbox } from './LocalStorageOutbox';

function makeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
    key: (i) => Array.from(map.keys())[i] ?? null,
  };
}

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

describe('adapters/LocalStorageOutbox', () => {
  let storage: Storage;
  let currentTime: number;

  beforeEach(() => {
    storage = makeStorage();
    currentTime = 1_000_000;
  });

  const makeOutbox = () =>
    createLocalStorageOutbox({
      storage,
      key: 'outbox',
      now: () => currentTime,
    });

  it('enqueues and reports size', async () => {
    const outbox = makeOutbox();
    expect(await outbox.size()).toBe(0);
    await outbox.enqueue(payload);
    await outbox.enqueue(payload);
    expect(await outbox.size()).toBe(2);
  });

  it('drain removes entries on successful send and keeps failures', async () => {
    const outbox = makeOutbox();
    await outbox.enqueue(payload);
    await outbox.enqueue(payload);
    await outbox.enqueue(payload);

    const send = vi
      .fn<(p: FeedbackPayload) => Promise<boolean>>()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await outbox.drain(send);

    expect(send).toHaveBeenCalledTimes(3);
    expect(await outbox.size()).toBe(1);
  });

  it('drain keeps entries when send throws', async () => {
    const outbox = makeOutbox();
    await outbox.enqueue(payload);

    const send = vi.fn(async () => {
      throw new Error('network down');
    });

    await outbox.drain(send);

    expect(await outbox.size()).toBe(1);
  });

  it('purgeExpired drops entries older than maxAge', async () => {
    const outbox = makeOutbox();
    await outbox.enqueue(payload);
    currentTime += 60_000;
    await outbox.enqueue(payload);

    currentTime += 10_000;
    await outbox.purgeExpired(30_000);

    expect(await outbox.size()).toBe(1);
  });

  it('recovers from corrupted storage', async () => {
    storage.setItem('outbox', 'not-json');
    const outbox = makeOutbox();
    expect(await outbox.size()).toBe(0);
    await outbox.enqueue(payload);
    expect(await outbox.size()).toBe(1);
  });

  it('ignores malformed entries in stored array', async () => {
    storage.setItem('outbox', JSON.stringify([{ notAnEntry: true }, 42]));
    const outbox = makeOutbox();
    expect(await outbox.size()).toBe(0);
  });

  it('preserves entries enqueued concurrently during drain (no race loss)', async () => {
    // C6 regression: drain reads snapshot, awaits sends, then writes back.
    // A concurrent enqueue during those awaits must not be dropped.
    let counter = 0;
    const outbox = createLocalStorageOutbox({
      storage,
      key: 'outbox',
      now: () => currentTime,
      generateId: () => `id-${++counter}`,
    });

    await outbox.enqueue(payload);
    await outbox.enqueue(payload);
    expect(await outbox.size()).toBe(2);

    const send = vi.fn(async () => {
      // Simulate a concurrent enqueue that happens while the drain is
      // mid-flight. With the old implementation this entry would be lost
      // because drain() rewrote storage from a stale snapshot.
      if (counter === 2) {
        await outbox.enqueue(payload);
      }
      return true;
    });

    await outbox.drain(send);

    // 2 sent entries removed, 1 concurrent enqueue preserved.
    expect(await outbox.size()).toBe(1);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
