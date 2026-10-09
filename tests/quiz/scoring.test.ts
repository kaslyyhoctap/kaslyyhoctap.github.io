import { describe, it, expect } from 'vitest';
import { scoreExam, verdict, mapToRuntime, questionStatus, normSA, saOk, serverRuntime } from '@/lib/quiz/scoring';
import type { ExamConfig } from '@/lib/quiz/pool';
import { MCQ_5 } from './fixtures';
import type { Question, Statement } from '@/lib/types';

function saQ(id: string, answer: string, maxLen = 10): Question {
  return {
    id,
    subject: 'history',
    lesson: 1,
    type: 'short_answer',
    topic: 'Trả lời ngắn',
    difficulty: 'Nhận biết',
    question: `Điền ${id}`,
    options: null,
    correctAnswer: null,
    answer,
    maxLen,
    explanation: 'Giải thích',
    passageId: null,
  } as Question;
}

const cfg = (over: Partial<ExamConfig> = {}): ExamConfig =>
  ({ subject: 'history', lesson: 1, count: 5, time: 10, practice: false, shQ: true, shA: true, ...over } as ExamConfig);

describe('verdict', () => {
  it('maps point thresholds to Vietnamese labels (app.js line 238)', () => {
    expect(verdict(0)).toEqual(['Cần cố gắng', 'low']);
    expect(verdict(4.5)).toEqual(['Cần cố gắng', 'low']);
    expect(verdict(4.9)).toEqual(['Cần cố gắng', 'low']);
    expect(verdict(5)).toEqual(['Đạt', 'mid']);
    expect(verdict(6.0)).toEqual(['Đạt', 'mid']);
    expect(verdict(6.4)).toEqual(['Đạt', 'mid']);
    expect(verdict(6.5)).toEqual(['Khá', 'mid']);
    expect(verdict(7.9)).toEqual(['Khá', 'mid']);
    expect(verdict(8)).toEqual(['Tốt', 'good']);
    expect(verdict(8.9)).toEqual(['Tốt', 'good']);
    expect(verdict(9)).toEqual(['Xuất sắc', 'good']);
    expect(verdict(9.5)).toEqual(['Xuất sắc', 'good']);
    expect(verdict(10)).toEqual(['Xuất sắc', 'good']);
  });
});

describe('scoreExam — MCQ', () => {
  it('3 correct / 2 wrong → ok:3, bad:2, point:6.0', () => {
    const runtime = mapToRuntime(MCQ_5, false); // shA=false → opts in original order
    const ans = [0, 0, 0, 1, 1]; // first 3 correct (correctAnswer=0), last 2 wrong
    const score = scoreExam(runtime, ans, cfg());
    expect(score).toMatchObject({ ok: 3, bad: 2, skip: 0, total: 5, point: 6.0 });
    expect(score.verdict).toBe('Đạt');
    expect(score.verdictClass).toBe('mid');
  });

  it('skips unanswered (ans -1)', () => {
    const runtime = mapToRuntime(MCQ_5, false);
    const ans = [0, 0, -1, 1, -1]; // 2 ok, 1 bad, 2 skip
    const score = scoreExam(runtime, ans, cfg());
    expect(score).toMatchObject({ ok: 2, bad: 1, skip: 2, total: 5, point: 4.0 });
    expect(score.verdict).toBe('Cần cố gắng');
  });

  it('all correct → point 10 → Xuất sắc', () => {
    const runtime = mapToRuntime(MCQ_5, false);
    const ans = [0, 0, 0, 0, 0];
    const score = scoreExam(runtime, ans, cfg());
    expect(score).toMatchObject({ ok: 5, bad: 0, skip: 0, point: 10.0 });
    expect(score.verdict).toBe('Xuất sắc');
  });
});

