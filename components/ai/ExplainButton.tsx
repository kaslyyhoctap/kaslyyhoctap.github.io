/**
 * components/ai/ExplainButton.tsx — AI explanation button for a single question.
 *
 * Client component: renders a button, calls POST /api/ai/explain on click,
 * shows a loading state, then renders the explanation inline.
 *
 * Works for both MCQ and true/false questions.
 */
'use client';

import { useState } from 'react';
import type { RuntimeQuestion } from '@/lib/quiz/scoring';
import { typeOf } from '@/lib/quiz/pool';
import { chemFormat } from '@/lib/quiz/render';

interface ExplainButtonProps {
  /** The runtime question to explain. */
  q: RuntimeQuestion;
  /** The user's MCQ answer index (-1 = unanswered). */
  userAnswer: number;
}

export default function ExplainButton({ q, userAnswer }: ExplainButtonProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const isTF = typeOf(q) === 'true_false';
  const isChem = q.subject === 'chemistry';

  const handleExplain = async () => {
    setState('loading');
    setError('');
    setText('');

    try {
      const res = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q.question,
          options: isTF
            ? (q.statements || []).map((s) => s.t)
            : (q.opts || []).map((o) => o.t),
          correctAnswer: isTF ? -1 : (q.opts || []).findIndex((o) => o.ok),
          userAnswer: isTF ? q.tf : userAnswer,
          explanation: q.explanation || undefined,
          statements: isTF ? q.statements || undefined : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Có lỗi xảy ra.');
      } else {
        setText(data.explanation);
      }
    } catch {
      setError('Không thể kết nối tới máy chủ.');
    } finally {
      setState('done');
    }
  };

  return (
    <div className="ai-explain rev-tools-ai">
      <button
        type="button"
        className="btn btn-sm btn-ghost"
        onClick={handleExplain}
        disabled={state === 'loading'}
        aria-label="Giải thích bởi AI"
      >
        {state === 'loading' ? 'Đang giải thích…' : 'AI giải thích'}
      </button>

      {error && <span className="muted small" style={{ display: 'block', marginTop: 4 }}>{error}</span>}

      {text && (
        // Non-chemistry explanations are model text and render as React text
        // children (escaped). Passing them through dangerouslySetInnerHTML let
        // a prompt-injected / malformed response inject HTML (stored XSS).
        // Chemistry keeps chemFormat, which escapes before adding markup.
        <div className="muted small" style={{ marginTop: 8, lineHeight: 1.5 }}>
          {isChem ? (
            <span dangerouslySetInnerHTML={{ __html: chemFormat(text) }} />
          ) : (
            <span>{text}</span>
          )}
        </div>
      )}
    </div>
  );
}
