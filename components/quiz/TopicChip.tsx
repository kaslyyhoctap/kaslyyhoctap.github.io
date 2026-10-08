/**
 * components/quiz/TopicChip.tsx — question topic/difficulty/band chip.
 * Rendered at the head of the question section (above the question card).
 */
import { TYPES, topicNamesType } from '@/lib/meta';
import { chemFormat } from '@/lib/quiz/render';
import type { RuntimeQuestion } from '@/lib/quiz/scoring';

interface TopicChipProps {
  subject: string;
  /** 'all' | single type | several checked types (checkbox UI). */
  qtype?: 'all' | string | string[];
  q: RuntimeQuestion;
}

export default function TopicChip({ subject, qtype, q }: TopicChipProps) {
  const isEnglish = subject === 'english';
  // The type suffix shows when a specific type (or set) is selected.
  const typeFilterActive =
    qtype != null && (Array.isArray(qtype) ? qtype.length > 0 : qtype !== 'all');
  const parts = [q.topic];
  if (isEnglish && typeFilterActive && q.type && !topicNamesType(q.topic, q.type)) {
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
