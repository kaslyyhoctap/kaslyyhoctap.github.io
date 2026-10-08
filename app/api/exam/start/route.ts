/**
 * POST /api/exam/start
 *
 * Fetches the full question bank for `subject`, then selects `count` questions
 * via pool() according to the exam config.
 *
 * Anonymous users receive questions only.
 * Authenticated users: auth() is called but no draft record is created (YAGNI).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getQuestions } from '@/lib/db/queries';
import { pool, type ExamConfig, type AnsweredMap } from '@/lib/quiz/pool';
import type { ExamStartRequest, ExamStartResponse } from '@/lib/api/exam';
import { getCurrentUser } from '@/lib/auth-utils';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ExamStartRequest;
    const {
      subject,
      lesson,
      count = 20,
      time = 15,
      level = 'all',
      qtype = 'all',
      shQ = true,
      shA = true,
      practice = false,
      quick = false,
      ids,
      topic,
      band,
    } = body;

    if (!subject) {
      return NextResponse.json(
        { error: '`subject` is required' },
        { status: 400 },
      );
    }

    // Fetch the full subject bank — pool() needs the complete set to handle
    // english passage-block logic (fullLen across entire bank).
    const allQuestions = await getQuestions({ subject });

    const cfg: ExamConfig = {
      subject,
      lesson: lesson ?? 'all',
      count,
      time,
      level,
      qtype,
      shQ,
      shA,
      practice,
      quick,
      ids,
      topic,
      band,
    };

    // Answered-map for fresh-question deprioritisation (pool → pickFresh).
    // Anonymous users have no history. Authenticated users' history is YAGNI
    // for now — pass empty map.
    const answeredMap: AnsweredMap = {};

    const selected = pool(allQuestions, cfg, answeredMap);

    // Warm auth() for downstream use — no draft record created (YAGNI).
    await getCurrentUser();

    const res: ExamStartResponse = {
      questions: selected,
      examId: undefined,
    };
    return NextResponse.json(res);
  } catch (err) {
    console.error('[exam/start]', err);
    return NextResponse.json(
      { error: 'Failed to start exam' },
      { status: 500 },
    );
  }
}
