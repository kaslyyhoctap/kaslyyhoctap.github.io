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
    // B04/N2: raw parseInt/Number let NaN drop the LIMIT clause (full-table
    // dump) and negatives/NaN 500 at the SQL layer — clamp everything here.
    const limitRaw = Number(searchParams.get('limit') ?? 50);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(200, Math.max(1, Math.floor(limitRaw)))
      : 50;
    const offsetRaw = Number(searchParams.get('offset') ?? 0);
    const offset = Number.isFinite(offsetRaw) ? Math.max(0, Math.floor(offsetRaw)) : 0;

    let lesson: number | undefined;
    if (lessonStr !== null && lessonStr !== '') {
      const n = Number(lessonStr);
      if (!Number.isInteger(n)) {
        return NextResponse.json(
          { error: 'Tham số lesson không hợp lệ.' },
          { status: 400 },
        );
      }
      lesson = n;
    }

    // Shared filter set — passed to both getQuestions and countQuestions.
    const filterOpts: Record<string, string | number | undefined> = {
      subject: subject || undefined,
      lesson,
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
