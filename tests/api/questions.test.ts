/**
 * tests/api/questions.test.ts — param validation for GET /api/questions (B04/N2).
 *
 * Raw parseInt/Number used to let NaN drop the LIMIT clause (full 1524-row
 * dump) and let `lesson=abc` / `offset=-5` 500 at the SQL layer. The route
 * must now clamp limit 1–200 (default 50), floor offset at 0, and 400 on a
 * non-integer lesson.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mock db (same pattern as tests/api/exam.test.ts) ──────────────────
const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
}));
vi.mock('@/db', () => ({ db: mockDb }));

import { GET as questionsGET } from '@/app/api/questions/route';

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

function mockRows() {
  mockDb.select.mockReturnValueOnce(chainable([])); // getQuestions
  mockDb.select.mockReturnValueOnce(chainable([{ count: 0 }])); // countQuestions
}

function get(url: string) {
  return new NextRequest(`http://localhost${url}`);
}

/** Capture the `limit`/`offset` values the route passed to Drizzle. */
function lastLimitOffset(): { limit: number; offset: number } {
  const calls = mockDb.select.mock.results
    .map((r) => r.value)
    // countQuestions never calls .limit() — only getQuestions' chain qualifies.
    .filter((c) => c && c.limit?.mock?.calls?.length > 0);
  const last = calls[calls.length - 1];
  return {
    limit: last.limit.mock.calls[0][0],
    offset: last.offset.mock.calls[0][0],
  };
}

describe('GET /api/questions param validation (B04/N2)', () => {
  beforeEach(() => {
    mockDb.select.mockReset();
  });

  it('clamps limit=abc to the 50 default (no full-table dump)', async () => {
    mockRows();
    const res = await questionsGET(get('/api/questions?limit=abc'));
    expect(res.status).toBe(200);
    expect(lastLimitOffset().limit).toBe(50);
  });

  it('clamps limit=-1 to 1 and limit=1000000 to 200', async () => {
    mockRows();
    await questionsGET(get('/api/questions?limit=-1'));
    expect(lastLimitOffset().limit).toBe(1);

    mockDb.select.mockReset();
    mockRows();
    await questionsGET(get('/api/questions?limit=1000000'));
    expect(lastLimitOffset().limit).toBe(200);
  });

  it('floors offset=-5 to 0 instead of 500ing', async () => {
    mockRows();
    const res = await questionsGET(get('/api/questions?limit=50&offset=-5'));
    expect(res.status).toBe(200);
    expect(lastLimitOffset().offset).toBe(0);
  });

  it('returns 400 for lesson=abc instead of 500ing', async () => {
    const res = await questionsGET(get('/api/questions?lesson=abc'));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
    // DB must never see the NaN.
    expect(mockDb.select).not.toHaveBeenCalled();
  });
});
