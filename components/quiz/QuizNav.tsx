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
import { chemFormat, escapeHtml } from '@/lib/quiz/render';
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
        Sau ở\u00A0→
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
  lesson: string | number;
  units: string;
  qtype?: string;
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
  const scope =
    lesson === 'all' ? ' · Tổng hợp' : ` · ${units} ${lesson}`;
  const kind =
    isEnglish && qtype && qtype !== 'all' ? ` · ${TYPES[qtype]}` : '';
  const title = `${quick ? 'Kiểm tra nhanh · ' : practice ? 'Luyện tập · ' : 'Kiểm tra · '}${subjectName}${scope}${kind}`;

  const topicParts = [q.topic];
  if (isEnglish && q.type && TYPES[q.type].toLowerCase() !== String(q.topic).toLowerCase()) {
    topicParts.push(TYPES[q.type]);
  }
  topicParts.push(q.difficulty);
  if (q.band) topicParts.push(`Band ${Number(q.band).toFixed(1)}`);
  const topicLabel = topicParts.filter(Boolean).join(' · ');

  return (
    <div className="quiz-top">
      <div className="quiz-meta">
        <span id="qTitle">{title}</span>
        <Timer seconds={timeLeft} />
      </div>

      <div id="qFlagRow">
        <span id="qCount">Câu {i + 1}/{total}</span>
        <button
          type="button"
          className="link"
          id="qFlag"
          onClick={onToggleFlag}
          aria-pressed={flagged}
        >
          {flagged ? '\u2605 ' : '\u2606 '}Đánh dấu xem lại
        </button>
        <button
          type="button"
          className="link"
          id="qStar"
          onClick={onToggleStar}
          aria-pressed={starred}
        >
          {starred ? '\u2605 Sổ tay' : '\u2606 Sổ tay'}
        </button>
      </div>

      <div id="qTopic" className="chip">
        {subject === 'chemistry' ? chemFormat(topicLabel) : escapeHtml(topicLabel)}
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
