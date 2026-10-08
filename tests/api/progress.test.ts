import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mock db ────────────────────────────────────────────────────────
const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
}));
vi.mock('@/db', () => ({ db: mockDb }));

// ── Mock auth ──────────────────────────────────────────────────────
const mockGetCurrentUser = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth-utils', () => ({ getCurrentUser: mockGetCurrentUser }));

import { GET, PUT } from '@/app/api/progress/route';
import { POST as syncPOST } from '@/app/api/progress/sync/route';

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

function insertChain(): Record<string, any> {
  const c: Record<string, any> = {
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(undefined).then(resolve),
  };
  return c;
}

describe('GET /api/progress', () => {
  beforeEach(() => {
    mockDb.select.mockReset();
    mockGetCurrentUser.mockReturnValue(null);
  });

  it('returns 401 for unauthenticated requests', async () => {
    const req = new NextRequest('http://localhost/api/progress');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns progress object for authenticated user', async () => {
    mockGetCurrentUser.mockReturnValue({ id: 'user-1', name: 'Test', email: 't@t.com' });
    mockDb.select.mockReturnValue(chainable([
      { key: 'answered', value: { q1: 'ok', q2: 'bad' } },
      { key: 'best', value: 8.5 },
    ]));

    const req = new NextRequest('http://localhost/api/progress');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.answered).toEqual({ q1: 'ok', q2: 'bad' });
    expect(data.best).toBe(8.5);
  });
});

describe('PUT /api/progress', () => {
  beforeEach(() => {
    mockDb.select.mockReset();
    mockDb.insert.mockReset();
    mockGetCurrentUser.mockReturnValue({ id: 'user-1', name: 'Test', email: 't@t.com' });
  });

  it('returns 401 for unauthenticated requests', async () => {
    mockGetCurrentUser.mockReturnValue(null);
    const req = new NextRequest('http://localhost/api/progress', {
      method: 'PUT',
      body: JSON.stringify({ key: 'best', value: 9 }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(401);
  });

  it('saves a key-value pair', async () => {
    mockDb.insert.mockReturnValue(insertChain());

    const req = new NextRequest('http://localhost/api/progress', {
      method: 'PUT',
      body: JSON.stringify({ key: 'best', value: 9 }),
    });
    const res = await PUT(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });

  it('returns 400 when key is missing', async () => {
    const req = new NextRequest('http://localhost/api/progress', {
      method: 'PUT',
      body: JSON.stringify({ value: 9 }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/progress/sync', () => {
  beforeEach(() => {
    mockDb.select.mockReset();
    mockDb.insert.mockReset();
    mockGetCurrentUser.mockReturnValue({ id: 'user-1', name: 'Test', email: 't@t.com' });
  });

  it('returns 401 for unauthenticated requests', async () => {
    mockGetCurrentUser.mockReturnValue(null);
    const req = new NextRequest('http://localhost/api/progress/sync', {
      method: 'POST',
      body: JSON.stringify({ localData: {} }),
    });
    const res = await syncPOST(req);
    expect(res.status).toBe(401);
  });

  it('merges: union keys, cloud wins conflicts except answered map', async () => {
    // Cloud has: answered={q1:'ok', q2:'bad'}, best=8
    // Local has:  answered={q3:'ok'}, best=6, exams=5
    mockDb.select.mockReturnValueOnce(chainable([
      { key: 'answered', value: { q1: 'ok', q2: 'bad' } },
      { key: 'best', value: 8 },
    ]));
    mockDb.insert.mockReturnValue(insertChain());

    const req = new NextRequest('http://localhost/api/progress/sync', {
      method: 'POST',
      body: JSON.stringify({
        localData: {
          answered: { q3: 'ok' },
          best: 6,
          exams: 5,
        },
      }),
    });

    const res = await syncPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);

    // answered: union — q1,q2 from cloud, q3 from local (preserved)
    expect(data.progress.answered).toEqual({ q1: 'ok', q2: 'bad', q3: 'ok' });
    // best: cloud wins (8, not 6)
    expect(data.progress.best).toBe(8);
    // exams: local-only, added
    expect(data.progress.exams).toBe(5);
  });

  it('preserves local-only answered entries when cloud has none', async () => {
    mockDb.select.mockReturnValueOnce(chainable([]));
    mockDb.insert.mockReturnValue(insertChain());

    const req = new NextRequest('http://localhost/api/progress/sync', {
      method: 'POST',
      body: JSON.stringify({
        localData: { answered: { q1: 'ok', q2: 'bad' } },
      }),
    });

    const res = await syncPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.progress.answered).toEqual({ q1: 'ok', q2: 'bad' });
  });

  it('local answers override cloud on conflict for answered map', async () => {
    // Cloud: { answered: { q1: 'bad' } }
    // Local:  { answered: { q1: 'ok',  q2: 'ok' } }
    // Cloud wins per-question conflicts, local-only preserved
    // → { q1: 'bad' (cloud), q2: 'ok' (local) }
    mockDb.select.mockReturnValueOnce(chainable([
      { key: 'answered', value: { q1: 'bad' } },
    ]));
    mockDb.insert.mockReturnValue(insertChain());

    const req = new NextRequest('http://localhost/api/progress/sync', {
      method: 'POST',
      body: JSON.stringify({
        localData: {
          answered: { q1: 'ok', q2: 'ok' },
        },
      }),
    });

    const res = await syncPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    // { ...local, ...cloud } → cloud overrides local
    expect(data.progress.answered).toEqual({ q1: 'bad', q2: 'ok' });
  });

  it('returns 400 when localData is missing', async () => {
    const req = new NextRequest('http://localhost/api/progress/sync', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const res = await syncPOST(req);
    expect(res.status).toBe(400);
  });
});
