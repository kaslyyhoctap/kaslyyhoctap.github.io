import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock the db instance (`@/db`). `vi.hoisted` is the canonical way to share a
//    mock object between hoisted `vi.mock` factories and real imports. ─────────
const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
}));
vi.mock('@/db', () => ({ db: mockDb }));

import type { Question } from '@/lib/types';
import {
  getQuestionById,
  getSubjects,
  getWeakAreas,
  saveUserProgress,
  computeWeakAreas,
} from '@/lib/db/queries';

/**
 * Drizzle's select builder is a fluent chain whose terminal value is awaited.
 * This returns a thenable that resolves to `data`, with every chainable
 * method returning the same object so `.from().where().limit()` etc. work.
 */
function chainable(data: unknown): Record<string, any> {
  const c: Record<string, any> = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(data).then(resolve),
  };
  return c;
}

describe('getQuestionById', () => {
  beforeEach(() => {
    mockDb.select.mockReset();
  });

  it('returns the question when found', async () => {
    const q = {
      id: 'h1.1',
      subject: 'history',
      lesson: 1,
      type: 'multiple_choice',
      topic: 'Chính sách',
      difficulty: 'Nhận biết',
      question: 'Câu hỏi test',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 0,
      explanation: null,
    } as Question;

    mockDb.select.mockReturnValue(chainable([q]));
    const result = await getQuestionById('h1.1');
    expect(result).toEqual(q);
    expect(mockDb.select).toHaveBeenCalledTimes(1);
  });

  it('returns null when the id is not found', async () => {
    mockDb.select.mockReturnValue(chainable([]));
    expect(await getQuestionById('nope')).toBeNull();
  });
});

describe('getSubjects', () => {
  beforeEach(() => mockDb.select.mockReset());

  it('coerces count/lessons from raw driver values', async () => {
    mockDb.select.mockReturnValue(
      chainable([
        { subject: 'history', count: '748', lessons: [1, 2, 3] },
        { subject: 'english', count: '200', lessons: [1, 2] },
      ]),
    );
    const res = await getSubjects();
    expect(res).toEqual([
      { subject: 'history', count: 748, lessons: [1, 2, 3] },
      { subject: 'english', count: 200, lessons: [1, 2] },
    ]);
  });

  it('falls back to an empty lessons array when the driver returns a non-array', async () => {
    mockDb.select.mockReturnValue(
      chainable([{ subject: 'biology', count: '120', lessons: null }]),
    );
    const [row] = await getSubjects();
    expect(row).toEqual({ subject: 'biology', count: 120, lessons: [] });
  });
});

describe('saveUserProgress', () => {
  beforeEach(() => {
    mockDb.insert.mockReset();
    mockDb.select.mockReset();
  });

  it('upserts into user_progress via onConflictDoUpdate', async () => {
    const insertChain: Record<string, any> = {
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockReturnThis(),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(undefined).then(resolve),
    };
    mockDb.insert.mockReturnValue(insertChain);

    await saveUserProgress('user-1', 'answered', { q1: 'ok' });

    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    expect(insertChain.values).toHaveBeenCalled();
    expect(insertChain.onConflictDoUpdate).toHaveBeenCalled();
  });
});

// ── Weak-area analytics ───────────────────────────────────────────────

