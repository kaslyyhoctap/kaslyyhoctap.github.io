/**
 * tests/api/admin-questions.test.ts — body validation for admin question
 * writes (B05/N3).
 *
 * The POST/PUT handlers used to pass the raw body straight into
 * `db.insert().values()` / `.set()` — so `{}` 500'd on the not-null columns
 * and `{"id":"<other>"}` reassigned the primary key on PUT.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ──────────────────────────────────────────────────────────────
const mockDb = vi.hoisted(() => ({
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  select: vi.fn(),
}));
vi.mock('@/db', () => ({ db: mockDb }));

// requireAdmin is NOT touched — mock the whole module with an admin user.
const mockRequireAdmin = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth-utils', () => ({ requireAdmin: mockRequireAdmin }));

import { POST } from '@/app/api/admin/questions/route';
import { PUT } from '@/app/api/admin/questions/[id]/route';

function post(body: unknown) {
  return new NextRequest('http://localhost/api/admin/questions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function put(body: unknown) {
  return new NextRequest('http://localhost/api/admin/questions/h1', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

const VALID = {
  id: 'h1',
  subject: 'history',
  lesson: 1,
  type: 'multiple_choice',
  difficulty: 'Nhận biết',
  question: 'Câu hỏi?',
  options: ['A', 'B', 'C', 'D'],
  correctAnswer: 0,
  explanation: 'Vì A.',
};

describe('admin question writes validation (B05/N3)', () => {
  beforeEach(() => {
    mockDb.insert.mockReset();
    mockDb.update.mockReset();
    mockRequireAdmin.mockReset();
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    mockDb.insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
  });

  it('POST {} → 400, not 500 (required-field rejection)', async () => {
    const res = await POST(post({}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('POST rejects unknown fields', async () => {
    const res = await POST(post({ ...VALID, forged: true }));
    expect(res.status).toBe(400);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('POST rejects an invalid subject enum', async () => {
    const res = await POST(post({ ...VALID, subject: 'bogus' }));
    expect(res.status).toBe(400);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('POST accepts a valid body', async () => {
    const res = await POST(post(VALID));
    expect(res.status).toBe(200);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('PUT strips a forged id — the URL id stays authoritative', async () => {
    const res = await PUT(put({ ...VALID, id: 'other-id', createdAt: '2020-01-01' }), {
      params: Promise.resolve({ id: 'h1' }),
    });
    expect(res.status).toBe(200);
    const setArg = mockDb.update.mock.results[0].value.set.mock.calls[0][0];
    expect(setArg.id).toBeUndefined();
    expect(setArg.createdAt).toBeUndefined();
  });
});
