/**
 * POST /api/progress/sync
 *
 * Merge strategy: union all keys from local + cloud. Cloud wins conflicts
 * except for the `answered` map — newer local answers (not yet in cloud)
 * are preserved.
 *
 * Requires auth.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getUserProgress, saveUserProgress } from '@/lib/db/queries';
import { getCurrentUser } from '@/lib/auth-utils';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  const userId = user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { localData } = (await req.json()) as { localData: Record<string, unknown> };
  if (!localData || typeof localData !== 'object') {
    return NextResponse.json(
      { error: '`localData` is required' },
      { status: 400 },
    );
  }

  const cloud = await getUserProgress(userId);

  // Start from cloud; overlay local keys that don't exist in cloud.
  const merged: Record<string, unknown> = { ...cloud };

  for (const [key, localVal] of Object.entries(localData)) {
    if (!(key in merged)) {
      // Cloud doesn't have this key → local value is newer, keep it.
      merged[key] = localVal;
    } else if (key === 'answered') {
      // Per-question answer map: union entries. For questions present in
      // both, cloud wins; local-only answers (newer) are preserved.
      const cloudAnswered = (merged[key] || {}) as Record<string, string>;
      merged[key] = { ...(localVal as Record<string, string>), ...cloudAnswered };
    }
    // else: cloud wins — keep existing cloud value.
  }

  // Persist every key (idempotent upsert).
  for (const [key, value] of Object.entries(merged)) {
    await saveUserProgress(userId, key, value);
  }

  return NextResponse.json({ ok: true, progress: merged });
}