describe('computeWeakAreas (pure)', () => {
  // Small helper to build question stubs.
  const q = (
    id: string,
    subject: string,
    topic: string,
    difficulty?: string,
  ) => ({ id, subject, topic, difficulty: difficulty ?? null });

  it('drops groups with < 3 attempts and keeps the 3 worst by accuracy', () => {
    const qs = [
      q('g1a', 'history', 'topic1', 'NB'),
      q('g1b', 'history', 'topic1', 'NB'),
      q('g1c', 'history', 'topic1', 'NB'), // history/topic1: tot3 ok0 acc0    (worst)
      q('g2a', 'history', 'topic2', 'NB'),
      q('g2b', 'history', 'topic2', 'NB'),
      q('g2c', 'history', 'topic2', 'NB'), // history/topic2: tot3 ok1 acc.333
      q('g3a', 'biology', 'topic3', 'TH'),
      q('g3b', 'biology', 'topic3', 'TH'),
      q('g3c', 'biology', 'topic3', 'TH'),
      q('g3d', 'biology', 'topic3', 'TH'), // biology/topic3: tot4 ok4 acc1.0   (best, dropped)
      q('g4a', 'chemistry', 'topic4', 'NB'),
      q('g4b', 'chemistry', 'topic4', 'NB'),
      q('g4c', 'chemistry', 'topic4', 'NB'), // chemistry/topic4: tot3 ok2 acc.667
      q('g5a', 'english', 'topic5', 'NB'),
      q('g5b', 'english', 'topic5', 'NB'), // english/topic5: tot2 (<3) excluded
    ];
    const answered: Record<string, string> = {
      g1a: 'bad',
      g1b: 'bad',
      g1c: 'bad',
      g2a: 'ok',
      g2b: 'bad',
      g2c: 'bad',
      g3a: 'ok',
      g3b: 'ok',
      g3c: 'ok',
      g3d: 'ok',
      g4a: 'ok',
      g4b: 'ok',
      g4c: 'bad',
      g5a: 'ok',
      g5b: 'bad',
    };

    const res = computeWeakAreas(qs, answered);
    expect(res).toHaveLength(3);
    // worst first; the tot<3 group (topic5) must be gone
    expect(res.map((r) => r.topic)).toEqual(['topic1', 'topic2', 'topic4']);
    expect(res[0]).toMatchObject({ topic: 'topic1', total: 3, correct: 0, accuracy: 0 });
    expect(res[1]).toMatchObject({ topic: 'topic2', total: 3, correct: 1 });
    expect(res[1].accuracy).toBeCloseTo(1 / 3, 5);
    expect(res[2]).toMatchObject({ topic: 'topic4', total: 3, correct: 2 });
    expect(res[2].accuracy).toBeCloseTo(2 / 3, 5);
  });

  it('returns an empty list when nothing has >= 3 attempts', () => {
    const qs = [q('a', 'history', 't'), q('b', 'history', 't'), q('c', 'biology', 't')];
    const answered = { a: 'bad', b: 'bad', c: 'bad' };
    expect(computeWeakAreas(qs, answered)).toEqual([]);
  });

  it('ignores unanswered and skipped questions', () => {
    const qs = [
      q('a', 'history', 't'),
      q('b', 'history', 't'),
      q('c', 'history', 't'),
      q('d', 'history', 't'),
    ];
    // only c is "ok"; a/b are skip, d unanswered
    const answered = { a: 'skip', b: 'skip', c: 'ok' };
    const res = computeWeakAreas(qs, answered);
    expect(res).toEqual([]); // tot < 3 attempted
  });

  it('defaults difficulty to null when a question has none', () => {
    const qs = [
      { id: 'a', subject: 'history', topic: 't', difficulty: null },
      { id: 'b', subject: 'history', topic: 't', difficulty: null },
      { id: 'c', subject: 'history', topic: 't', difficulty: null },
    ];
    const answered = { a: 'bad', b: 'bad', c: 'bad' };
    const res = computeWeakAreas(qs, answered);
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ topic: 't', difficulty: null, accuracy: 0 });
  });
});

describe('getWeakAreas (db integration via mock)', () => {
  beforeEach(() => {
    mockDb.select.mockReset();
    mockDb.insert.mockReset();
  });

  it('aggregates progress + questions, returning the 3 worst areas', async () => {
    const answered = {
      q1: 'bad',
      q2: 'bad',
      q3: 'bad', // history/topicA: tot3 ok0 acc0   ← worst
      q4: 'ok',
      q5: 'ok',
      q6: 'bad', // history/topicB: tot3 ok2 acc.667
      q7: 'bad',
      q8: 'bad', // biology/topicC/diffY: tot2 excluded
      q9: 'ok',
      q10: 'ok',
      q11: 'ok', // biology/topicC/diffZ: tot3 ok3 acc1.0
    };
    const progressRows = [{ value: answered }];
    const questionRows = [
      { id: 'q1', subject: 'history', topic: 'topicA', difficulty: 'diffX' },
      { id: 'q2', subject: 'history', topic: 'topicA', difficulty: 'diffX' },
      { id: 'q3', subject: 'history', topic: 'topicA', difficulty: 'diffX' },
      { id: 'q4', subject: 'history', topic: 'topicB', difficulty: 'diffX' },
      { id: 'q5', subject: 'history', topic: 'topicB', difficulty: 'diffX' },
      { id: 'q6', subject: 'history', topic: 'topicB', difficulty: 'diffX' },
      { id: 'q7', subject: 'biology', topic: 'topicC', difficulty: 'diffY' },
      { id: 'q8', subject: 'biology', topic: 'topicC', difficulty: 'diffY' },
      { id: 'q9', subject: 'biology', topic: 'topicC', difficulty: 'diffZ' },
      { id: 'q10', subject: 'biology', topic: 'topicC', difficulty: 'diffZ' },
      { id: 'q11', subject: 'biology', topic: 'topicC', difficulty: 'diffZ' },
    ];

    // getWeakAreas issues two selects: 1) answered progress, 2) question rows.
    mockDb.select
      .mockReturnValueOnce(chainable(progressRows))
      .mockReturnValueOnce(chainable(questionRows));

    const res = await getWeakAreas('user-1');
    expect(res).toHaveLength(3);
    expect(res[0]).toMatchObject({ subject: 'history', topic: 'topicA', accuracy: 0 });
    expect(res[1]).toMatchObject({ subject: 'history', topic: 'topicB' });
    expect(res[1].accuracy).toBeCloseTo(2 / 3, 5);
    expect(res[2]).toMatchObject({ subject: 'biology', topic: 'topicC', difficulty: 'diffZ', accuracy: 1 });
  });

  it('returns an empty list when the user has no answered map', async () => {
    mockDb.select.mockReturnValueOnce(chainable([{ value: {} }]));
    expect(await getWeakAreas('anon')).toEqual([]);
  });
});
