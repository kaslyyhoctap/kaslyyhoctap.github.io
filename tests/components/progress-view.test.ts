/**
 * tests/components/progress-view.test.ts — N7 regression: /progress
 * denominators count pool-eligible questions only.
 *
 * pool() drops every short_answer row, so a fixture bank containing SA rows
 * must yield denominators equal to the non-SA totals only.
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
  it('excludes short_answer rows from denominators', () => {
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
    // 2 eligible of 5 — a perfect user sees 2/2, not 2/5 or 5/5.
    expect(qCount.history[1]).toBe(2);
    expect(qGood.history[1]).toBe(2);
  });

  it('a lesson with only short_answer rows yields zero, not the SA count', () => {
    const bank = [q('sa1', 'short_answer')];
    const { qCount } = buildProgressCounts(bank, { sa1: 'ok' });
    expect(qCount.history?.[1] ?? 0).toBe(0);
  });
});
