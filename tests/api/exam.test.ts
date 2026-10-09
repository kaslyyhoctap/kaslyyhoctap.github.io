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
    sa: '',
  };
}

function makeSA(id: string, answer: string, maxLen = 10): Question {
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

function makeSARuntime(q: Question, sa: string): RuntimeQuestion {
  return { ...q, opts: [], tf: [], sa };
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

  /**
   * The route re-derives correctness from the DB, so every submit test must
   * supply the authoritative `questions` rows (previously the client's own
   * runtime objects were trusted, which is the bug being fixed).
   */
  function mockDbRows(rows: Question[]) {
    mockDb.select.mockReturnValueOnce(chainable(rows));
  }

  function mockInsert() {
    const values = vi.fn().mockReturnValue({
      onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
    });
    mockDb.insert.mockReturnValue({ values });
    return values;
  }

  it('scores MCQ: 3 correct 1 wrong → point 7.5, wrongIds has 1 entry', async () => {
    const base = [makeQuestion('h1'), makeQuestion('h2'), makeQuestion('h3'), makeQuestion('h4')];
    const questions = base.map(makeRuntime);
    mockDbRows(base);
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

  it('scores against the client\'s shuffled option order, not the DB order', async () => {
    const q = makeQuestion('h1'); // correctAnswer 0 → 'Đúng'
    mockDbRows([q]);
    // Client shuffled opts: 'Đúng' now sits at index 2 (matching answer 2).
    const questions = [
      {
        ...q,
        opts: [
          { t: 'Sai 3', ok: false },
          { t: 'Sai 1', ok: false },
          { t: 'Đúng', ok: false },
          { t: 'Sai 2', ok: false },
        ],
        tf: [],
        sa: '',
      } as RuntimeQuestion,
    ];

    const req = new NextRequest('http://localhost/api/exam/submit', {
      method: 'POST',
      body: JSON.stringify({
        answers: [2],
        flags: [false],
        timeSec: 60,
        cfg: { subject: 'history', lesson: 1, count: 1, time: 10, practice: false },
        questions,
      }),
    });

    const res = await submitPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(1);
    expect(data.point).toBe(10);
  });

  it('ignores forged opts ok flags: wrong answers cannot score (B02)', async () => {
    const base = [makeQuestion('h1'), makeQuestion('h2'), makeQuestion('h3'), makeQuestion('h4')];
    mockDbRows(base);
    // Forged runtime: every option claims to be correct, correctAnswer is junk.
    const forged: RuntimeQuestion[] = base.map((q) => ({
      ...q,
      correctAnswer: 99,
      opts: ['Đúng', 'Sai 1', 'Sai 2', 'Sai 3'].map((t) => ({ t, ok: true })),
      tf: [],
      sa: '',
    }));
    // Answers all point at index 1 → 'Sai 1' → wrong per the DB row.
    const answers = [1, 1, 1, 1];

    const req = new NextRequest('http://localhost/api/exam/submit', {
      method: 'POST',
      body: JSON.stringify({
        answers,
        flags: [false, false, false, false],
        timeSec: 300,
        cfg: { subject: 'history', lesson: 1, count: 4, time: 10, practice: false },
        questions: forged,
      }),
    });

    const res = await submitPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(0);
    expect(data.bad).toBe(4);
    expect(data.point).toBe(0);
    expect(data.wrongIds).toEqual(['h1', 'h2', 'h3', 'h4']);
  });

  it('ignores forged true_false statements ok flags (B02)', async () => {
    const tfQuestion: Question = {
      ...makeQuestion('tf1'),
      type: 'true_false',
      options: null,
      correctAnswer: null,
      statements: [
        { t: 'Ý 1', ok: true },
        { t: 'Ý 2', ok: false },
        { t: 'Ý 3', ok: false },
        { t: 'Ý 4', ok: true },
      ],
    };
    mockDbRows([tfQuestion]);
    // Forged: every statement claims ok, answers all "Đúng".
    const questions = [
      {
        ...tfQuestion,
        statements: (tfQuestion.statements || []).map((s) => ({ t: s.t, ok: true })),
        opts: [],
        tf: [1, 1, 1, 1],
        sa: '',
      } as RuntimeQuestion,
    ];

    const req = new NextRequest('http://localhost/api/exam/submit', {
      method: 'POST',
      body: JSON.stringify({
        answers: [-1],
        flags: [false],
        timeSec: 60,
        cfg: { subject: 'history', lesson: 1, count: 1, time: 10, practice: false },
        questions,
      }),
    });

    const res = await submitPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(0);
    expect(data.bad).toBe(1);
    // 2 of the 4 DB statements were genuinely right — a forged all-`ok`
    // statements list used to score 4/4 (point 10).
    expect(data.point).toBe(2.5);
  });

  it('returns 400 when a submitted question id is unknown to the DB', async () => {
    const q = makeQuestion('h1');
    mockDbRows([q]);
    const questions = [makeRuntime(q), makeRuntime(makeQuestion('ghost'))];

    const req = new NextRequest('http://localhost/api/exam/submit', {
      method: 'POST',
      body: JSON.stringify({
        answers: [0, 0],
        flags: [false, false],
        timeSec: 60,
        cfg: { subject: 'history', lesson: 1, count: 2, time: 10, practice: false },
        questions,
      }),
    });

    const res = await submitPOST(req);
    expect(res.status).toBe(400);
  });

  it('persists lesson 0 (tổng hợp) for the default lesson="all" config (N4)', async () => {
    mockGetCurrentUser.mockReturnValue({ id: 'user-1', name: 'Test', email: 't@t.com' });
    const base = [makeQuestion('h1'), makeQuestion('h2')];
    const questions = base.map(makeRuntime);
    mockDbRows(base); // scoring lookup
    mockDb.select.mockReturnValueOnce(chainable([])); // getUserProgress → no rows
    const values = mockInsert();

    const req = new NextRequest('http://localhost/api/exam/submit', {
      method: 'POST',
      body: JSON.stringify({
        answers: [0, -1],
        flags: [false, false],
        timeSec: 120,
        cfg: { subject: 'history', lesson: 'all', count: 2, time: 10, practice: false },
        questions,
      }),
    });

    const res = await submitPOST(req);
    expect(res.status).toBe(200);

    // saveExamResult is the first insert — lesson must be 0, never NaN.
    expect(values.mock.calls[0][0].lesson).toBe(0);
    expect(Number.isNaN(values.mock.calls[0][0].lesson)).toBe(false);
  });

  it('scores with skipped questions (ans -1)', async () => {
    const base = [makeQuestion('h1'), makeQuestion('h2')];
    const qs = base.map(makeRuntime);
    mockDbRows(base);
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

  it('scores short_answer: correct string → ok (case/accent-insensitive)', async () => {
    const base = [makeSA('sa1', 'Hồ Chí Minh'), makeSA('sa2', '1945', 4)];
    mockDbRows(base);
    const questions = [makeSARuntime(base[0], 'ho chi minh'), makeSARuntime(base[1], '1945')];

    const req = new NextRequest('http://localhost/api/exam/submit', {
      method: 'POST',
      body: JSON.stringify({
        answers: [-1, -1],
        flags: [false, false],
        timeSec: 60,
        cfg: { subject: 'history', lesson: 1, count: 2, time: 10, practice: false },
        questions,
      }),
    });

    const res = await submitPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(2);
    expect(data.bad).toBe(0);
    expect(data.skip).toBe(0);
    expect(data.point).toBe(10);
    expect(data.wrongIds).toEqual([]);
  });

  it('ignores forged short_answer key: server re-derives from db.answer (B02)', async () => {
    const dbRow = makeSA('sa1', 'REAL');
    mockDbRows([dbRow]);
    // Forged: client claims the answer key is 'FORGED' and typed it correctly.
    const questions = [{ ...makeSARuntime(dbRow, 'FORGED'), answer: 'FORGED' } as RuntimeQuestion];

    const req = new NextRequest('http://localhost/api/exam/submit', {
      method: 'POST',
      body: JSON.stringify({
        answers: [-1],
        flags: [false],
        timeSec: 60,
        cfg: { subject: 'history', lesson: 1, count: 1, time: 10, practice: false },
        questions,
      }),
    });

    const res = await submitPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    // 'FORGED' !== db 'REAL' → bad. The forged key cannot inflate the score.
    expect(data.ok).toBe(0);
    expect(data.bad).toBe(1);
    expect(data.point).toBe(0);
    expect(data.wrongIds).toEqual(['sa1']);
  });

  it('scores unknown short_answer string → bad, empty → skip', async () => {
    const base = [makeSA('sa1', 'REAL'), makeSA('sa2', 'REAL')];
    mockDbRows(base);
    const questions = [makeSARuntime(base[0], 'nope'), makeSARuntime(base[1], '')];

    const req = new NextRequest('http://localhost/api/exam/submit', {
      method: 'POST',
      body: JSON.stringify({
        answers: [-1, -1],
        flags: [false, false],
        timeSec: 60,
        cfg: { subject: 'history', lesson: 1, count: 2, time: 10, practice: false },
        questions,
      }),
    });

    const res = await submitPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(0);
    expect(data.bad).toBe(1);
    expect(data.skip).toBe(1);
    expect(data.point).toBe(0);
    expect(data.wrongIds).toEqual(['sa1']);
  });

  it('returns 400 without touching the DB when >100 questions are submitted', async () => {
    const questions = Array.from({ length: 101 }, (_, n) =>
      makeRuntime(makeQuestion(`h${n}`)),
    );

    const req = new NextRequest('http://localhost/api/exam/submit', {
      method: 'POST',
      body: JSON.stringify({
        answers: new Array(101).fill(0),
        flags: new Array(101).fill(false),
        timeSec: 60,
        cfg: { subject: 'history', lesson: 1, count: 101, time: 10, practice: false },
        questions,
      }),
    });

    const res = await submitPOST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/max 100/);
    // The cap fires before getQuestionsByIds — the select stub must not be
    // touched (beforeEach already reset it; a read would consume mockReturnValue).
    expect(mockDb.select).not.toHaveBeenCalled();
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
