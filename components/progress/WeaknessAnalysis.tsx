/**
 * WeaknessAnalysis — port of app.js `weakStats()` + `renderWeak()` (lines 411–449).
 *
 * Client component. Self-contained: imports the question bank directly (the
 * static `data/questions.json`, as permitted by the task) and reads the
 * answered map from localStorage via `useAppState`. The pure aggregation
 * `computeWeakAreas` (lib/db/queries) groups attempted questions by
 * (subject, topic, difficulty), keeps groups with ≥ 3 attempts, sorts worst
 * by accuracy, and returns the top 3.
 *
 * Each row has a "Luyện 10 câu" drill button that builds a `/quiz` URL over the
 * exact question ids in that weak group (QuizParams.ids), mirroring app.js
 * `startExam(cfg)` with `ids` (app.js line 298 / ResultView handleDrill).
 */
'use client';

import { useRouter } from 'next/navigation';
import { useAppState } from '@/lib/storage';
import { subjectShort } from '@/lib/meta';
import { computeWeakAreas } from '@/lib/db/queries';
import { buildQuizUrl } from '@/lib/quiz/urls';
import type { Question, WeakArea } from '@/lib/types';
import questions from '@/data/questions.json';

const Q = questions as unknown as Question[];

/**
 * Find every question id that belongs to a weak group (subject + topic +
 * difficulty). `computeWeakAreas` derives its group key as
 * `q.topic ?? ''` / `q.difficulty ?? ''`, so we mirror that null-coalescing
 * to match the same set.
 */
function idsForArea(w: WeakArea): string[] {
  return Q.filter(
    (q) =>
      q.subject === w.subject &&
      (q.topic ?? '') === (w.topic ?? '') &&
      (q.difficulty ?? '') === (w.difficulty ?? ''),
  ).map((q) => q.id);
}

/** Label for a weak area (app.js used `w.label`). */
function weakLabel(w: WeakArea): string {
  const parts: string[] = [w.topic || 'Chủ đề khác', subjectShort(w.subject)];
  if (w.difficulty) parts.push(w.difficulty);
  return parts.join(' · ');
}

export default function WeaknessAnalysis() {
  const router = useRouter();
  const { answered } = useAppState();

  // computeWeakAreas skips unanswered/skipped rows internally; passing the full
  // bank mirrors app.js `weakStats()` which iterated the global `Q`. Each
  // question is projected to the aggregator's `AttemptedQuestion` shape so the
  // optional `topic`/`difficulty` are normalised (the pure function handles
  // those via `?? ''` internally).
  const attemptedLike = Q.map((q) => ({
    id: q.id,
    subject: q.subject,
    topic: q.topic ?? '',
    difficulty: q.difficulty ?? null,
  }));
  const weak = computeWeakAreas(attemptedLike, answered);

  const handleDrill = (w: WeakArea) => {
    const ids = idsForArea(w);
    if (!ids.length) return;
    router.push(
      buildQuizUrl({
        subject: w.subject,
        lesson: 'all',
        count: Math.min(10, ids.length),
        time: 10,
        practice: true,
        level: 'all',
        qtype: 'all',
        shQ: true,
        shA: true,
        ids,
      }),
    );
  };

  if (!weak.length) {
    return (
      <div id="weakBox">
        <p className="muted">
          Chưa đủ dữ liệu — làm thêm bài để có phân tích (mỗi nhóm cần tối thiểu 3
          câu đã làm).
        </p>
      </div>
    );
  }

  return (
    <div id="weakBox">
      {weak.map((w, i) => {
        const acc = Math.round(w.accuracy * 100);
        return (
          <div className="prog-row" key={`${w.subject}|${w.topic}|${w.difficulty ?? ''}`}>
            <div className="lbl">
              <span>
                {i === 0 && <span className="tag bad">Yếu nhất</span>} {weakLabel(w)}
              </span>
              <span>{`${w.correct}/${w.total} đúng · ${acc}%`}</span>
            </div>
            <div className="pbar">
              <i style={{ width: `${acc}%` }}></i>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => handleDrill(w)}
              >
                Luyện 10 câu phần này
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
