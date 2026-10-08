/**
 * Offline bank cache — FB/TikTok style prefetch + offline fallback.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  readBankCache,
  refreshBankCache,
  queryBankCache,
  type BankCache,
} from '@/lib/offline';
import { MCQ_5 } from './fixtures';

beforeEach(() => {
  localStorage.clear();
});

describe('readBankCache', () => {
  it('returns null when never cached', () => {
    expect(readBankCache()).toBeNull();
  });
});

describe('refreshBankCache', () => {
  it('pages through the API and stores the full bank', async () => {
    const page1 = MCQ_5.slice(0, 3);
    const page2 = MCQ_5.slice(3);
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ questions: page1, total: 5 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ questions: page2, total: 5 }),
      });
    const ok = await refreshBankCache(fetchFn as any);
    expect(ok).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    const cached = readBankCache();
    expect(cached?.questions).toHaveLength(5);
  });

  it('throws when the API is unreachable (offline first visit)', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(refreshBankCache(fetchFn as any)).rejects.toThrow();
    expect(readBankCache()).toBeNull();
  });
});

describe('queryBankCache', () => {
  const cache: BankCache = {
    questions: MCQ_5,
    passages: {},
    savedAt: Date.now(),
  };
  it('filters by subject + lesson', () => {
    expect(
      queryBankCache(cache, { subject: 'history', lesson: 1 }),
    ).toHaveLength(5);
    expect(
      queryBankCache(cache, { subject: 'chemistry', lesson: 1 }),
    ).toHaveLength(0);
  });
  it('lesson all returns the whole subject', () => {
    expect(
      queryBankCache(cache, { subject: 'history', lesson: 'all' }),
    ).toHaveLength(5);
  });
});