describe('scoreExam — true/false', () => {
  it('4/4 correct = 1pt', () => {
    const q = {
      id: 'tf1', subject: 'chemistry', lesson: 1, question: 'TF', type: 'true_false',
      topic: 'T', difficulty: 'Thông hiểu', options: null, correctAnswer: null,
      explanation: 'e', statements: [
        { t: 'a', ok: true },
        { t: 'b', ok: false },
        { t: 'c', ok: true },
        { t: 'd', ok: false },
      ] as Statement[],
    } as Question;
    const runtime = mapToRuntime([q], false);
    // Set answers: Đúng(1), Sai(0), Đúng(1), Sai(0) matching ok.
    runtime[0].tf = [1, 0, 1, 0];
    const score = scoreExam(runtime, [-1], cfg({ subject: 'chemistry' }));
    expect(score).toMatchObject({ ok: 1, bad: 0, skip: 0, total: 1, point: 10.0 });
  });

  it('3/4 correct = 0.5pt, 2/4 = 0.25pt, 1/4 = 0pt (app.js line 244)', () => {
    const stmts = [{ t: 'a', ok: true }, { t: 'b', ok: true }, { t: 'c', ok: true }, { t: 'd', ok: true }] as Statement[];
    const tfQ = (tf: number[]): Question => ({
      id: 'tf', subject: 'chemistry', lesson: 1, question: 'TF', type: 'true_false',
      topic: 'T', difficulty: 'x', options: null, correctAnswer: null,
      explanation: 'e', statements: stmts,
    } as Question);

    // 3/4 correct → gd=3 → bad (not all 4), fr=0.5 → point 5.0 → Đạt.
    const r3 = mapToRuntime([tfQ([1, 1, 1, 0])], false); r3[0].tf = [1, 1, 1, 0];
    const s3 = scoreExam(r3, [-1], { ...cfg(), subject: 'chemistry', count: 1 } as ExamConfig);
    expect(s3).toMatchObject({ ok: 0, bad: 1, skip: 0, total: 1, point: 5.0 });
    expect(s3.verdict).toBe('Đạt');

    // 2/4 correct → gd=2 → fr=0.25 → point 2.5 → Cần cố gắng.
    const r2 = mapToRuntime([tfQ([1, 1, 0, 0])], false); r2[0].tf = [1, 1, 0, 0];
    const s2 = scoreExam(r2, [-1], { ...cfg(), subject: 'chemistry', count: 1 } as ExamConfig);
    expect(s2).toMatchObject({ ok: 0, bad: 1, point: 2.5 });
    expect(s2.verdict).toBe('Cần cố gắng');

    // 1/4 correct → gd=1 → fr=0 → point 0 → Cần cố gắng.
    const r1 = mapToRuntime([tfQ([1, 0, 0, 0])], false); r1[0].tf = [1, 0, 0, 0];
    const s1 = scoreExam(r1, [-1], { ...cfg(), subject: 'chemistry', count: 1 } as ExamConfig);
    expect(s1).toMatchObject({ ok: 0, bad: 1, point: 0.0 });
  });

  it('skips unattempted TF (all tf slots -1)', () => {
    const q = {
      id: 'tf2', subject: 'chemistry', lesson: 1, question: 'TF', type: 'true_false',
      topic: 'T', difficulty: 'x', options: null, correctAnswer: null,
      explanation: 'e', statements: [
        { t: 'a', ok: true }, { t: 'b', ok: true }, { t: 'c', ok: true }, { t: 'd', ok: true },
      ] as Statement[],
    } as Question;
    const runtime = mapToRuntime([q], false);
    const score = scoreExam(runtime, [-1], cfg({ subject: 'chemistry', count: 1, time: 10 } as any));
    expect(score).toMatchObject({ ok: 0, bad: 0, skip: 1, total: 1, point: 0.0 });
  });
});

describe('scoreExam — topics/types breakdown', () => {
  it('populates topics for every subject and types for english', () => {
    const enCfg: ExamConfig = { ...cfg(), subject: 'english', count: 5, lesson: 'all' } as ExamConfig;
    const runtime = mapToRuntime(MCQ_5, false);
    // MCQ_5 has topic 'Chính sách'.
    const score = scoreExam(runtime, [0, 0, 0, 1, 1], enCfg);
    expect(score.topics['Chính sách']).toMatchObject({ tot: 5, ok: 3 });
    // English → types breakdown populated.
    expect(score.types['multiple_choice']).toMatchObject({ tot: 5, ok: 3 });
  });

  it('does NOT populate types for non-english', () => {
    const runtime = mapToRuntime(MCQ_5, false);
    const score = scoreExam(runtime, [0, 0, 0, 1, 1], cfg());
    expect(score.types).toEqual({});
  });
});

describe('questionStatus (review list helper)', () => {
  it('returns ok/bad/skip for MCQ', () => {
    const runtime = mapToRuntime(MCQ_5, false);
    expect(questionStatus(MCQ_5[0], runtime[0], 0)).toBe('ok');
    expect(questionStatus(MCQ_5[0], runtime[0], 1)).toBe('bad');
    expect(questionStatus(MCQ_5[0], runtime[0], -1)).toBe('skip');
  });
});

