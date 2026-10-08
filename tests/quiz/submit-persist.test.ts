/**
 * submit() persistence — regression test for "bài làm không lưu local".
 * Legacy app.js submit() wrote answered + hist + exams + best + correct +
 * per-lesson prog; the React port initially wrote only `answered`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQuiz } from '@/lib/hooks/useQuiz';
import type { ExamConfig } from '@/lib/quiz/pool';
import { MCQ_5 } from './fixtures';

const KEY = 'ontap12-v1';

const cfg: ExamConfig = {
  subject: 'history',
  lesson: 1,
  count: 5,
  time: 10,
  practice: false,
  shQ: false,
  shA: false,
};

function stored() {
  return JSON.parse(localStorage.getItem(KEY) || '{}');
}

beforeEach(() => {
  localStorage.clear();
});

describe('useQuiz submit persistence', () => {
  it('writes answered, hist, exams, best, correct and prog on submit', () => {
    const { result } = renderHook(() => useQuiz(cfg));

    act(() => {
      result.current.start(MCQ_5);
    });
    expect(result.current.qs).toHaveLength(5);

    // 3 correct (idx 0) + 2 wrong (idx 1). correctAnswer = 0 for all MCQ_5.
    act(() => {
      result.current.answer(0);
    });
    act(() => {
      result.current.next();
    });
    act(() => {
      result.current.answer(0);
    });
    act(() => {
      result.current.next();
    });
    act(() => {
      result.current.answer(1);
    });
    act(() => {
      result.current.next();
    });
    act(() => {
      result.current.answer(1);
    });
    act(() => {
      result.current.next();
    });
    act(() => {
      result.current.answer(0);
    });

    let sc!: ReturnType<typeof result.current.submit>;
    act(() => {
      sc = result.current.submit();
    });
    expect(sc.point).toBe(6);
    expect(sc.ok).toBe(3);

    const s = stored();
    expect(s.answered['mc5-1']).toBe('ok');
    expect(s.answered['mc5-3']).toBe('bad');
    expect(s.hist).toHaveLength(1);
    expect(s.hist[0]).toMatchObject({
      sub: 'history',
      lesson: 1,
      point: 6,
      ok: 3,
      tot: 5,
    });
    expect(s.hist[0].ids).toHaveLength(5);
    expect(s.exams).toBe(1);
    expect(s.best).toBe(6);
    expect(s.correct).toBe(3);
    // 3/5 correct in lesson 1 → 60%.
    expect(s.prog.history[1]).toBe(60);
  });

  it('persists exactly once on double submit (manual + timeout path)', () => {
    const { result } = renderHook(() => useQuiz(cfg));

    act(() => {
      result.current.start(MCQ_5);
    });
    act(() => {
      result.current.submit();
    });
    act(() => {
      result.current.submit();
    });

    const s = stored();
    expect(s.hist).toHaveLength(1);
    expect(s.exams).toBe(1);
  });
});
