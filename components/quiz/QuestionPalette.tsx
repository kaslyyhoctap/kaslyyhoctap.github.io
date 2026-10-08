/**
 * components/quiz/QuestionPalette.tsx — numbered grid of questions.
 * Ports app.js palette rendering (lines 219–222).
 */
'use client';

import { typeOf } from '@/lib/quiz/pool';
import type { RuntimeQuestion } from '@/lib/quiz/scoring';

interface QuestionPaletteProps {
  qs: RuntimeQuestion[];
  ans: number[];
  flag: boolean[];
  i: number;
  onGoto: (idx: number) => void;
}

function qDoneN(q: RuntimeQuestion, ans: number[], n: number): boolean {
  if (typeOf(q) === 'true_false') return q.tf.some((v) => v >= 0);
  return ans[n] >= 0;
}

export default function QuestionPalette({ qs, ans, flag, i, onGoto }: QuestionPaletteProps) {
  return (
    <div className="pal" id="qPal" aria-label="Danh sách câu hỏi">
      {qs.map((s, n) => {
        const done = qDoneN(s, ans, n);
        const cls = `${done ? 'done ' : ''}${n === i ? 'cur' : ''}`;
        return (
          <button
            key={n}
            type="button"
            className={cls + (flag[n] ? ' flag' : '')}
            aria-label={`Câu ${n + 1}${done ? ' đã làm' : ' chưa làm'}`}
            onClick={() => onGoto(n)}
          >
            {n + 1 < 10 ? `0${n + 1}` : n + 1}
          </button>
        );
      })}
    </div>
  );
}
