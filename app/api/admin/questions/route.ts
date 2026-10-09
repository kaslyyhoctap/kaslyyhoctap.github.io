import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-utils';
import { getQuestions } from '@/lib/db/queries';
import { validateQuestionInput } from '@/lib/admin-questions';
import { db } from '@/db';
import { questions } from '@/db/schema';

export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const subject = searchParams.get('subject') || undefined;
  const qs = await getQuestions({ subject, limit: 100 });
  return NextResponse.json({ questions: qs });
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const err = validateQuestionInput(body, 'POST');
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    await db.insert(questions).values(body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/questions POST]', err);
    return NextResponse.json({ error: 'Không thể tạo câu hỏi.' }, { status: 500 });
  }
}
