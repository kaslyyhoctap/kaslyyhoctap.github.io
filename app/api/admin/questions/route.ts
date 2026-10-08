import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-utils';
import { getQuestions } from '@/lib/db/queries';
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
  const body = await req.json();
  await db.insert(questions).values(body);
  return NextResponse.json({ ok: true });
}