describe('scoreExam — short_answer', () => {
  it('exact match → ok/1pt', () => {
    const runtime = mapToRuntime([saQ('sa1', '1945', 4)], false);
    runtime[0].sa = '1945';
    const score = scoreExam(runtime, [-1], cfg({ count: 1 }));
    expect(score).toMatchObject({ ok: 1, bad: 0, skip: 0, total: 1, point: 10.0 });
  });

  it('case- and accent-insensitive match → ok', () => {
    const r1 = mapToRuntime([saQ('sa1', 'Hà Nội')], false);
    r1[0].sa = 'HÀ NỘI';
    expect(scoreExam(r1, [-1], cfg({ count: 1 }))).toMatchObject({ ok: 1, point: 10.0 });

    const r2 = mapToRuntime([saQ('sa2', 'Hồ Chí Minh')], false);
    r2[0].sa = 'ho chi minh';
    expect(scoreExam(r2, [-1], cfg({ count: 1 }))).toMatchObject({ ok: 1, point: 10.0 });
  });

  it('wrong string → bad/0pt (no partial credit)', () => {
    const runtime = mapToRuntime([saQ('sa1', '1945', 4)], false);
    runtime[0].sa = '1946';
    const score = scoreExam(runtime, [-1], cfg({ count: 1 }));
    expect(score).toMatchObject({ ok: 0, bad: 1, skip: 0, total: 1, point: 0.0 });
  });

  it('empty string → skip', () => {
    const runtime = mapToRuntime([saQ('sa1', '1945', 4)], false);
    const score = scoreExam(runtime, [-1], cfg({ count: 1 }));
    expect(score).toMatchObject({ ok: 0, bad: 0, skip: 1, total: 1, point: 0.0 });
  });

  it('mixed exam (MCQ + TF + SA) point-sums correctly', () => {
    const tf = {
      id: 'tf1', subject: 'history', lesson: 1, question: 'TF', type: 'true_false',
      topic: 'T', difficulty: 'Thông hiểu', options: null, correctAnswer: null,
      explanation: 'e', statements: [
        { t: 'a', ok: true },
        { t: 'b', ok: false },
        { t: 'c', ok: true },
        { t: 'd', ok: false },
      ] as Statement[],
    } as Question;
    const runtime = mapToRuntime([MCQ_5[0], tf, saQ('sa1', '1945', 4)], false);
    runtime[1].tf = [1, 0, 1, 0]; // 4/4 → 1pt
    runtime[2].sa = '1945'; // → 1pt
    // MCQ correct (correctAnswer=0) → 1pt. Total 3pts / 3 = 10.
    const score = scoreExam(runtime, [0, -1, -1], cfg({ count: 3 }));
    expect(score).toMatchObject({ ok: 3, bad: 0, skip: 0, total: 3, point: 10.0 });
  });

  it('questionStatus returns ok/bad/skip for SA', () => {
    const runtime = mapToRuntime([saQ('sa1', '1945', 4)], false);
    runtime[0].sa = '1945';
    expect(questionStatus(saQ('sa1', '1945', 4), runtime[0], -1)).toBe('ok');
    runtime[0].sa = '1946';
    expect(questionStatus(saQ('sa1', '1945', 4), runtime[0], -1)).toBe('bad');
    runtime[0].sa = '';
    expect(questionStatus(saQ('sa1', '1945', 4), runtime[0], -1)).toBe('skip');
  });

  it('serverRuntime keeps the typed string but re-derives the key from the DB', () => {
    const forged = { ...mapToRuntime([saQ('sa1', 'REAL', 4)], false)[0], answer: 'FORGED', sa: 'real' };
    const clean = serverRuntime(forged, saQ('sa1', 'REAL', 4));
    expect(clean.answer).toBe('REAL');
    expect(clean.sa).toBe('real');
    // 'real' matches the DB key 'REAL' → ok.
    expect(scoreExam([clean], [-1], cfg({ count: 1 }))).toMatchObject({ ok: 1, point: 10.0 });
    // Tagging ok by any other channel is impossible: only sa-vs-db decides.
    const wrong = serverRuntime({ ...forged, sa: 'nope' }, saQ('sa1', 'REAL', 4));
    expect(scoreExam([wrong], [-1], cfg({ count: 1 }))).toMatchObject({ ok: 0, bad: 1 });
  });
});

describe('normSA / saOk', () => {
  it('strips accents, lowercases, trims; đ→d', () => {
    expect(normSA('Hồ Chí Minh')).toBe('ho chi minh');
    expect(normSA('HÀ NỘI')).toBe('ha noi');
    expect(normSA('  Đà Nẵng ')).toBe('da nang');
    expect(normSA('E. coli')).toBe('e. coli');
  });

  it('saOk: empty never matches, even an empty key', () => {
    expect(saOk('', 'Hà Nội')).toBe(false);
    expect(saOk('', '')).toBe(false);
    expect(saOk('Hà Nội', '')).toBe(false);
    expect(saOk('1945', '1945')).toBe(true);
  });
});

describe('scoreExam — empty pool (B09)', () => {
  it('returns a 0-point score, never NaN', () => {
    const score = scoreExam([], [], cfg());
    expect(score).toMatchObject({ point: 0, ok: 0, bad: 0, skip: 0, total: 0 });
    expect(Number.isNaN(score.point)).toBe(false);
  });
});
