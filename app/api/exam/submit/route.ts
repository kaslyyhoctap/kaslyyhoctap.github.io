/**
 * POST /api/exam/submit
 *
 * Server-side scoring is authoritative. The client sends the full runtime
 * question list (shuffled opts + TF slots) plus its answer array; the server
 * keeps the client's display order but re-derives every correctness flag from
 * the `questions` table, so a forged `opts: [{ok:true},…]` cannot inflate a
 * score. Question ids unknown to the DB are rejected.
 *
 * Authenticated users: result + per-question answer map persisted to DB.
 * Anonymous users: score returned only (client keeps localStorage copy).
 */
import { NextRequest, NextResponse } from 'next/server';
import { scoreExam, serverRuntime, questionStatus, type RuntimeQuestion } from '@/lib/quiz/scoring';
import type { ExamSubmitRequest, ExamSubmitResponse } from '@/lib/api/exam';
import { getQuestionsByIds, saveExamResult, saveUserProgress, getUserProgress } from '@/lib/db/queries';
import { getCurrentUser } from '@/lib/auth-utils';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ExamSubmitRequest;
    const { answers, flags, timeSec, cfg, questions } = body;

    if (!questions?.length || !cfg) {
      return NextResponse.json(
        { error: 'Missing questions or cfg' },
        { status: 400 },
      );
    }

    // ── Authoritative server-side scoring ──────────────────────
    // The runtime objects arrive from the browser, so their correctness flags
    // (`opts[].ok`, `statements[].ok`, `correctAnswer`) are untrusted: reload
    // the questions by id and re-tag them from the DB rows.
    const submitted = questions as RuntimeQuestion[];
    if (submitted.length > 100) {
      return NextResponse.json(
        { error: 'Too many questions (max 100)' },
        { status: 400 },
      );
    }
    const dbRows = await getQuestionsByIds(submitted.map((q) => q.id));
    const byId = new Map(dbRows.map((q) => [q.id, q]));
    const unknown = submitted.find((q) => !byId.has(q.id));
    if (unknown) {
      return NextResponse.json(
        { error: `Unknown question id: ${unknown.id}` },
        { status: 400 },
      );
    }
    // Keep the client's shuffled option/statement order and its answer slots.
    const authoritative = submitted.map((q) => serverRuntime(q, byId.get(q.id)!));

    const score = scoreExam(authoritative, answers, cfg);

    // wrongIds: attempted-but-incorrect question IDs.
    const wrongIds: string[] = authoritative
      .filter((q: RuntimeQuestion, n: number) =>
        questionStatus(q, q, answers[n]) === 'bad',
      )
      .map((q: RuntimeQuestion) => q.id);

    // ── Persist for authenticated users ────────────────────────
    const user = await getCurrentUser();
    const userId = user?.id;
    if (userId) {
      // `lesson` arrives as 'all' for the app's default config and
      // Number('all') is NaN, which Postgres rejects for an integer column.
      // 0 = tổng hợp (all lessons).
      const lessonNum = Number(cfg.lesson);
      const lesson = Number.isNaN(lessonNum) ? 0 : lessonNum;
      await saveExamResult({
        userId: userId,
        subject: cfg.subject,
        lesson,
        point: score.point,
        ok: score.ok,
        // score.bad → exam_results.wrong (DB column name; ExamResultInput uses `wrong`).
        wrong: score.bad,
        skip: score.skip,
        total: score.total,
        timeSeconds: Number.isFinite(timeSec) ? timeSec : null,
        isPractice: cfg.practice,
      });

      // Merge into the existing `answered` map (preserve previous answers).
      const prev = await getUserProgress(userId);
      const prevAnswered = (prev?.answered || {}) as Record<string, string>;
      const nextAnswered: Record<string, string> = { ...prevAnswered };
      authoritative.forEach((q: RuntimeQuestion, n: number) => {
        nextAnswered[q.id] = questionStatus(q, q, answers[n]);
      });
      await saveUserProgress(userId, 'answered', nextAnswered);
    }

    const res: ExamSubmitResponse = { ...score, wrongIds };
    return NextResponse.json(res);
  } catch (err) {
    console.error('[exam/submit]', err);
    return NextResponse.json(
      { error: 'Failed to submit exam' },
      { status: 500 },
    );
  }
}
