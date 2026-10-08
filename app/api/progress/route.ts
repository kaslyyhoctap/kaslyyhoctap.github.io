/**
 * GET /api/progress  → user progress object (requires auth)
 * PUT /api/progress  → { key, value } save single key (requires auth)
 *
 * The POST /api/progress/sync handler lives in the sibling `sync/` segment.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getUserProgress, saveUserProgress } from '@/lib/db/queries';
import { getCurrentUser } from '@/lib/auth-utils';

// ── GET: fetch full progress object ─────────────────────────────────
export async function GET(_req: NextRequest) {
  const user = await getCurrentUser();
  const userId = user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const progress = await getUserProgress(userId);
  return NextResponse.json(progress);
}

// ── PUT: save a single key-value pair ───────────────────────────────
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  const userId = user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { key, value } = (await req.json()) as { key: string; value: unknown };
  if (!key) {
    return NextResponse.json({ error: '`key` is required' }, { status: 400 });
  }
  await saveUserProgress(userId, key, value);
  return NextResponse.json({ ok: true });
}
