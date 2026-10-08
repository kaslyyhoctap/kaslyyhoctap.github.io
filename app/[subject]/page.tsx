/**
 * Subject view (Task 3.3) — ports `renderSubject()` from app.js lines 89–104.
 *
 * Server Component: fetches per-lesson counts + theory from the DB, then
 * delegates to <TestConfig> (client) and <LessonList> (client).
 *
 * Next.js 16 breaking change: `params` is a Promise — must `await`.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSubjects, getQuestions, getTheory } from '@/lib/db/queries';
import { META, SUBJECTS } from '@/lib/meta';
import TestConfig from '@/components/subject/TestConfig';
import LessonList, { type LessonData } from '@/components/subject/LessonList';
import QuickQuiz from '@/components/subject/QuickQuiz';

export default async function SubjectPage({
  params,
}: {
  params: Promise<{ subject: string }>;
}) {
  const { subject } = await params;

  if (!SUBJECTS.includes(subject)) notFound();

  const cfg = META[subject]!;

  let subjects, questions;
  try {
    [subjects, questions] = await Promise.all([
      getSubjects(),
      getQuestions({ subject }),
    ]);
  } catch (err) {
    console.error('[SubjectPage] DB fetch failed:', err);
    return (
      <>
        <Link href="/" className="link">
          ← Trang chủ
        </Link>
        <div className="panel">
          <p className="muted">
            Không thể tải dữ liệu môn học. Vui lòng thử lại sau.
          </p>
        </div>
      </>
    );
  }

  const subj = subjects.find((s) => s.subject === subject);
  if (!subj) notFound();

  // Compute per-lesson question counts + English type counts (server-side).
  const lessonCounts: Record<number, number> = {};
  const engTypeCounts: Record<number, Record<string, number>> = {};
  for (const q of questions) {
    lessonCounts[q.lesson] = (lessonCounts[q.lesson] || 0) + 1;
    if (subject === 'english' && q.type) {
      const m = (engTypeCounts[q.lesson] ||= {});
      m[q.type] = (m[q.type] || 0) + 1;
    }
  }

  // Fetch theory titles/descriptions for each lesson.
  const theories = await Promise.all(
    subj.lessons.map((l) => getTheory(subject, l)),
  );

  const lessons: LessonData[] = subj.lessons.map((l, i) => {
    const th = theories[i];
    return {
      lesson: l,
      title: th?.title ?? `${cfg.units} ${l}`,
      description: th?.description ?? '',
      count: lessonCounts[l] ?? 0,
      typeCounts: subject === 'english' ? engTypeCounts[l] : undefined,
    };
  });

  return (
    <>
      <Link href="/" className="link">
        ← Trang chủ
      </Link>

      <div id="subjectHead" className="panel">
        <h2>
          {cfg.name}{' '}
          <small className="muted">
            · {subj.count} câu · {cfg.units} 1–{subj.lessons.length}
          </small>
        </h2>
        <p className="muted">
          {cfg.book} — chọn {cfg.units.toLowerCase()} để học lý thuyết, luyện trắc
          nghiệm hoặc tạo đề kiểm tra tính giờ.
        </p>
      </div>

      <QuickQuiz />

      <TestConfig subject={subject} lessons={subj.lessons} />

      <LessonList
        subject={subject}
        subjectName={cfg.name}
        units={cfg.units}
        totalCount={subj.count}
        lessons={lessons}
      />
    </>
  );
}
