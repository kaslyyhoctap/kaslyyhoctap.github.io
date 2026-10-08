/**
 * components/quiz/TrueFalseGrid.tsx — Đúng/Sai 4-statement grid.
 * Ports app.js `renderTF` (lines 179–191).
 */
'use client';

import { chemFormat, LETTERS } from '@/lib/quiz/render';
import type { RuntimeQuestion } from '@/lib/quiz/scoring';

interface TrueFalseGridProps {
  q: RuntimeQuestion;
  tf: number[];
  onTF: (idx: number, val: 0 | 1) => void;
  practice: boolean;
}

export default function TrueFalseGrid({ q, tf, onTF, practice }: TrueFalseGridProps) {
  const isChem = q.subject === 'chemistry';
  const statements = q.statements || [];

  return (
    <div id="qOpts">
      {statements.map((t, i) => {
        const cur = tf[i];
        const cls: string[] = ['tf-row'];
        if (practice && cur >= 0) {
          cls.push(cur === (t.ok ? 1 : 0) ? 'tf-ok' : 'tf-bad');
        }
        return (
          <div key={i} className={cls.join(' ')}>
            <span className="tf-t">
              <b>{LETTERS[i]})</b>{' '}
              {isChem ? (
                <span dangerouslySetInnerHTML={{ __html: chemFormat(t.t) }} />
              ) : (
                t.t
              )}
            </span>
            <button
              type="button"
              className={`btn btn-sm${cur === 1 ? ' btn-primary' : ' btn-ghost'}`}
              onClick={() => onTF(i, 1)}
              aria-label="Đúng"
            >
              Đúng
            </button>
            <button
              type="button"
              className={`btn btn-sm${cur === 0 ? ' btn-primary' : ' btn-ghost'}`}
              onClick={() => onTF(i, 0)}
              aria-label="Sai"
            >
              Sai
            </button>
          </div>
        );
      })}

      {practice && tf.some((v) => v >= 0) && (
        <div className="rev exp">
          <b>Giải thích:</b>{' '}
          {isChem ? (
            <span dangerouslySetInnerHTML={{ __html: chemFormat(q.explanation) }} />
          ) : (
            q.explanation
          )}
        </div>
      )}
    </div>
  );
}
