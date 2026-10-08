/**
 * components/quiz/Options.tsx — MCQ option buttons (A/B/C/D).
 * Ports app.js `renderQ` option rendering (lines 213–218) + practice feedback.
 */
'use client';

import { chemFormat, LETTERS } from '@/lib/quiz/render';
import type { RuntimeQuestion } from '@/lib/quiz/scoring';

interface OptionsProps {
  q: RuntimeQuestion;
  /** Index of the selected option in the (shuffled) `q.opts`, or -1. */
  selected: number;
  onSelect: (idx: number) => void;
  practice: boolean;
}

export default function Options({ q, selected, onSelect, practice }: OptionsProps) {
  const isChem = q.subject === 'chemistry';
  const answered = selected >= 0;

  return (
    <div id="qOpts">
      {q.opts.map((op, idx) => {
        const cls: string[] = ['opt'];
        if (selected === idx) cls.push('sel');
        if (practice && answered) {
          if (op.ok) cls.push('practice-ok');
          else if (idx === selected) cls.push('practice-bad');
        }
        return (
          <button
            key={idx}
            type="button"
            role="radio"
            aria-checked={selected === idx}
            className={cls.join(' ')}
            onClick={() => onSelect(idx)}
          >
            <span className="k">{LETTERS[idx]}</span>
            {isChem ? (
              <span dangerouslySetInnerHTML={{ __html: chemFormat(op.t) }} />
            ) : (
              <span>{op.t}</span>
            )}
            {practice && answered && op.ok && ' \u2713'}
            {practice && answered && !op.ok && idx === selected && ' \u2717'}
          </button>
        );
      })}

      {practice && answered && (
        <div className="rev exp">
          <b>Giải thích:</b>{' '}
          {isChem ? (
            <span dangerouslySetInnerHTML={{ __html: chemFormat(q.explanation) }} />
          ) : (
            q.explanation
          )}
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
