/**
 * components/quiz/ShortAnswerInput.tsx — text input for short_answer questions.
 * Mirrors TrueFalseGrid (app.js `renderSA`, line 248): a plain `<input
 * id="saIn">` capped by `maxLen`, with practice-mode ok/bad coloring applied
 * only after the user has typed an answer — never before.
 *
 * The answer key is never rendered here (practice reveal shows only the
 * coloring; the key appears post-submit in the result review).
 */
'use client';

import { saOk } from '@/lib/quiz/scoring';
import type { RuntimeQuestion } from '@/lib/quiz/scoring';

interface ShortAnswerInputProps {
  q: RuntimeQuestion;
  /** The user's typed candidate string ('' = unanswered). */
  value: string;
  onChange: (value: string) => void;
  practice: boolean;
}

export default function ShortAnswerInput({ q, value, onChange, practice }: ShortAnswerInputProps) {
  const answered = value !== '';
  const cls =
    practice && answered ? (saOk(value, q.answer) ? 'practice-ok' : 'practice-bad') : '';
  return (
    <div id="qOpts">
      <input
        id="saIn"
        className={cls || undefined}
        value={value}
        maxLength={q.maxLen ?? undefined}
        placeholder={`Nhập đáp án${q.maxLen ? ` (tối đa ${q.maxLen} kí tự)` : ''}`}
        aria-label="Đáp án ngắn"
        autoComplete="off"
        onChange={(e) => onChange(e.target.value.slice(0, q.maxLen ?? undefined))}
      />
      {practice && answered && (
        <div className="rev exp">
          <b>Đáp án đúng:</b> {q.answer}
          <br />
          <b>Giải thích:</b> {q.explanation}
          {q.wrongWord && (
            <>
              <br />
              <b>Từ sai:</b> {q.wrongWord} → <b>nên dùng:</b> {q.correctWord || ''}
            </>
          )}
        </div>
      )}
    </div>
  );
}
