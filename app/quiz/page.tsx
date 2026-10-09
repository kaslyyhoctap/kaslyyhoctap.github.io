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
import { clampInt, type ExamConfig } from '@/lib/quiz/pool';
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
  // Comma-joined lists (checkbox UI) become arrays: lesson=1,3 qtype=a,b.
  const parseList = (v: string | string[] | undefined): string | string[] | undefined =>
    typeof v === 'string' && v.includes(',') ? v.split(',') : v;
  const subject = (sp.subject as string) || 'history';
  const lesson = (parseList(sp.lesson as string) ?? 'all') as ExamConfig['lesson'];
  // B06: `Number(x) || default` passes negatives — count=-5 selected 85
  // questions, time=-5 instant-submitted. Clamp at the page (inputs owner).
  const count = clampInt(sp.count, 1, 100, 20);
  const time = clampInt(sp.time, 1, 180, 20);
  const practice = (sp.practice as string | undefined) === 'true';
  const level = (sp.level as string) || 'all';
  const qtype = (parseList(sp.qtype as string) ?? 'all') as ExamConfig['qtype'];
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
