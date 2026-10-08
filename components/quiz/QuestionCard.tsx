/**
 * components/quiz/QuestionCard.tsx — passage + question text + options/TF.
 * Ports app.js `passageHtml` (154) + qText rendering (210–218).
 */
'use client';

import { typeOf } from '@/lib/quiz/pool';
import { passageHtml, chemFormat, isMathSubject } from '@/lib/quiz/render';
import type { RuntimeQuestion } from '@/lib/quiz/scoring';
import Options from './Options';
import TopicChip from './TopicChip';
import TrueFalseGrid from './TrueFalseGrid';

export interface PassageMap {
  [passageId: string]: { title?: string | null; text?: string | null };
}

interface QuestionCardProps {
  q: RuntimeQuestion;
  index: number;
  total: number;
  selected: number;
  tf: number[];
  practice: boolean;
  /** Quiz type filter — controls whether the topic chip appends the type. */
  qtype?: string;
  onSelect: (idx: number) => void;
  onTF: (idx: number, val: 0 | 1) => void;
  passages: PassageMap;
}

export default function QuestionCard({
  q,
  index,
  total,
  selected,
  tf,
  practice,
  qtype,
  onSelect,
  onTF,
  passages,
}: QuestionCardProps) {
  const isTF = typeOf(q) === 'true_false';

  const passage = q.passageId ? passages[q.passageId] : undefined;
  // cloze blank number is the (N) inside the question text like "Chọn (3)."
  const blankMatch = /\((\d+)\)/.exec(q.question || '');
  const blankNo = blankMatch ? blankMatch[1] : null;

  const headHtml = q.passageId ? passageHtml(passage, blankNo) : '';

  return (
    <div className="panel q-card question-card">
      <TopicChip subject={q.subject} qtype={qtype} q={q} />
      {headHtml && (
        <div
          className="passage-wrap"
          dangerouslySetInnerHTML={{ __html: headHtml + '<br>' }}
        />
      )}
      <div id="qText">
        Câu {index + 1}:{' '}
        {isMathSubject(q.subject) ? (
          <span dangerouslySetInnerHTML={{ __html: chemFormat(q.question) }} />
        ) : (
          q.question
        )}
      </div>

      {isTF ? (
        <TrueFalseGrid q={q} tf={tf} onTF={onTF} practice={practice} />
      ) : (
        <Options q={q} selected={selected} onSelect={onSelect} practice={practice} />
      )}
    </div>
  );
}
