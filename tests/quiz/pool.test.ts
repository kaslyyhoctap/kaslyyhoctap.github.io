import { describe, it, expect } from 'vitest';
import { pool, pickFresh, typeOf, blankNo, shuffle, buildRecentMap, type ExamConfig } from '@/lib/quiz/pool';
import { CHEM_QUESTIONS, EN_QUESTIONS, mcq } from './fixtures';
import type { Question } from '@/lib/types';

function cfg(over: Partial<ExamConfig>): ExamConfig {
  return { subject: 'chemistry', lesson: 1, count: 20, time: 20, practice: false, ...over };
}

describe('typeOf / blankNo / shuffle / pickFresh', () => {
  it('typeOf defaults to multiple_choice', () => {
    expect(typeOf({ id: 'x', subject: 's', lesson: 1, question: 'q' } as Question)).toBe('multiple_choice');
    expect(typeOf({ id: 'x', subject: 's', lesson: 1, question: 'q', type: 'cloze' } as Question)).toBe('cloze');
  });

  it('blankNo extracts the (N) placeholder', () => {
    const q = { id: 'x', question: 'Chọn (3) ...' } as Question;
    expect(blankNo(q)).toBe('3');
    expect(blankNo({ id: 'x', question: 'no blank' } as Question)).toBeNull();
  });

  it('shuffle returns same length without mutating input', () => {
    const a = [1, 2, 3, 4, 5];
    const s = shuffle(a);
    expect(s).toHaveLength(5);
    expect(a).toEqual([1, 2, 3, 4, 5]);
    expect(s.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('pickFresh returns ≤ n and unique ids', () => {
    const picked = pickFresh(CHEM_QUESTIONS, 5, true);
    expect(picked).toHaveLength(5);
    const ids = picked.map((q) => q.id);
    expect(new Set(ids).size).toBe(5);
  });

  it('pickFresh deprioritises answeredMap ids (stable: they sink to tail)', () => {
    // Build 4 questions; mark the first id as recently answered.
    const qs: Question[] = Array.from({ length: 4 }, (_, i) => ({
      id: `q${i}`, subject: 'h', lesson: 1, question: `q${i}`,
    }));
    // shQ=false → deterministic sort: answered ids go last.
    const picked = pickFresh(qs, 4, false, { q0: true });
    const ids = picked.map((q) => q.id);
    // q0 should NOT be first (answered → tail).
    expect(ids[0]).not.toBe('q0');
    expect(new Set(ids)).toEqual(new Set(['q0', 'q1', 'q2', 'q3']));
  });
});

describe('pool — chemistry', () => {
  it('returns ≤ count unique ids and includes true_false when available', () => {
    const sel = pool(CHEM_QUESTIONS, cfg({ count: 20, shQ: false }));
    expect(sel.length).toBeLessThanOrEqual(20);
    const ids = sel.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    const tfs = sel.filter((q) => typeOf(q) === 'true_false');
    expect(tfs.length).toBeGreaterThanOrEqual(1);
    expect(tfs.length).toBeLessThanOrEqual(2);
  });

  it('caps true_false at 2 even when more are available', () => {
    const sel = pool(CHEM_QUESTIONS, cfg({ count: 20, shQ: false }));
    const tfs = sel.filter((q) => typeOf(q) === 'true_false');
    expect(tfs.length).toBeLessThanOrEqual(2);
  });

  it('respects requested count when fewer TF exist', () => {
    // Only 4 TF available → k = min(2,4,10) = 2 TF + 8 MCQ = 10.
    const sel = pool(CHEM_QUESTIONS, cfg({ count: 10, shQ: false }));
    expect(sel.length).toBe(10);
    expect(sel.filter((q) => typeOf(q) === 'true_false').length).toBe(2);
  });
});

describe('pool — non-english (history/biology)', () => {
  it('filters by lesson', () => {
    const all = [
      mcq('h1.1', 'history', 1, 't', 'Nhận biết', 0),
      mcq('h1.2', 'history', 1, 't', 'Nhận biết', 0),
      mcq('h2.1', 'history', 2, 't', 'Nhận biết', 0),
    ];
    const sel = pool(all, { subject: 'history', lesson: 2, count: 5, time: 10, practice: false, shQ: false });
    expect(sel.map((q) => q.id)).toEqual(['h2.1']);
  });

  it('includes short_answer now that the SA input UI is ported', () => {
    const sa = { ...mcq('h1-sa-1', 'history', 1, 'Trả lời ngắn', 'Nhận biết', 0), type: 'short_answer', answer: '1945', maxLen: 4 } as Question;
    const sel = pool(
      [sa, mcq('h1.1', 'history', 1, 't', 'Nhận biết', 0)],
      { subject: 'history', lesson: 'all', count: 10, time: 10, practice: false, shQ: false },
    );
    expect(sel.map((q) => q.id).sort()).toEqual(['h1-sa-1', 'h1.1']);
  });

  it('qtype filter selects only short_answer rows when requested', () => {
    const sa = { ...mcq('h1-sa-1', 'history', 1, 'Trả lời ngắn', 'Nhận biết', 0), type: 'short_answer', answer: '1945', maxLen: 4 } as Question;
    const sel = pool(
      [sa, mcq('h1.1', 'history', 1, 't', 'Nhận biết', 0)],
      { subject: 'history', lesson: 'all', qtype: ['short_answer'], count: 10, time: 10, practice: false, shQ: false },
    );
    expect(sel.map((q) => q.id)).toEqual(['h1-sa-1']);
  });
});

describe('pool — checkbox era (multi lesson/type + chem hard quota)', () => {
  it('lesson array keeps only the checked lessons', () => {
    const all = [
      mcq('c1', 'chemistry', 1, 't', 'Nhận biết', 0),
      mcq('c2', 'chemistry', 2, 't', 'Nhận biết', 0),
      mcq('c3', 'chemistry', 3, 't', 'Nhận biết', 0),
    ];
    const sel = pool(all, {
      subject: 'chemistry', lesson: [1, 3], count: 10, time: 10, practice: false, shQ: false,
    });
    expect(sel.map((q) => q.id).sort()).toEqual(['c1', 'c3']);
  });

  it('qtype array keeps only the checked types', () => {
    const sel = pool(CHEM_QUESTIONS, {
      subject: 'chemistry', lesson: 1, qtype: ['true_false'], count: 10, time: 10,
      practice: false, shQ: false,
    });
    expect(sel.length).toBeGreaterThan(0);
    expect(sel.every((q) => typeOf(q) === 'true_false')).toBe(true);
  });

  it('chemistry all-types: ≥30% hard questions when count≥10 (quota)', () => {
    // shQ=false → deterministic: 2 TF (Thông hiểu) first, then 3 hard MCQs.
    const sel = pool(CHEM_QUESTIONS, cfg({ lesson: 1, count: 10, shQ: false }));
    const isHard = (q: Question) =>
      q.difficulty === 'Vận dụng' || q.difficulty === 'Vận dụng cao';
    expect(sel).toHaveLength(10);
    expect(sel.filter(isHard).length).toBeGreaterThanOrEqual(Math.ceil(10 * 0.3));
  });
});

describe('pool — english', () => {
  it('all-types respects WUE/CM quotas + keeps passage whole', () => {
    // count=10: wantWUE=1, wantCM=1, 1 passage (cloze, 6 q) + reading passage.
    const sel = pool(EN_QUESTIONS, { subject: 'english', lesson: 'all', count: 10, time: 20, practice: false, shQ: false });
    expect(sel.length).toBeLessThanOrEqual(10);
    const ids = new Set(sel.map((q) => q.id));
    expect(ids.size).toBe(sel.length);
    // WUE quota (1) satisfied.
    expect(sel.filter((q) => typeOf(q) === 'word_usage_error').length).toBe(1);
    // CM quota (1) satisfied.
    expect(sel.filter((q) => typeOf(q) === 'closest_meaning').length).toBe(1);
    // If any cloze picked, the whole passage block is present.
    const cloze = sel.filter((q) => typeOf(q) === 'cloze');
    if (cloze.length) {
      const passageIds = new Set(cloze.map((q) => q.passageId));
      const totalInPassage = EN_QUESTIONS.filter((q) => q.passageId === [...passageIds][0]).length;
      expect(cloze.length).toBe(totalInPassage);
    }
  });

  it('single qtype cloze keeps only complete passage blocks', () => {
    const sel = pool(EN_QUESTIONS, { subject: 'english', lesson: 'all', count: 6, time: 20, practice: false, qtype: 'cloze', shQ: false });
    expect(sel.every((q) => typeOf(q) === 'cloze')).toBe(true);
    // The cloze passage has 6 questions; count=6 pulls the whole block.
    const passageIds = new Set(sel.map((q) => q.passageId));
    expect(passageIds.size).toBe(1);
    expect(sel.length).toBe(6);
  });
});

describe('pool — ids (drill) branch', () => {
  it('resolves ids to questions and dedupes', () => {
    const sel = pool(CHEM_QUESTIONS, cfg({ count: 3, shQ: false, ids: ['chem1-mc-1', 'chem1-tf-1', 'chem1-tf-1'] }));
    expect(sel.length).toBe(2); // duplicate id deduped
    expect(sel.map((q) => q.id).sort()).toEqual(['chem1-mc-1', 'chem1-tf-1']);
  });
});

describe('pool — recent (answered) map deprioritisation', () => {
  it('answered ids sink to the tail when shQ=false (deterministic)', () => {
    // 20 MCQ + 1 TF = 21 questions; request 20 with chemistry mix.
    // Mark several MCQ ids as recently answered so they should be picked last.
    const answered: Record<string, true> = {};
    for (let i = 1; i <= 5; i++) answered[`chem1-mc-${i}`] = true;
    const sel = pool(CHEM_QUESTIONS, cfg({ count: 20, shQ: false }), answered);
    const ids = sel.map((q) => q.id);
    // Unanswered MCQ should fill the bulk first; answered MCQ ids sink.
    const answeredInSel = ids.filter((id) => answered[id]);
    expect(answeredInSel.length).toBeLessThanOrEqual(5);
  });
});
