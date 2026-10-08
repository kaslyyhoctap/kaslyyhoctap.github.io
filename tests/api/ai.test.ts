/**
 * tests/api/ai.test.ts — tests for the AI generate + explain routes.
 *
 * Mocks @google/genai's generateText (via @/lib/ai/client), the DB, and auth
 * so no real API calls or DB queries are made.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Hoisted mocks ──────────────────────────────────────────────────────

// @google/genai is mocked via the client wrapper.
const mockGenerateText = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ai/client', () => ({
  getAIClient: vi.fn(),
  AI_MODEL: 'gemini-2.0-flash',
  generateText: mockGenerateText,
}));

// DB mock (same pattern as tests/api/exam.test.ts).
const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
}));
vi.mock('@/db', () => ({ db: mockDb }));

// Auth mock.
const mockGetCurrentUser = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth-utils', () => ({ getCurrentUser: mockGetCurrentUser }));

import { POST as generatePOST } from '@/app/api/ai/generate/route';
import { POST as explainPOST } from '@/app/api/ai/explain/route';

// ── Helpers ────────────────────────────────────────────────────────────

function chainable(data: unknown): Record<string, any> {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(data).then(resolve),
  };
}

const MOCK_USER = { id: 'user-1', name: 'Test', email: 'test@test.com' };
const MOCK_QUESTIONS_JSON = JSON.stringify([
  {
    question: 'Ai là người phát minh ra điện trời?',
    options: ['Thomas Edison', 'Nikola Tesla', 'Alexander Graham Bell', 'Marie Curie'],
    correctAnswer: 0,
    explanation: 'Thomas Edison đã phát minh đèn trời điện.',
    topic: 'Phát minh',
    difficulty: 'Nhận biết',
    type: 'multiple_choice',
  },
  {
    question: 'Nước nào là quê hương của bánh pizza?',
    options: ['Pháp', 'Ý', 'Hoa Kỳ', 'Đức'],
    correctAnswer: 1,
    explanation: 'Bánh pizza có nguồn gốc từ Ý.',
    topic: 'Ẩm thực',
    difficulty: 'Nhận biết',
    type: 'multiple_choice',
  },
]);

function mockInsert() {
  mockDb.insert.mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  });
}

// ── POST /api/ai/generate ──────────────────────────────────────────────

describe('POST /api/ai/generate', () => {
  beforeEach(() => {
    mockDb.select.mockReset();
    mockDb.insert.mockReset();
    mockGetCurrentUser.mockReset();
    mockGenerateText.mockReset();
  });

  it('returns 401 for anonymous users', async () => {
    mockGetCurrentUser.mockReturnValue(null);

    const req = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ subject: 'history', lesson: 1, count: 5 }),
    });

    const res = await generatePOST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.fallback).toBeUndefined();
  });

  it('returns 429 with fallback when rate limit exceeded', async () => {
    mockGetCurrentUser.mockReturnValue(MOCK_USER);
    // countAiGenerateRequests → 5 already used today
    mockDb.select.mockReturnValueOnce(chainable([{ count: 5 }]));

    const req = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ subject: 'history', lesson: 1, count: 5 }),
    });

    const res = await generatePOST(req);
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.fallback).toBe(true);
    expect(data.error).toContain('lượt');
    // AI should NOT have been called.
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('returns cached questions without calling AI', async () => {
    mockGetCurrentUser.mockReturnValue(MOCK_USER);
    // count → 0 used
    mockDb.select.mockReturnValueOnce(chainable([{ count: 0 }]));
    // cache hit → returns 2 questions
    const cached = [
      {
        id: 'q1',
        subject: 'history',
        lesson: 1,
        question: 'Câu hỏi đã lưu',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 0,
        explanation: 'Giải thích',
        type: 'multiple_choice',
      },
    ];
    mockDb.select.mockReturnValueOnce(chainable([{ questions: cached }]));

    const req = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ subject: 'history', lesson: 1, count: 5, difficulty: 'all' }),
    });

    const res = await generatePOST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.questions).toHaveLength(1);
    expect(data.questions[0].question).toBe('Câu hỏi đã lưu');
    expect(data.cached).toBe(true);
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('calls AI, validates JSON, saves, and returns questions', async () => {
    mockGetCurrentUser.mockReturnValue(MOCK_USER);
    // count → 0 used
    mockDb.select.mockReturnValueOnce(chainable([{ count: 0 }]));
    // cache → empty (no hit)
    mockDb.select.mockReturnValueOnce(chainable([]));
    mockInsert();
    mockGenerateText.mockResolvedValue(MOCK_QUESTIONS_JSON);

    const req = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ subject: 'history', lesson: 1, count: 2 }),
    });

    const res = await generatePOST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.questions).toHaveLength(2);
    expect(data.questions[0].question).toContain('điện trời');
    expect(data.questions[0].options).toHaveLength(4);
    expect(data.questions[0].correctAnswer).toBe(0);
    expect(data.questions[0].id).toMatch(/^ai_/);
    expect(data.questions[0].sourceType).toBe('ai');
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  it('strips markdown code fences from AI JSON response', async () => {
    mockGetCurrentUser.mockReturnValue(MOCK_USER);
    mockDb.select.mockReturnValueOnce(chainable([{ count: 0 }]));
    mockDb.select.mockReturnValueOnce(chainable([]));
    mockInsert();
    mockGenerateText.mockResolvedValue('```json\n' + MOCK_QUESTIONS_JSON + '\n```');

    const req = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ subject: 'history', lesson: 1, count: 2 }),
    });

    const res = await generatePOST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.questions).toHaveLength(2);
  });

  it('filters out invalid questions and returns valid ones', async () => {
    mockGetCurrentUser.mockReturnValue(MOCK_USER);
    mockDb.select.mockReturnValueOnce(chainable([{ count: 0 }]));
    mockDb.select.mockReturnValueOnce(chainable([]));
    mockInsert();
    // First question valid, second missing options, third has bad correctAnswer.
    mockGenerateText.mockResolvedValue(
      JSON.stringify([
        { question: 'OK?', options: ['A', 'B', 'C', 'D'], correctAnswer: 0, explanation: 'OK', topic: 't', difficulty: 'Nhận biết', type: 'multiple_choice' },
        { question: 'No opts', correctAnswer: 0, explanation: 'no' },
        { question: 'Bad', options: ['A', 'B', 'C'], correctAnswer: 5, explanation: 'bad', topic: 't', difficulty: 'Nhận biết' },
      ]),
    );

    const req = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ subject: 'history', lesson: 1, count: 3 }),
    });

    const res = await generatePOST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.questions).toHaveLength(1);
    expect(data.questions[0].question).toBe('OK?');
  });

  it('returns fallback when AI returns non-JSON', async () => {
    mockGetCurrentUser.mockReturnValue(MOCK_USER);
    mockDb.select.mockReturnValueOnce(chainable([{ count: 0 }]));
    mockDb.select.mockReturnValueOnce(chainable([]));
    mockGenerateText.mockResolvedValue('Xin lỗi, tôi không thể giúp được.');

    const req = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ subject: 'history', lesson: 1, count: 2 }),
    });

    const res = await generatePOST(req);
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.fallback).toBe(true);
  });

  it('returns 400 for invalid subject', async () => {
    mockGetCurrentUser.mockReturnValue(MOCK_USER);

    const req = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ subject: 'invalid', lesson: 1, count: 5 }),
    });

    const res = await generatePOST(req);
    expect(res.status).toBe(400);
  });
});

// ── POST /api/ai/explain ───────────────────────────────────────────────

describe('POST /api/ai/explain', () => {
  beforeEach(() => {
    mockDb.select.mockReset();
    mockDb.insert.mockReset();
    mockGetCurrentUser.mockReset();
    mockGenerateText.mockReset();
  });

  it('returns 401 for anonymous users', async () => {
    mockGetCurrentUser.mockReturnValue(null);

    const req = new NextRequest('http://localhost/api/ai/explain', {
      method: 'POST',
      body: JSON.stringify({
        question: 'Test?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 0,
        userAnswer: 1,
      }),
    });

    const res = await explainPOST(req);
    expect(res.status).toBe(401);
  });

  it('returns 429 when rate limit exceeded', async () => {
    mockGetCurrentUser.mockReturnValue(MOCK_USER);
    mockDb.select.mockReturnValueOnce(chainable([{ count: 50 }]));

    const req = new NextRequest('http://localhost/api/ai/explain', {
      method: 'POST',
      body: JSON.stringify({
        question: 'Test?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 0,
        userAnswer: 1,
      }),
    });

    const res = await explainPOST(req);
    expect(res.status).toBe(429);
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('calls AI and returns explanation', async () => {
    mockGetCurrentUser.mockReturnValue(MOCK_USER);
    mockDb.select.mockReturnValueOnce(chainable([{ count: 0 }]));
    mockInsert();
    mockGenerateText.mockResolvedValue('Đáp án A là đúng vì lý do X. Lựa chọn B của bạn chưa đúng.');

    const req = new NextRequest('http://localhost/api/ai/explain', {
      method: 'POST',
      body: JSON.stringify({
        question: 'Câu hỏi test?',
        options: ['Đúng', 'Sai', 'C', 'D'],
        correctAnswer: 0,
        userAnswer: 1,
        explanation: 'Giải thích gốc',
      }),
    });

    const res = await explainPOST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.explanation).toContain('lý do X');
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    // The prompt should include the user's answer context.
    const callArg = mockGenerateText.mock.calls[0][0] as string;
    expect(callArg).toContain('Câu hỏi test?');
    expect(callArg).toContain('Học sinh đã chọn');
  });

  it('handles true/false questions', async () => {
    mockGetCurrentUser.mockReturnValue(MOCK_USER);
    mockDb.select.mockReturnValueOnce(chainable([{ count: 0 }]));
    mockInsert();
    mockGenerateText.mockResolvedValue('Giải thích TF...');

    const req = new NextRequest('http://localhost/api/ai/explain', {
      method: 'POST',
      body: JSON.stringify({
        question: 'Đây là câu hỏi Đúng/Sai',
        options: ['Statement 1', 'Statement 2', 'Statement 3', 'Statement 4'],
        correctAnswer: -1,
        userAnswer: [1, 0],
        statements: [
          { t: 'Statement 1', ok: true },
          { t: 'Statement 2', ok: false },
        ],
      }),
    });

    const res = await explainPOST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.explanation).toBe('Giải thích TF...');
  });

  it('returns 400 when question/options missing', async () => {
    mockGetCurrentUser.mockReturnValue(MOCK_USER);
    mockDb.select.mockReturnValueOnce(chainable([{ count: 0 }]));

    const req = new NextRequest('http://localhost/api/ai/explain', {
      method: 'POST',
      body: JSON.stringify({ options: ['A'] }),
    });

    const res = await explainPOST(req);
    expect(res.status).toBe(400);
  });

  it('returns 502 when AI call fails with non-quota error', async () => {
    mockGetCurrentUser.mockReturnValue(MOCK_USER);
    mockDb.select.mockReturnValueOnce(chainable([{ count: 0 }]));
    mockGenerateText.mockRejectedValue(new Error('Some network error'));

    const req = new NextRequest('http://localhost/api/ai/explain', {
      method: 'POST',
      body: JSON.stringify({
        question: 'Test?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 0,
        userAnswer: 1,
      }),
    });

    const res = await explainPOST(req);
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });
});
