/**
 * app/quiz/page.tsx — quiz entry point (Server Component).
 *
 * Parses exam config from URL search params (built by `buildQuizUrl`),
 * fetches the full subject question bank + passages from the DB, and hands
 * them to the client-side <QuizView>. Pool selection + timer + localStorage
 * history all happen client-side (mirroring app.js where `Q` was the global
 * bank and `recentMap()` read `S.hist`).
 *
 * Next.js 16 breaking change: `searchParams` is a Promise — must `await`.
 */
import Link from 'next/link';
import { getQuestions, getPassages } from '@/lib/db/queries';
import { type ExamConfig } from '@/lib/quiz/pool';
import QuizView, { type PassageMap } from '@/components/quiz/QuizView';

export const metadata = {
  title: 'Trắc nghiệm',
};

export default async function QuizPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  // All values arrive as strings from the URL (see buildQuizUrl).
  const subject = (sp.subject as string) || 'history';
  const lesson = sp.lesson ? String(sp.lesson) : 'all';
  const count = Number(sp.count) || 20;
  const time = Number(sp.time) || 20;
  const practice = (sp.practice as string | undefined) === 'true';
  const level = (sp.level as string) || 'all';
  const qtype = (sp.qtype as string) || 'all';
  const shQ = sp.shQ !== 'false';
  const shA = sp.shA !== 'false';
  const quick = (sp.quick as string | undefined) === 'true';
  const ids = sp.ids
    ? (Array.isArray(sp.ids) ? sp.ids : (sp.ids as string).split(',')).filter(Boolean)
    : undefined;

  const cfg: ExamConfig = {
    subject,
    lesson,
    count,
    time,
    level,
    qtype,
    practice,
    shQ,
    shA,
    quick,
    ids,
  };

  let questions: Awaited<ReturnType<typeof getQuestions>> = [];
  let passages: PassageMap = {};
  let error: string | null = null;

  try {
    // Fetch the full subject bank (pool filters it internally, mirroring the
    // global `Q` in app.js).
    [questions, passages] = await Promise.all([
      getQuestions({ subject }),
      getPassages(),
    ]);
  } catch (err) {
    console.error('[QuizPage] DB fetch failed:', err);
    error = 'Không thể tải câu hỏi. Vui lòng thử lại sau.';
  }

  if (error) {
    return (
      <>
        <Link href={`/${subject}`} className="link">
          ← {subject}
        </Link>
        <div className="panel">
          <p className="muted">{error}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Link href={`/${subject}`} className="link">
        ← {subject}
      </Link>
      <QuizView cfg={cfg} questions={questions} passages={passages} />
    </>
  );
}
