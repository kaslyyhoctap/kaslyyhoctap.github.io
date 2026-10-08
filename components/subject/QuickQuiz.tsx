/**
 * Quick-quiz button — ports `$("quickBtn").onclick` from app.js line 108.
 *
 * On click, picks a random subject from `SUBJECTS` and navigates to `/quiz`
 * with a fixed exam config (lesson="all", count=10, time=10, quick=true).
 *
 * Client component because the random pick happens at click time.
 */
'use client';

import { useRouter } from 'next/navigation';
import { SUBJECTS } from '@/lib/meta';
import { buildQuizUrl } from '@/lib/quiz/urls';

export default function QuickQuiz() {
  const router = useRouter();

  const startQuick = () => {
    const subject = SUBJECTS[Math.floor(Math.random() * SUBJECTS.length)];
    router.push(
      buildQuizUrl({
        subject,
        lesson: 'all',
        count: 10,
        time: 10,
        level: 'all',
        qtype: 'all',
        practice: false,
        shQ: true,
        shA: true,
        quick: true,
      }),
    );
  };

  return (
    <button
      type="button"
      className="btn btn-primary btn-sm"
      onClick={startQuick}
      aria-label="Kiểm tra nhanh (ngẫu nhiên)"
    >
      Kiểm tra nhanh
    </button>
  );
}
