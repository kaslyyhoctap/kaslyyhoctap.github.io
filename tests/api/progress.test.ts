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

  it('merges: union keys, hist unioned (cap 20), numbers take Math.max', async () => {
    // Cloud has: answered={q1:'ok', q2:'bad'}, best=8, hist=[cloudRec]
    // Local has:  answered={q3:'ok'}, best=6, exams=5, hist=[localRec]
    mockDb.select.mockReturnValueOnce(chainable([
      { key: 'answered', value: { q1: 'ok', q2: 'bad' } },
      { key: 'best', value: 8 },
      { key: 'hist', value: [{ when: 2, point: 8 }] },
    ]));
    mockDb.insert.mockReturnValue(insertChain());

    const req = new NextRequest('http://localhost/api/progress/sync', {
      method: 'POST',
      body: JSON.stringify({
        localData: {
          answered: { q3: 'ok' },
          best: 6,
          exams: 5,
          hist: [{ when: 1, point: 7 }],
        },
      }),
    });

    const res = await syncPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);

    // answered: union — q1,q2 from cloud, q3 from local (preserved)
    expect(data.progress.answered).toEqual({ q1: 'ok', q2: 'bad', q3: 'ok' });
    // best: Math.max(local 6, cloud 8) → 8 — monotone, never loses the
    // better value (B03 completion; was cloud-wins).
    expect(data.progress.best).toBe(8);
    // exams: local-only, added
    expect(data.progress.exams).toBe(5);
    // hist: union of local + cloud (B03 — local history was dropped before)
    expect(data.progress.hist).toEqual([{ when: 1, point: 7 }, { when: 2, point: 8 }]);
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

  it('never regresses a local ok to a cloud bad in the answered map (B08)', async () => {
    // Cloud: { answered: { q1: 'bad', q2: 'bad' } }
    // Local:  { answered: { q1: 'ok',  q2: 'bad' } }
    // q1: local 'ok' wins over cloud 'bad' (correct-after-wrong is progress);
    // q2: both 'bad' → cloud value kept. A local-only key is always preserved.
    // NOTE: this test replaced the old "local answers override cloud on
    // conflict" test, which encoded the buggy cloud-wins behavior (cloud 'bad'
    // overwrote a newer local 'ok', discarding the user's progress).
    mockDb.select.mockReturnValueOnce(chainable([
      { key: 'answered', value: { q1: 'bad', q2: 'bad' } },
    ]));
    mockDb.insert.mockReturnValue(insertChain());

    const req = new NextRequest('http://localhost/api/progress/sync', {
      method: 'POST',
      body: JSON.stringify({
        localData: {
          answered: { q1: 'ok', q2: 'bad', q3: 'ok' },
        },
      }),
    });

    const res = await syncPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.progress.answered).toEqual({ q1: 'ok', q2: 'bad', q3: 'ok' });
  });

  it('cloud ok still wins over local bad (no false progress)', async () => {
    // Cloud: { answered: { q1: 'ok' } }, Local: { answered: { q1: 'bad' } }
    // The never-regress rule is one-directional: cloud 'ok' is kept.
    mockDb.select.mockReturnValueOnce(chainable([
      { key: 'answered', value: { q1: 'ok' } },
    ]));
    mockDb.insert.mockReturnValue(insertChain());

    const req = new NextRequest('http://localhost/api/progress/sync', {
      method: 'POST',
      body: JSON.stringify({ localData: { answered: { q1: 'bad' } } }),
    });

    const res = await syncPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.progress.answered).toEqual({ q1: 'ok' });
  });

  it('caps the hist union at 20 entries (app convention)', async () => {
    const cloudHist = Array.from({ length: 15 }, (_, i) => ({ when: 100 + i }));
    const localHist = Array.from({ length: 10 }, (_, i) => ({ when: i }));
    mockDb.select.mockReturnValueOnce(chainable([{ key: 'hist', value: cloudHist }]));
    mockDb.insert.mockReturnValue(insertChain());

    const req = new NextRequest('http://localhost/api/progress/sync', {
      method: 'POST',
      body: JSON.stringify({ localData: { hist: localHist } }),
    });

    const res = await syncPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.progress.hist).toHaveLength(20);
  });

  it('best: Math.max — a better local score wins (local 9 over cloud 8)', async () => {
    // Monotone both directions: the merge keeps the better of the two.
    mockDb.select.mockReturnValueOnce(chainable([{ key: 'best', value: 8 }]));
    mockDb.insert.mockReturnValue(insertChain());

    const req = new NextRequest('http://localhost/api/progress/sync', {
      method: 'POST',
      body: JSON.stringify({ localData: { best: 9 } }),
    });

    const res = await syncPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.progress.best).toBe(9);
  });

  it('starred: shallow union — cloud-only keys kept, local wins per key', async () => {
    // Cloud {a:true}, local {b:true} → {a:true,b:true} (no local mutation
    // lost: the second device's star survives).
    mockDb.select.mockReturnValueOnce(chainable([
      { key: 'starred', value: { a: true } },
    ]));
    mockDb.insert.mockReturnValue(insertChain());

    const req = new NextRequest('http://localhost/api/progress/sync', {
      method: 'POST',
      body: JSON.stringify({ localData: { starred: { b: true } } }),
    });

    const res = await syncPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.progress.starred).toEqual({ a: true, b: true });
  });

  it('starred: local {a:false} over cloud {a:true} → {a:false} (local wins per key)', async () => {
    mockDb.select.mockReturnValueOnce(chainable([
      { key: 'starred', value: { a: true } },
    ]));
    mockDb.insert.mockReturnValue(insertChain());

    const req = new NextRequest('http://localhost/api/progress/sync', {
      method: 'POST',
      body: JSON.stringify({ localData: { starred: { a: false } } }),
    });

    const res = await syncPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.progress.starred).toEqual({ a: false });
  });

  it('prog: per-lesson Math.max — cloud-only subjects/lessons kept', async () => {
    // Cloud {history:{1:2}}, local {history:{1:3,2:1}} →
    // {history:{1:3,2:1}} (lesson 1 keeps the better 3, lesson 2 is local).
    mockDb.select.mockReturnValueOnce(chainable([
      { key: 'prog', value: { history: { 1: 2 } } },
    ]));
    mockDb.insert.mockReturnValue(insertChain());

    const req = new NextRequest('http://localhost/api/progress/sync', {
      method: 'POST',
      body: JSON.stringify({ localData: { prog: { history: { 1: 3, 2: 1 } } } }),
    });

    const res = await syncPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.progress.prog).toEqual({ history: { 1: 3, 2: 1 } });
  });

  it('marked: array union with dedupe (no cap)', async () => {
    // Cloud ['a'], local ['b'] → both survive (order-insensitive).
    mockDb.select.mockReturnValueOnce(chainable([
      { key: 'marked', value: ['a'] },
    ]));
    mockDb.insert.mockReturnValue(insertChain());

    const req = new NextRequest('http://localhost/api/progress/sync', {
      method: 'POST',
      body: JSON.stringify({ localData: { marked: ['b'] } }),
    });

    const res = await syncPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect([...(data.progress.marked as string[])].sort()).toEqual(['a', 'b']);
  });

  it('fresh device: empty local values do not clobber cloud data', async () => {
    // best:0 vs cloud 8 → 8 (Math.max); starred:{} vs cloud map → cloud map
    // (union); exams:0 vs cloud 3 → 3.
    mockDb.select.mockReturnValueOnce(chainable([
      { key: 'best', value: 8 },
      { key: 'starred', value: { a: true } },
      { key: 'exams', value: 3 },
    ]));
    mockDb.insert.mockReturnValue(insertChain());

    const req = new NextRequest('http://localhost/api/progress/sync', {
      method: 'POST',
      body: JSON.stringify({
        localData: { best: 0, starred: {}, exams: 0 },
      }),
    });

    const res = await syncPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.progress.best).toBe(8);
    expect(data.progress.starred).toEqual({ a: true });
    expect(data.progress.exams).toBe(3);
  });

  it('unknown keys + type mismatches fall back to local wins', async () => {
    // Catch-all row of the merge table: the device being synced is the one
    // the user just used; the post-login steady state (useProgressSync PUTs
    // every local key) is local-wins, so the merge must not be lossier.
    mockDb.select.mockReturnValueOnce(chainable([
      { key: 'theme', value: 'light' },
      { key: 'marked', value: ['a'] },
    ]));
    mockDb.insert.mockReturnValue(insertChain());

    const req = new NextRequest('http://localhost/api/progress/sync', {
      method: 'POST',
      body: JSON.stringify({
        localData: { theme: 'dark', marked: 'oops' },
      }),
    });

    const res = await syncPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.progress.theme).toBe('dark');
    expect(data.progress.marked).toBe('oops');
  });

  it('tolerates corrupt non-object answered/hist values without 500', async () => {
    mockDb.select.mockReturnValueOnce(chainable([
      { key: 'answered', value: { q1: 'ok' } },
      { key: 'hist', value: [{ when: 2 }] },
    ]));
    mockDb.insert.mockReturnValue(insertChain());

    const req = new NextRequest('http://localhost/api/progress/sync', {
      method: 'POST',
      body: JSON.stringify({ localData: { answered: 'oops', hist: 'oops' } }),
    });

    const res = await syncPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.progress.answered).toEqual({ q1: 'ok' });
    expect(data.progress.hist).toEqual([{ when: 2 }]);
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
