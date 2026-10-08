import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mock db (same pattern as tests/db/queries.test.ts) ──────────────
const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
}));
vi.mock('@/db', () => ({ db: mockDb }));

// ── Mock auth: default to anonymous (null) ──────────────────────────
const mockGetCurrentUser = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth-utils', () => ({ getCurrentUser: mockGetCurrentUser }));

import type { Question } from '@/lib/types';
import type { RuntimeQuestion } from '@/lib/quiz/scoring';
import { POST as submitPOST } from '@/app/api/exam/submit/route';
import { POST as startPOST } from '@/app/api/exam/start/route';
import { GET as questionsGET } from '@/app/api/questions/route';

// ── Fixture: 3 easy MCQ questions (correctAnswer = 0) ──────────────
function makeQuestion(id: string): Question {
  return {
    id,
    subject: 'history',
    lesson: 1,
    type: 'multiple_choice',
    topic: 'Chính sách',
    difficulty: 'Nhận biểt',
    question: `Câu ${id}`,
    options: ['Đúng', 'Sai 1', 'Sai 2', 'Sai 3'],
    correctAnswer: 0,
    explanation: 'Giải thích',
    passageId: null,
  };
}

function makeRuntime(q: Question): RuntimeQuestion {
  // opts in original order (shA=false → deterministic)
  return {
    ...q,
    opts: (q.options || []).map((t, i) => ({ t, ok: i === q.correctAnswer })),
    tf: [],
  };
}

// chainable mock builder
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

describe('POST /api/exam/start', () => {
  beforeEach(() => {
    mockDb.select.mockReset();
    mockGetCurrentUser.mockReturnValue(null);
  });

  it('returns pooled questions for the subject (anonymous)', async () => {
    const qs = [makeQuestion('h1'), makeQuestion('h2'), makeQuestion('h3')];
    mockDb.select.mockReturnValue(chainable(qs));

    const req = new NextRequest('http://localhost/api/exam/start', {
      method: 'POST',
      body: JSON.stringify({ subject: 'history', lesson: 1, count: 2, time: 10 }),
    });

    const res = await startPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.questions).toHaveLength(2);
    expect(data.examId).toBeUndefined();
    expect(data.questions.every((q: Question) => q.subject === 'history')).toBe(true);
  });

  it('returns 400 when subject is missing', async () => {
    const req = new NextRequest('http://localhost/api/exam/start', {
      method: 'POST',
      body: JSON.stringify({ lesson: 1, count: 10 }),
    });

    const res = await startPOST(req);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/exam/submit', () => {
  beforeEach(() => {
    mockDb.select.mockReset();
    mockDb.insert.mockReset();
    mockGetCurrentUser.mockReturnValue(null); // anonymous by default
  });

  it('scores MCQ: 3 correct 1 wrong → point 7.5, wrongIds has 1 entry', async () => {
    const q1 = makeRuntime(makeQuestion('h1'));
    const q2 = makeRuntime(makeQuestion('h2'));
    const q3 = makeRuntime(makeQuestion('h3'));
    const q4 = makeRuntime(makeQuestion('h4'));

    const questions = [q1, q2, q3, q4];
    // First 3 correct (ans=0), 4th wrong (ans=1)
    const answers = [0, 0, 0, 1];

    const req = new NextRequest('http://localhost/api/exam/submit', {
      method: 'POST',
      body: JSON.stringify({
        answers,
        flags: [false, false, false, false],
        timeSec: 300,
        cfg: { subject: 'history', lesson: 1, count: 4, time: 10, practice: false },
        questions,
      }),
    });

    const res = await submitPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(3);
    expect(data.bad).toBe(1);
    expect(data.skip).toBe(0);
    expect(data.total).toBe(4);
    expect(data.point).toBe(7.5); // 3/4 * 100 / 10 = 7.5
    expect(data.wrongIds).toEqual(['h4']);
  });

  it('scores with skipped questions (ans -1)', async () => {
    const qs = [makeRuntime(makeQuestion('h1')), makeRuntime(makeQuestion('h2'))];
    const answers = [0, -1]; // 1 correct, 1 skip

    const req = new NextRequest('http://localhost/api/exam/submit', {
      method: 'POST',
      body: JSON.stringify({
        answers,
        flags: [false, false],
        timeSec: 120,
        cfg: { subject: 'history', lesson: 1, count: 2, time: 10, practice: false },
        questions: qs,
      }),
    });

    const res = await submitPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(1);
    expect(data.bad).toBe(0);
    expect(data.skip).toBe(1);
    expect(data.total).toBe(2);
    expect(data.point).toBe(5.0); // 1/2 * 100 / 10 = 5.0
    expect(data.wrongIds).toEqual([]);
  });

  it('returns 400 when questions array is empty', async () => {
    const req = new NextRequest('http://localhost/api/exam/submit', {
      method: 'POST',
      body: JSON.stringify({
        answers: [],
        flags: [],
        timeSec: 0,
        cfg: { subject: 'history', lesson: 1, count: 0, time: 10, practice: false },
        questions: [],
      }),
    });

    const res = await submitPOST(req);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/questions', () => {
  beforeEach(() => {
    mockDb.select.mockReset();
  });

  it('returns paginated questions with total count', async () => {
    const qs = [makeQuestion('h1'), makeQuestion('h2')];
    // countQuestions uses select too
    mockDb.select.mockReturnValueOnce(chainable(qs)); // getQuestions
    mockDb.select.mockReturnValueOnce(chainable([{ count: 2 }])); // countQuestions

    const req = new NextRequest(
      'http://localhost/api/questions?subject=history&limit=2&offset=0',
    );

    const res = await questionsGET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.questions).toHaveLength(2);
    expect(data.total).toBe(2);
  });
});
