/**
 * GET /api/questions
 *
 * Paginated, filterable question listing.
 *
 * Query:  ?subject=&lesson=&type=&difficulty=&topic=&limit=50&offset=0
 * Res:    { questions: Question[], total: number }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getQuestions, countQuestions } from '@/lib/db/queries';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const subject = searchParams.get('subject');
    const lessonStr = searchParams.get('lesson');
    const type = searchParams.get('type');
    const difficulty = searchParams.get('difficulty');
    const topic = searchParams.get('topic');
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);

    // Shared filter set — passed to both getQuestions and countQuestions.
    const filterOpts: Record<string, string | number | undefined> = {
      subject: subject || undefined,
      lesson: lessonStr ? Number(lessonStr) : undefined,
      type: type || undefined,
      difficulty: difficulty || undefined,
      topic: topic || undefined,
    };

    const [questions, total] = await Promise.all([
      getQuestions({ ...filterOpts, limit, offset }),
      countQuestions(filterOpts),
    ]);

    return NextResponse.json({ questions, total });
  } catch (err) {
    console.error('[questions]', err);
    return NextResponse.json(
      { error: 'Failed to fetch questions' },
      { status: 500 },
    );
  }
}
