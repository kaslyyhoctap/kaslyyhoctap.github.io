/**
 * Lesson card for the home page "Bài học nổi bật" section — ports app.js
 * `renderHome()` lesson cards (lines 72–76).
 *
 * Client component: reads per-lesson progress from localStorage via
 * `useAppState`. Receives theory metadata + question count from the server.
 */
'use client';

import Link from 'next/link';
import { useAppState, lessonProg } from '@/lib/storage';
import { badgeCls, TYPES } from '@/lib/meta';

export interface LessonCardProps {
  subject: string;
  subjectName: string;
  lesson: number;
  title: string;
  description: string;
  count: number;
  /** English only: question-type counts for this lesson. */
  typeCounts?: Record<string, number>;
}

export default function LessonCard({
  subject,
  subjectName,
  lesson,
  title,
  description,
  count,
  typeCounts,
}: LessonCardProps) {
  const state = useAppState();
  const prog = lessonProg(subject, lesson, state.prog);

  // English: show type counts; other subjects: fixed difficulty range label.
  const metaText = typeCounts
    ? Object.entries(typeCounts)
        .map(([t, n]) => `${n} ${TYPES[t]?.split(' ')[0]}`)
        .filter((s) => s.trim())
        .join(' · ') || '—'
    : 'Nhận biết → Vận dụng cao';

  return (
    <div className="panel lesson-card">
      <span className={`badge ${badgeCls(subject)}`}>{subjectName}</span>
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="lesson-meta">
        <span className="badge">{count} câu</span>
        <span className="badge">{metaText}</span>
      </div>
      <div className="pbar">
        <i style={{ width: `${prog}%` }}></i>
      </div>
      <div className="row">
        <Link
          href={`/${subject}/theory/${lesson}`}
          className="btn btn-sm"
        >
          Học lý thuyết
        </Link>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={(e) => e.preventDefault()}
          aria-label="Luyện ngay (chưa mở)"
        >
          Luyện ngay
        </button>
      </div>
    </div>
  );
}
