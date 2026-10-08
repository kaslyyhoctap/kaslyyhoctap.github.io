/**
 * Theory view (Task 3.4) — ports `renderTheory()` from app.js lines 111–114.
 *
 * Server Component: fetches theory HTML from the DB, sanitizes it, and
 * renders with `dangerouslySetInnerHTML`. The legacy stylesheet provides
 * styling for `.theory`, `.key`, `.fig`, `.fx`, etc.
 *
 * Next.js 16 breaking change: `params` is a Promise — must `await`.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTheory } from '@/lib/db/queries';
import { META, SUBJECTS } from '@/lib/meta';
import { sanitizeHtml } from '@/lib/sanitize';
import { buildQuizUrl } from '@/lib/quiz/urls';

export default async function TheoryPage({
  params,
}: {
  params: Promise<{ subject: string; lesson: string }>;
}) {
  const { subject, lesson } = await params;
  const lessonNum = Number(lesson);

  if (!SUBJECTS.includes(subject) || Number.isNaN(lessonNum)) notFound();

  const th = await getTheory(subject, lessonNum);
  if (!th) {
    return (
      <>
        <Link href={`/${subject}`} className="link theory-back">
          ← Quay lại
        </Link>
        <div className="panel">
          <p className="muted">Chưa có lý thuyết cho phần này.</p>
        </div>
      </>
    );
  }

  const cfg = META[subject]!;

  return (
    <>
      <Link href={`/${subject}`} className="link theory-back">
        ← Quay lại
      </Link>

      <article className="panel theory">
        <p className="eyebrow">
          {cfg.name} · {cfg.book}
        </p>
        <h2 style={{ marginTop: 0 }}>{th.title ?? `${cfg.units} ${lessonNum}`}</h2>
        {th.description && <p className="muted">{th.description}</p>}
        {/* Sanitized HTML — strips <script>/event handlers per lib/sanitize.ts */}
        <div
          dangerouslySetInnerHTML={{
            __html: sanitizeHtml(th.html),
          }}
        />
        <div className="row">
          <Link
            href={buildQuizUrl({
              subject,
              lesson: lessonNum,
              count: 10,
              time: 10,
              level: 'all',
              qtype: 'all',
              practice: true,
              shQ: true,
              shA: true,
            })}
            className="btn btn-primary"
          >
            Luyện trắc nghiệm phần này
          </Link>
        </div>
      </article>
    </>
  );
}
