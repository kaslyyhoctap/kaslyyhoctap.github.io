/**
 * tests/components/progress-view.test.ts — N7 regression, final form:
 * /progress denominators count the quiz-attainable set.
 *
 * The SA port (2026-10-10) made short_answer rows quiz-eligible, so the
 * attainable set is the FULL bank and every row counts — matching useQuiz's
 * submit-side per-lesson prog, which has always divided by the full bank.
 * (The earlier N7 fix excluded SA rows because pool() dropped them; that
 * exclusion went stale the day the SA input UI landed.)
 */
import { describe, it, expect } from 'vitest';
import { buildProgressCounts } from '@/components/progress/ProgressView';
import type { Question } from '@/lib/types';

function q(id: string, type?: string): Question {
  return {
    id,
    subject: 'history',
    lesson: 1,
    type,
    question: `Câu ${id}`,
    options: type === 'short_answer' ? null : ['A', 'B', 'C', 'D'],
    correctAnswer: type === 'short_answer' ? null : 0,
    explanation: 'x',
  } as Question;
}

describe('buildProgressCounts (N7)', () => {
  it('counts short_answer rows in denominators — SA is quiz-eligible now', () => {
    const bank = [
      q('mc1', 'multiple_choice'),
      q('mc2', 'multiple_choice'),
      q('sa1', 'short_answer'),
      q('sa2', 'short_answer'),
      q('sa3', 'short_answer'),
    ];
    const { qCount, qGood } = buildProgressCounts(bank, {
      mc1: 'ok',
      mc2: 'ok',
      sa1: 'ok',
      sa2: 'ok',
      sa3: 'ok',
    });
    // All 5 rows are attainable — a perfect user sees 5/5.
    expect(qCount.history[1]).toBe(5);
    expect(qGood.history[1]).toBe(5);
  });

  it('a lesson with only short_answer rows counts those rows', () => {
    const bank = [q('sa1', 'short_answer')];
    const { qCount, qGood } = buildProgressCounts(bank, { sa1: 'ok' });
    expect(qCount.history[1]).toBe(1);
    expect(qGood.history[1]).toBe(1); // answering SA moves progress now
  });

  it('unanswered SA rows still only inflate the denominator (0/N shown)', () => {
    const bank = [q('sa1', 'short_answer'), q('sa2', 'short_answer')];
    const { qCount, qGood } = buildProgressCounts(bank, {});
    expect(qCount.history[1]).toBe(2);
    // qGood has NO entry for (history,1): zero `ok` answers leave it
    // untouched, and callers render it as 0 via `?? 0`.
    expect(qGood.history?.[1] ?? 0).toBe(0);
    expect(qGood.history).toBeUndefined();
  });
});
