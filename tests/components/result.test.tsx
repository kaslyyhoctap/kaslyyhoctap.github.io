/**
 * tests/components/result.test.tsx — B10 / B19 / duplicate-button regressions.
 *
 * - B10: ResultView with total=0 must render "0%" — never NaN%.
 * - Duplicate "Đề mới"/"Làm lại đề": only "Làm lại đề" (#rRetry) remains.
 * - B19: /result consumes `ontap12-result` read-once (removeItem on read).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

const mockReplace = vi.hoisted(() => vi.fn());
const mockPush = vi.hoisted(() => vi.fn());
// Stable object: ResultPage's effect depends on `router`, so a fresh object
// per render would re-run the effect and re-consume the (already removed) key.
const mockRouter = vi.hoisted(() => ({ push: mockPush, replace: mockReplace }));
vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

import ResultView, { type ResultData } from '@/components/result/ResultView';
import ResultPage from '@/app/result/page';

const ZERO_DATA: ResultData = {
  score: {
    point: 0,
    ok: 0,
    bad: 0,
    skip: 0,
    total: 0,
    verdict: 'Cần cố gắng',
    verdictClass: 'low',
    topics: {},
    types: {},
  },
  qs: [],
  ans: [],
  cfg: {
    subject: 'history',
    lesson: 'all',
    count: 0,
    time: 10,
    practice: false,
    shQ: true,
    shA: true,
  },
  passages: {},
  elapsedSecs: 5,
  timeout: false,
};

beforeEach(() => {
  mockReplace.mockReset();
  mockPush.mockReset();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('ResultView (B10)', () => {
  it('renders 0% — never NaN% — when total is 0', () => {
    render(<ResultView {...ZERO_DATA} />);
    const frac = document.getElementById('rFrac')?.textContent ?? '';
    expect(frac).toContain('0/0');
    expect(frac).toContain('0%');
    expect(frac).not.toContain('NaN');
    expect(document.body.textContent).not.toContain('NaN');
  });

  it('keeps "Làm lại đề" and drops the duplicate "Đề mới"', () => {
    render(<ResultView {...ZERO_DATA} />);
    expect(document.getElementById('rRetry')?.textContent).toContain('Làm lại đề');
    expect(document.getElementById('rNew')).toBeNull();
    expect(screen.queryByText('Đề mới')).toBeNull();
  });
});

describe('ResultPage (B19)', () => {
  it('removes ontap12-result on consume (read-once, no stale replay)', async () => {
    sessionStorage.setItem('ontap12-result', JSON.stringify(ZERO_DATA));
    render(<ResultPage />);
    await waitFor(() =>
      expect(document.getElementById('rFrac')?.textContent).toContain('0/0'),
    );
    expect(sessionStorage.getItem('ontap12-result')).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('redirects home when no result is stored', async () => {
    render(<ResultPage />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });
});
