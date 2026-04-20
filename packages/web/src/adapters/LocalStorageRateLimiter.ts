import type { RateLimiter } from '@benoit-bremaud/feedback-widget-core';

export interface LocalStorageRateLimiterDeps {
  storage: Storage;
  key: string;
  windowMs: number;
  maxAttempts: number;
  now: () => number;
}

export function createLocalStorageRateLimiter(
  deps: LocalStorageRateLimiterDeps,
): RateLimiter {
  const loadTimestamps = (): number[] => {
    try {
      const raw = deps.storage.getItem(deps.key);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((v): v is number => typeof v === 'number');
    } catch {
      return [];
    }
  };

  const saveTimestamps = (timestamps: number[]): void => {
    try {
      deps.storage.setItem(deps.key, JSON.stringify(timestamps));
    } catch {
      // localStorage may be unavailable (private mode, quota). Degrade silently.
    }
  };

  const pruneExpired = (timestamps: number[], now: number): number[] => {
    const cutoff = now - deps.windowMs;
    return timestamps.filter((t) => t > cutoff);
  };

  return {
    canSubmit(): boolean {
      const now = deps.now();
      const valid = pruneExpired(loadTimestamps(), now);
      return valid.length < deps.maxAttempts;
    },

    recordSubmission(): void {
      const now = deps.now();
      const valid = pruneExpired(loadTimestamps(), now);
      valid.push(now);
      saveTimestamps(valid);
    },
  };
}
