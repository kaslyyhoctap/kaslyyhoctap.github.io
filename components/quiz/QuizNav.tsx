/**
 * components/quiz/QuizNav.tsx — prev/next/submit controls.
 * Ports app.js navigation handlers (lines 227–236) + quiz-top meta.
 *
 * `QuizTop` is exported here because the header row (title / count / done /
 * progress / flag / star / topic) is part of the same "quiz-top" surface from
 * app.js `renderQ` (lines 199–209).
 */
'use client';

import { TYPES } from '@/lib/meta';
import type { RuntimeQuestion } from '@/lib/quiz/scoring';
import Timer from './Timer';

interface QuizNavProps {
  i: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
  canNext: boolean;
  canPrev: boolean;
  timeLeft: number;
}

export default function QuizNav({
  i,
  total,
  onPrev,
  onNext,
  onSubmit,
  canNext,
  canPrev,
  timeLeft,
}: QuizNavProps) {
  return (
    <div className="q-nav">
      <button
        type="button"
        className="btn btn-ghost"
        id="qPrev"
        disabled={!canPrev}
        onClick={onPrev}
      >
        ← Trước
      </button>
      <button
        type="button"
        className="btn btn-ghost"
        id="qNext"
        disabled={!canNext}
        onClick={onNext}
      >
        Tiếp →
      </button>
      <button
        type="button"
        className="btn btn-primary"
        id="qSubmit"
        onClick={onSubmit}
      >
        Nộp bài
      </button>
    </div>
  );
}

/** The header row above the question: title, count, progress, flag, star. */
interface QuizTopProps {
  subject: string;
  subjectName: string;
  /** 'all' | single lesson | several checked lessons (checkbox UI). */
  lesson: 'all' | string | number | (string | number)[];
  units: string;
  /** 'all' | single type | several checked types (checkbox UI). */
  qtype?: 'all' | string | string[];
  quick?: boolean;
  practice: boolean;
  i: number;
  total: number;
  doneCount: number;
  progressPct: number;
  flagged: boolean;
  onToggleFlag: () => void;
  starred: boolean;
  onToggleStar: () => void;
  q: RuntimeQuestion;
  timeLeft: number;
}

export function QuizTop({
  subject,
  subjectName,
  lesson,
  units,
  qtype,
  quick,
  practice,
  i,
  total,
  doneCount,
  progressPct,
  flagged,
  onToggleFlag,
  starred,
  onToggleStar,
  q,
  timeLeft,
}: QuizTopProps) {
  const isEnglish = subject === 'english';
  const lessonLabel = Array.isArray(lesson) ? lesson.join(', ') : lesson;
  const scope =
    lesson === 'all' ? ' · Tổng hợp' : ` · ${units} ${lessonLabel}`;
  // Checkbox era: qtype is 'all' | one type | several; show the mix label.
  const qtypeLabel = Array.isArray(qtype)
    ? qtype.map((t) => TYPES[t]).join('+')
    : qtype && qtype !== 'all'
      ? TYPES[qtype]
      : '';
  const kind = isEnglish && qtypeLabel ? ` · ${qtypeLabel}` : '';
  const title = `${quick ? 'Kiểm tra nhanh · ' : practice ? 'Luyện tập · ' : 'Kiểm tra · '}${subjectName}${scope}${kind}`;

  return (
    <div className="quiz-top panel">
      <div className="quiz-meta">
        <span id="qTitle">{title}</span>
        <Timer seconds={timeLeft} />
      </div>

      <div id="qFlagRow">
        <span id="qCount">Câu {i + 1}/{total}</span>
        <button
          type="button"
          className="btn btn-sm btn-act"
          id="qFlag"
          onClick={onToggleFlag}
          aria-pressed={flagged}
        >
          <FlagIcon active={flagged} />
          Đánh dấu
        </button>
        <button
          type="button"
          className="btn btn-sm btn-act"
          id="qStar"
          onClick={onToggleStar}
          aria-pressed={starred}
        >
          <StarIcon active={starred} />
          Sổ tay
        </button>
      </div>

      <div className="progress">
        <div
          id="qProg"
          className="progress-fill"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="quiz-sub">
        <span id="qDone">Đã làm: {doneCount}</span>
      </div>
    </div>
  );
}

/** Flag (Đánh dấu) — outline when off, filled when on. */
function FlagIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 21V4" />
      <path d="M5 4h12l-2.5 4L17 12H5" />
    </svg>
  );
}

/** Star (Sổ tay) — outline when off, filled when on. */
function StarIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z" />
    </svg>
  );
}
