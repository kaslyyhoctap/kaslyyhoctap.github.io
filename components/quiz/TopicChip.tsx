/**
 * components/quiz/TopicChip.tsx — question topic/difficulty/band chip.
 * Rendered at the head of the question section (above the question card).
 */
import { TYPES, topicNamesType } from '@/lib/meta';
import { chemFormat } from '@/lib/quiz/render';
import type { RuntimeQuestion } from '@/lib/quiz/scoring';

interface TopicChipProps {
  subject: string;
  qtype?: string;
  q: RuntimeQuestion;
}

export default function TopicChip({ subject, qtype, q }: TopicChipProps) {
  const isEnglish = subject === 'english';
  const parts = [q.topic];
  if (
    isEnglish &&
    qtype &&
    qtype !== 'all' &&
    q.type &&
    !topicNamesType(q.topic, q.type)
  ) {
    parts.push(TYPES[q.type]);
  }
  parts.push(q.difficulty);
  if (q.band) parts.push(`Band ${Number(q.band).toFixed(1)}`);
  const label = parts.filter(Boolean).join(' · ');

  return (
    <div id="qTopic" className="chip">
      {subject === 'chemistry' ? (
        <span dangerouslySetInnerHTML={{ __html: chemFormat(label) }} />
      ) : (
        label
      )}
    </div>
  );
}
