/**
 * Lesson list for the subject view — ports app.js `renderSubject()`
 * lesson cards (lines 97–102).
 *
 * Client component: reads per-lesson progress from localStorage via
 * `useAppState`. Receives theory titles, question counts, and English
 * type-counts from the server DB.
 */
'use client';

import Link from 'next/link';
import { useAppState, lessonProg } from '@/lib/storage';
import { TYPES } from '@/lib/meta';
import { buildQuizUrl } from '@/lib/quiz/urls';

export interface LessonData {
  lesson: number;
  title: string;
  description: string;
  count: number;
  /** English only: { typeKey: count } for the meta badge. */
  typeCounts?: Record<string, number>;
}

interface LessonListProps {
  subject: string;
  subjectName: string;
  units: string;
  totalCount: number;
  lessons: LessonData[];
}

export default function LessonList({
  subject,
  subjectName,
  units,
  totalCount,
  lessons,
}: LessonListProps) {
  const state = useAppState();
  const isEnglish = subject === 'english';

  return (
    <div className="grid3" id="subjectLessons">
      {lessons.map((l) => {
        const prog = lessonProg(subject, l.lesson, state.prog);

        // English: show per-type counts; others: fixed difficulty range.
        const metaText = isEnglish && l.typeCounts
          ? Object.keys(TYPES)
              .map((t) => {
                const n = l.typeCounts?.[t] ?? 0;
                return `${n} ${TYPES[t]}`;
              })
              .join(' · ')
          : 'Nhận biết → Vận dụng cao';

        return (
          <div key={l.lesson} className="panel lesson-card">
            <h3>{l.title}</h3>
            <p>{l.description || '\u00A0'}</p>
            <div className="lesson-meta">
              <span className="badge">{l.count} câu</span>
              <span className="badge">{metaText}</span>
            </div>
            <div className="pbar">
              <i style={{ width: `${prog}%` }}></i>
            </div>
            <p className="small muted">Tiến độ {prog}%</p>
            <div className="row">
              <Link
                href={`/${subject}/theory/${l.lesson}`}
                className="btn btn-sm"
              >
                Học lý thuyết
              </Link>
              <Link
                href={buildQuizUrl({
                  subject,
                  lesson: l.lesson,
                  count: 10,
                  time: 10,
                  level: 'all',
                  qtype: isEnglish ? 'all' : 'all',
                  practice: true,
                  shQ: true,
                  shA: true,
                })}
                className="btn btn-sm btn-primary"
              >
                Trắc nghiệm
              </Link>
              <Link
                href={buildQuizUrl({
                  subject,
                  lesson: l.lesson,
                  count: 20,
                  time: 20,
                  level: 'all',
                  qtype: isEnglish ? 'all' : 'all',
                  practice: false,
                  shQ: true,
                  shA: true,
                })}
                className="btn btn-sm btn-ghost"
              >
                Kiểm tra
              </Link>
            </div>
          </div>
        );
      })}

      {/* Tổng hợp card (app.js line 102) */}
      <div className="panel lesson-card">
        <h3>
          Tổng hợp {lessons.length} {units.toLowerCase()}
        </h3>
        <p>
          Đề trộng đủ các {isEnglish ? 'dạng bài' : 'bài học'}, đúng như kiểm tra
          cuối kì.
        </p>
        <div className="lesson-meta">
          <span className="badge">{totalCount} câu</span>
        </div>
        <div className="row">
          <Link
            href={buildQuizUrl({
              subject,
              lesson: 'all',
              count: 20,
              time: 20,
              level: 'all',
              qtype: isEnglish ? 'all' : 'all',
              practice: false,
              shQ: true,
              shA: true,
            })}
            className="btn btn-sm btn-primary"
          >
            Kiểm tra tổng hợp
          </Link>
        </div>
      </div>
    </div>
  );
}
