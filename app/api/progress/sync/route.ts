/**
 * POST /api/progress/sync
 *
 * Merge strategy: no local mutation may be lost. The device being synced is
 * the one the user just used, and the post-login steady state is local-wins
 * (`lib/hooks/useProgressSync` PUTs every local key), so this merge is the
 * only lossy step if it drops values — it doesn't:
 * - `answered` map: union per-key. Local 'ok' is monotone progress and never
 *   regresses to cloud 'bad' (a correct answer repeated stays correct);
 *   otherwise cloud wins conflicts; local-only keys are preserved.
 * - `hist` (exam history): union of cloud + local entries, capped at the last
 *   20 (app convention: lib/hooks/useQuiz.ts writes newest-first, 20 max).
 * - `best` / `exams` / `correct` (numbers): `Math.max(local, cloud)` —
 *   monotone, never loses the better value; a fresh device's 0 can't
 *   clobber a cloud 8.
 * - `starred` / `vocabKnown` (boolean maps): shallow union
 *   `{...cloud, ...local}` — cloud-only keys kept, local wins per key; a
 *   fresh device's empty `{}` can't clobber the cloud map.
 * - `marked` (string[]): union with JSON-key dedupe (same style as `hist`),
 *   no cap.
 * - `prog` (subject → lesson → number): per-lesson `Math.max`; cloud-only
 *   subjects/lessons kept.
 * - Anything else, a type mismatch, or a corrupt value: local wins.
 *
 * Tradeoff (no per-value timestamps): a local *delete* — unstar, notebook
 * reset — can be resurrected by a union, because a delete is
 * indistinguishable from a device that never had the value. Lossless is the
 * chosen side, matching the `answered` rule.
 *
 * Requires auth.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getUserProgress, saveUserProgress } from '@/lib/db/queries';
import { getCurrentUser } from '@/lib/auth-utils';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

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
      // Per-question answer map: union entries. Local-only answers (not yet
      // in cloud) are preserved. For questions present in both, a local 'ok'
      // never regresses to a cloud 'bad' — re-answering correctly is monotone
      // progress; otherwise cloud wins (it holds the older authoritative copy
      // for conflicts with no per-answer timestamps).
      const cloudAnswered = (merged[key] || {}) as Record<string, string>;
      const localAnswered =
        localVal && typeof localVal === 'object'
          ? (localVal as Record<string, string>)
          : {};
      const next: Record<string, string> = { ...localAnswered };
      for (const [qid, cloudVal] of Object.entries(cloudAnswered)) {
        if (next[qid] === 'ok' && cloudVal === 'bad') continue; // keep local 'ok'
        next[qid] = cloudVal;
      }
      merged[key] = next;
    } else if (key === 'hist') {
      // Exam history: union cloud + local, newest-first, capped at the last
      // 20 records (same convention as the client's submit writer in
      // lib/hooks/useQuiz.ts). Previously cloud silently replaced local and
      // the local history/batch was lost (B03).
      const seen = new Set<string>();
      const union: unknown[] = [];
      // Array guards: a corrupt localStorage value must not 500 the sync.
      const localHist = Array.isArray(localVal) ? (localVal as unknown[]) : [];
      const cloudHist = Array.isArray(merged[key]) ? (merged[key] as unknown[]) : [];
      for (const rec of [...localHist, ...cloudHist]) {
        const k = JSON.stringify(rec);
        if (seen.has(k)) continue;
        seen.add(k);
        union.push(rec);
      }
      merged[key] = union.slice(0, 20);
    } else if (key === 'best' || key === 'exams' || key === 'correct') {
      // Numbers (AppState: best/exams/correct): Math.max — monotone, never
      // loses the better value. A fresh device's best:0 must not clobber a
      // cloud best:8; a better local score survives. Type mismatch (corrupt
      // local value) falls through to the local-wins catch-all.
      const cloudVal = merged[key];
      merged[key] =
        typeof localVal === 'number' && typeof cloudVal === 'number'
          ? Math.max(localVal, cloudVal)
          : localVal;
    } else if (key === 'starred' || key === 'vocabKnown') {
      // Boolean maps (AppState: starred/vocabKnown): shallow union —
      // cloud-only keys kept, local wins per key. A fresh device's empty
      // {} cannot clobber the cloud map; a local {a:false} over cloud
      // {a:true} → {a:false}. Type mismatch → local-wins catch-all.
      const cloudVal = merged[key];
      if (isRecord(localVal) && isRecord(cloudVal)) {
        merged[key] = { ...cloudVal, ...localVal };
      } else {
        merged[key] = localVal;
      }
    } else if (key === 'marked') {
      // Notebook marks (AppState: marked — string[]): union cloud + local,
      // JSON-key dedupe (same style as `hist` above), no cap. A fresh
      // device's [] unions away to the cloud marks; a type mismatch /
      // corrupt local falls through to the local-wins catch-all (and still
      // can't 500 the route).
      const cloudMarked = merged[key];
      if (Array.isArray(localVal) && Array.isArray(cloudMarked)) {
        const seen = new Set<string>();
        const union: unknown[] = [];
        for (const rec of [...localVal, ...cloudMarked]) {
          const k = JSON.stringify(rec);
          if (seen.has(k)) continue;
          seen.add(k);
          union.push(rec);
        }
        merged[key] = union;
      } else {
        merged[key] = localVal;
      }
    } else if (key === 'prog') {
      // Per-lesson completion (AppState: prog — subject → lesson → number):
      // per-lesson Math.max — a lesson completed further on either device
      // stays completed; cloud-only subjects/lessons are kept. Type
      // mismatch / corrupt → local-wins catch-all.
      const cloudVal = merged[key];
      if (isRecord(localVal) && isRecord(cloudVal)) {
        const next: Record<string, Record<string, number>> = {
          ...(cloudVal as Record<string, Record<string, number>>),
        };
        for (const [sub, lessons] of Object.entries(localVal)) {
          const cloudLessons = isRecord(next[sub]) ? next[sub] : {};
          const mergedLessons: Record<string, number> = { ...cloudLessons };
          if (isRecord(lessons)) {
            for (const [lesson, pct] of Object.entries(lessons)) {
              mergedLessons[lesson] = Math.max(
                Number(cloudLessons[lesson]) || 0,
                Number(pct) || 0,
              );
            }
          }
          next[sub] = mergedLessons;
        }
        merged[key] = next;
      } else {
        merged[key] = localVal;
      }
    } else {
      // Unknown key / type mismatch / corrupt: local wins. After login the
      // steady state is local-wins (useProgressSync PUTs every local key),
      // so keeping the cloud value here would be the one lossy step.
      merged[key] = localVal;
    }
  }

  // Persist every key (idempotent upsert).
  for (const [key, value] of Object.entries(merged)) {
    await saveUserProgress(userId, key, value);
  }

  return NextResponse.json({ ok: true, progress: merged });
}
