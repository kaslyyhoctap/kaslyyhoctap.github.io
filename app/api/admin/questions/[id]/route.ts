import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-utils';
import { validateQuestionInput } from '@/lib/admin-questions';
import { db } from '@/db';
import { questions } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = await req.json();
    const err = validateQuestionInput(body, 'PUT');
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    await db.update(questions).set(body).where(eq(questions.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/questions PUT]', err);
    return NextResponse.json({ error: 'Không thể cập nhật câu hỏi.' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  await db.delete(questions).where(eq(questions.id, id));
  return NextResponse.json({ ok: true });
}
