/**
 * tests/api/admin-auth.test.ts — wave C (T1 P0): admin API routes gate
 * every handler behind requireAdmin() BEFORE touching the DB or the body.
 *
 * Unauthenticated GET/POST/PUT/DELETE → 401 with no DB call and no data.
 * (Signed-in behavior is unchanged by code-reading: requireAdmin() resolves
 * for the admin email and the handlers run exactly as before.)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks (same convention as tests/api/admin-questions.test.ts) ──────
const mockDb = vi.hoisted(() => ({
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  select: vi.fn(),
}));
vi.mock('@/db', () => ({ db: mockDb }));

// requireAdmin REJECTS — the signed-out state.
const mockRequireAdmin = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth-utils', () => ({ requireAdmin: mockRequireAdmin }));

vi.mock('@/lib/db/queries', () => ({ getQuestions: vi.fn() }));

import { GET, POST } from '@/app/api/admin/questions/route';
import { PUT, DELETE } from '@/app/api/admin/questions/[id]/route';
import { getQuestions } from '@/lib/db/queries';

function req(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const PARAMS = { params: Promise.resolve({ id: 'bio1-01' }) };

describe('admin API auth gate (wave C)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockRejectedValue(new Error('Unauthorized'));
    mockDb.insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
    mockDb.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  });

  it('GET /api/admin/questions signed out → 401, zero DB queries', async () => {
    const res = await GET(req('http://localhost/api/admin/questions', 'GET'));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
    expect(getQuestions).not.toHaveBeenCalled();
  });

  it('POST /api/admin/questions signed out → 401, no insert', async () => {
    const res = await POST(req('http://localhost/api/admin/questions', 'POST', { id: 'x' }));
    expect(res.status).toBe(401);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('PUT /api/admin/questions/:id signed out → 401, no update', async () => {
    const res = await PUT(req('http://localhost/api/admin/questions/bio1-01', 'PUT', { id: 'x' }), PARAMS);
    expect(res.status).toBe(401);
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('DELETE /api/admin/questions/:id signed out → 401, no delete', async () => {
    const res = await DELETE(req('http://localhost/api/admin/questions/bio1-01', 'DELETE'), PARAMS);
    expect(res.status).toBe(401);
    expect(mockDb.delete).not.toHaveBeenCalled();
  });
});
