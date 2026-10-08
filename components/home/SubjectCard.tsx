/**
 * Subject card for the home page — ports app.js `renderHome()` subject cards
 * (lines 65–70).
 *
 * Client component: reads per-subject progress from localStorage via
 * `useAppState`. Receives all other data (count, lessons, display info) as
 * props from the server (DB-backed `getSubjects()`).
 */
'use client';

import Link from 'next/link';
import { useAppState, subjProg } from '@/lib/storage';
import { badgeCls, btnCls } from '@/lib/meta';

export interface SubjectCardProps {
  subject: string;
  name: string;
  short: string;
  units: string;
  book: string;
  count: number;
  lessons: number[];
}

export default function SubjectCard({
  subject,
  name,
  short,
  units,
  book,
  count,
  lessons,
}: SubjectCardProps) {
  const state = useAppState();
  const prog = subjProg(subject, lessons, state.prog);

  return (
    <div className="panel subj-card">
      <div className="top">
        <span className={`badge ${badgeCls(subject)}`}>{name}</span>
        <h3>{name}</h3>
        <p className="muted">
          {lessons.length} {units} · {count} câu hỏi · {book}
        </p>
        <div
          className="pbar"
          role="progressbar"
          aria-valuenow={prog}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Tiến độ ${name}`}
        >
          <i style={{ width: `${prog}%` }}></i>
        </div>
        <p className="small muted">Tiến độ {prog}%</p>
        <div className="row">
          <Link href={`/${subject}`} className={`btn ${btnCls(subject)}`}>
            Bắt đầu học
          </Link>
        </div>
      </div>
    </div>
  );
}
