/**
 * POST /api/exam/submit
 *
 * Server-side scoring is authoritative. The client sends the full runtime
 * question list (shuffled opts + TF slots) so scoreExam can reproduce the
 * exact display state.
 *
 * Authenticated users: result + per-question answer map persisted to DB.
 * Anonymous users: score returned only (client keeps localStorage copy).
 */
import { NextRequest, NextResponse } from 'next/server';
import { scoreExam, questionStatus, type RuntimeQuestion } from '@/lib/quiz/scoring';
import type { ExamSubmitRequest, ExamSubmitResponse } from '@/lib/api/exam';
import { saveExamResult, saveUserProgress, getUserProgress } from '@/lib/db/queries';
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
    const score = scoreExam(questions, answers, cfg);

    // wrongIds: attempted-but-incorrect question IDs.
    const wrongIds: string[] = questions
      .filter((q: RuntimeQuestion, n: number) =>
        questionStatus(q, q, answers[n]) === 'bad',
      )
      .map((q: RuntimeQuestion) => q.id);

    // ── Persist for authenticated users ────────────────────────
    const user = await getCurrentUser();
    const userId = user?.id;
    if (userId) {
      await saveExamResult({
        userId: userId,
        subject: cfg.subject,
        lesson: Number(cfg.lesson),
        point: score.point,
        ok: score.ok,
        wrong: score.bad,
        skip: score.skip,
        total: score.total,
        timeSeconds: timeSec,
        isPractice: cfg.practice,
      });

      // Merge into the existing `answered` map (preserve previous answers).
      const prev = await getUserProgress(userId);
      const prevAnswered = (prev?.answered || {}) as Record<string, string>;
      const nextAnswered: Record<string, string> = { ...prevAnswered };
      questions.forEach((q: RuntimeQuestion, n: number) => {
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
