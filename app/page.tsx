/**
 * Home page (Task 3.2) — ports `renderHome()` from app.js lines 62–82.
 *
 * Server Component: fetches subject counts + theory from the Neon DB, then
 * composes client-aware sub-components. Progress bars and hero stats are
 * read from localStorage by Hero / SubjectCard / LessonCard via `useAppState`.
 */
import { getSubjects, getQuestions, getTheory } from '@/lib/db/queries';
import { META, badgeCls, btnCls } from '@/lib/meta';
import Hero, { type HeroSubject } from '@/components/home/Hero';
import SubjectCard from '@/components/home/SubjectCard';
import LessonCard from '@/components/home/LessonCard';
import StudyGuide from '@/components/home/StudyGuide';

interface LessonInfo {
  lesson: number;
  title: string;
  description: string;
  count: number;
  /** English only: { typeKey: count } for the LessonCard meta badge. */
  typeCounts?: Record<string, number>;
}

interface SubjectInfo {
  subject: string;
  name: string;
  short: string;
  units: string;
  book: string;
  badgeClass: string;
  btnClass: string;
  count: number;
  lessons: LessonInfo[];
}

async function getHomeData(): Promise<SubjectInfo[]> {
  const subjects = await getSubjects();

  return Promise.all(
    subjects.map(async (subj) => {
      const cfg = META[subj.subject] ?? {
        name: subj.subject,
        short: subj.subject,
        units: 'Bài',
        book: '',
      };

      // Fetch questions (for per-lesson counts) + theory (for titles/descs) in parallel.
      const [questions, theories] = await Promise.all([
        getQuestions({ subject: subj.subject }),
        Promise.all(subj.lessons.map((l) => getTheory(subj.subject, l))),
      ]);

      // Count questions per lesson (server-side — only the count is passed to client).
      const lessonCounts: Record<number, number> = {};
      for (const q of questions) {
        lessonCounts[q.lesson] = (lessonCounts[q.lesson] || 0) + 1;
      }

      // English: per-lesson type counts for the meta badge.
      const engTypeCounts: Record<number, Record<string, number>> = {};
      if (subj.subject === 'english') {
        for (const q of questions) {
          if (q.type) {
            const m = (engTypeCounts[q.lesson] ||= {});
            m[q.type] = (m[q.type] || 0) + 1;
          }
        }
      }

      const lessons: LessonInfo[] = subj.lessons.map((l, i) => {
        const th = theories[i];
        return {
          lesson: l,
          title: th?.title ?? `${cfg.units} ${l}`,
          description: th?.description ?? '',
          count: lessonCounts[l] ?? 0,
          typeCounts:
            subj.subject === 'english' ? engTypeCounts[l] : undefined,
        };
      });

      return {
        subject: subj.subject,
        name: cfg.name,
        short: cfg.short,
        units: cfg.units,
        book: cfg.book,
        badgeClass: badgeCls(subj.subject),
        btnClass: btnCls(subj.subject),
        count: subj.count,
        lessons,
      };
    }),
  );
}

export default async function HomePage() {
  let subjects: SubjectInfo[] = [];
  let totalQuestions = 0;

  try {
    subjects = await getHomeData();
    totalQuestions = subjects.reduce((sum, s) => sum + s.count, 0);
  } catch (err) {
    console.error('[HomePage] DB fetch failed:', err);
  }

  // Compact subject data for Hero (CTA buttons + progress bars).
  const heroSubjects: HeroSubject[] = subjects.map((s) => ({
    subject: s.subject,
    name: s.name,
    short: s.short,
    units: s.units,
    lessons: s.lessons.map((l) => l.lesson),
  }));

  // --- Subject cards (one per subject) ---
  const subjectCards = subjects.map((s) => (
    <SubjectCard
      key={s.subject}
      subject={s.subject}
      name={s.name}
      short={s.short}
      units={s.units}
      book={s.book}
      count={s.count}
      lessons={s.lessons.map((l) => l.lesson)}
    />
  ));

  // --- Lesson cards (only lessons that have theory, across all subjects) ---
  const lessonCards = subjects
    .flatMap((s) =>
      s.lessons
        .filter((l) => l.title && l.title.trim())
        .map((l) => ({ subject: s.subject, subjectName: s.name, ...l })),
    )
    .map((item) => (
      <LessonCard
        key={`${item.subject}-${item.lesson}`}
        subject={item.subject}
        subjectName={item.subjectName}
        lesson={item.lesson}
        title={item.title}
        description={item.description}
        count={item.count}
        typeCounts={item.typeCounts}
      />
    ));

  return (
    <>
      <Hero totalQuestions={totalQuestions} subjects={heroSubjects} />

      <h2 className="sec-t">Chọn môn học</h2>
      <div className="grid2" id="subjectCards">
        {subjectCards}
      </div>

      <h2 className="sec-t">Bài học nổi bật</h2>
      <div className="grid3" id="lessonCards">
        {lessonCards}
      </div>

      <StudyGuide />
    </>
  );
}
