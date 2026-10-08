/**
 * components/quiz/QuizView.tsx — main quiz container.
 *
 * Reads the question bank + passages passed from the server page, derives the
 * "recently answered" map from localStorage history (app.js `recentMap`),
 * boots the quiz via `useQuiz`, and renders the full quiz surface: header,
 * question card, options/TF, palette, and navigation.
 *
 * Client component: timers, keyboard shortcuts (1-4 / ← / →), and the
 * `beforeunload` guard all live here.
 */
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { META, subjectUnits } from '@/lib/meta';
import { useQuiz } from '@/lib/hooks/useQuiz';
import { buildRecentMap } from '@/lib/quiz/pool';
import { readAppState } from '@/lib/storage';
import type { Question } from '@/lib/types';
import type { ExamConfig } from '@/lib/quiz/pool';
export type { PassageMap } from './QuestionCard';
import QuestionCard, { type PassageMap } from './QuestionCard';
import QuestionPalette from './QuestionPalette';
import QuizNav, { QuizTop } from './QuizNav';

interface QuizViewProps {
  cfg: ExamConfig;
  questions: Question[];
  passages: PassageMap;
}

export default function QuizView({ cfg, questions, passages }: QuizViewProps) {
  const quiz = useQuiz(cfg);
  const router = useRouter();

  // Boot the exam once on mount: build the recent-answered map from localStorage
  // history (app.js `recentMap`), then start. Mirrors app.js `startExam`.
  useEffect(() => {
    // If coming from /ai/generate, prefer the AI-generated questions stored
    // in sessionStorage (they live outside the DB bank).
    let qsFromSession: Question[] | null = null;
    const aiRaw = sessionStorage.getItem('ontap12-ai-quiz');
    if (aiRaw) {
      sessionStorage.removeItem('ontap12-ai-quiz');
      try {
        const parsed = JSON.parse(aiRaw);
        if (Array.isArray(parsed?.questions) && parsed.questions.length > 0) {
          qsFromSession = parsed.questions as Question[];
        }
      } catch {
        /* invalid JSON — fall through to DB questions */
      }
    }

    const toStart = qsFromSession ?? questions;
    const hist = readAppState().hist || [];
    const answeredMap = buildRecentMap(
      (hist || []).map((h: any) => h?.ids || []),
    );
    quiz.start(toStart, answeredMap);
    // We intentionally depend only on mount (questions/cfg are stable props).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!quiz.started || quiz.qs.length === 0) {
    return (
      <div className="panel">
        <p className="muted">Không có câu hỏi nào phù hợp với bộ lọc.</p>
      </div>
    );
  }

  const q = quiz.current!;
  const subjectName = META[cfg.subject]?.name ?? cfg.subject;
  const units = subjectUnits(cfg.subject);

  // Container keydown dispatcher (app.js keyboard handler, lines 231–235).
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => quiz.onKeyDown(e);

  // Submit handler: score, store result in sessionStorage, navigate to /result
  // (app.js `submit()` → `go("result")`, lines 239–302).
  const handleResult = () => {
    const score = quiz.submit();
    const elapsedSecs = cfg.time * 60 - quiz.timeLeft;
    const timeout = quiz.timeLeft <= 0;
    sessionStorage.setItem(
      'ontap12-result',
      JSON.stringify({
        score,
        qs: quiz.qs,
        ans: quiz.ans,
        cfg,
        passages,
        elapsedSecs,
        timeout,
      }),
    );
    router.push('/result');
  };

  return (
    <div
      className="quiz"
      id="qRoot"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      aria-label="Bài kiểm tra"
    >
      <QuizTop
        subject={cfg.subject}
        subjectName={subjectName}
        lesson={cfg.lesson}
        units={units}
        qtype={cfg.qtype}
        quick={cfg.quick}
        practice={cfg.practice}
        i={quiz.i}
        total={quiz.qs.length}
        doneCount={quiz.doneCount}
        progressPct={quiz.progressPct}
        flagged={quiz.flag[quiz.i]}
        onToggleFlag={quiz.toggleFlag}
        starred={!!quiz.starred[q.id]}
        onToggleStar={quiz.toggleStar}
        q={q}
        timeLeft={quiz.timeLeft}
      />

      <div className="quiz-grid">
        <QuestionCard
          q={q}
          index={quiz.i}
          total={quiz.qs.length}
          selected={quiz.ans[quiz.i]}
          tf={q.tf}
          practice={cfg.practice}
          onSelect={quiz.answer}
          onTF={quiz.tfAnswer}
          passages={passages}
        />

        <div className="palette">
          <h3>Danh sách câu hỏi</h3>
          <div className="legend">
            <span><span className="dot d-todo" /> Chưa làm</span>
            <span><span className="dot d-done" /> Đã làm</span>
            <span><span className="dot d-cur" /> Hiện tại</span>
            <span><span className="dot d-flag" /> Đánh dấu</span>
          </div>
          <QuestionPalette
            qs={quiz.qs}
            ans={quiz.ans}
            flag={quiz.flag}
            i={quiz.i}
            onGoto={quiz.goTo}
          />
        </div>
      </div>

      <QuizNav
        i={quiz.i}
        total={quiz.qs.length}
        onPrev={quiz.prev}
        onNext={quiz.next}
        onSubmit={handleResult}
        canNext={quiz.i < quiz.qs.length - 1}
        canPrev={quiz.i > 0}
        timeLeft={quiz.timeLeft}
      />
    </div>
  );
}
