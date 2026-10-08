/**
 * components/bank/BankItem.tsx — single question in the bank list.
 *
 * Ports app.js `bankItem()` (lines 305–311): a `<details class="bank-item">`
 * whose `<summary>` shows the subject/unit tag, question text, an answered
 * status tag, a chip (topic · type · difficulty · Band), the source, and a
 * star toggle; expanding reveals the passage (if any), the options (or
 * true/false statement grid), the explanation, and any wrong-word note.
 *
 * Chemistry formulas are run through `chemFormat` (subscripts) — same as
 * app.js `chem()`. Plain text is left to React's automatic escaping, so
 * `escapeHtml` is only used to build the chemistry-safe markup strings that go
 * through `dangerouslySetInnerHTML`.
 *
 * Client component: the star toggle writes to `ontap12-v1` (app.js `S.starred`).
 */
'use client';

import { typeOf } from '@/lib/quiz/pool';
import { chemFormat, escapeHtml, LETTERS } from '@/lib/quiz/render';
import { subjectShort, subjectUnits, TYPES } from '@/lib/meta';
import { unitPrefix } from '@/lib/storage';
import type { Question } from '@/lib/types';

/** Passage block shape, keyed by passageId (mirrors QuestionCard.PassageMap). */
export interface PassageMap {
  [passageId: string]: { title?: string | null; text?: string | null };
}

interface BankItemProps {
  q: Question;
  /** Answer status from the legacy `answered` map (app.js `s`). `undefined` = unseen. */
  status?: 'ok' | 'bad';
  isStarred: boolean;
  onToggleStar: (id: string) => void;
  passage?: PassageMap[string];
}

/** `topic · type · difficulty · Band` chip — port of app.js `chipFor()` (line 23). */
function chipText(q: Question): string {
  const typeLabel = q.type ? TYPES[q.type] : '';
  // Hide the type when it merely repeats the topic (app.js chipFor).
  const showType =
    typeLabel && q.topic && typeLabel.toLowerCase() !== String(q.topic).toLowerCase()
      ? typeLabel
      : '';
  const parts: string[] = [];
  if (q.topic) parts.push(q.topic);
  if (showType) parts.push(showType);
  if (q.difficulty) parts.push(q.difficulty);
  if (q.band) parts.push(`Band ${Number(q.band).toFixed(1)}`);
  return parts.join(' · ') || '—';
}

/** Question text, chemistry-formatted when applicable (app.js summary line, line 309). */
function questionHtml(q: Question): string {
  const isChem = q.subject === 'chemistry';
  return isChem ? chemFormat(q.question) : escapeHtml(q.question);
}

export default function BankItem({ q, status, isStarred, onToggleStar, passage }: BankItemProps) {
  const isChem = q.subject === 'chemistry';
  const isTF = typeOf(q) === 'true_false';
  // subject/unit tag (app.js subjTag/unitTag, lines 20–21).
  const subj = subjectShort(q.subject);
  const unitTag = `${unitPrefix(subjectUnits(q.subject))}${q.lesson}`;
  const typeLabel = q.type ? TYPES[q.type] : '';

  // summary header: "[Sử B1 · Multiple Choice] question" (app.js line 309).
  const headerHtml = `[${subj} ${unitTag}${typeLabel ? ' · ' + typeLabel : ''}] ${questionHtml(q)}`;

  // explanation body text (app.js bankItem body, lines 307–308).
  const expText = isChem
    ? chemFormat(q.explanation || '')
    : escapeHtml(q.explanation || '');

  const correctLetter =
    q.correctAnswer != null && q.correctAnswer >= 0 && q.correctAnswer < LETTERS.length
      ? LETTERS[q.correctAnswer]
      : '?';

  return (
    <details className="panel bank-item">
      <summary>
        <span dangerouslySetInnerHTML={{ __html: headerHtml }} />
        {status && (
          <span className={`tag ${status === 'ok' ? 'ok' : 'bad'}`}>
            {status === 'ok' ? 'Đã đúng' : 'Đã sai'}
          </span>
        )}
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          aria-label={isStarred ? 'Bỏ sao chép' : 'Lưu vào sổ tay'}
          onClick={() => onToggleStar(q.id)}
        >
          {isStarred ? '★' : '☆'}
        </button>
        <br />
        <span className="muted small">
          {chipText(q)} · Nguồn: {q.source || ''}
        </span>
      </summary>

      {/* passage detail block (app.js `det`, lines 324–325) */}
      {passage?.text && (
        <div className="passage">
          <b>{passage.title || ''}</b>
          <p>{passage.text}</p>
        </div>
      )}

      {/* options + explanation body (app.js `body`, lines 306–308) */}
      {isTF ? (
        <>
          <div className="tf-list">
            {q.statements?.map((t, i) => (
              <div key={i} className="opt" style={{ cursor: 'default' }}>
                {/* app.js tfRows uses lowercase "abcd"[i] */}
                <span className="k">{String.fromCharCode(97 + i)}</span>
                <span dangerouslySetInnerHTML={{ __html: chemFormat(t.t) }} />
                <b>{t.ok ? 'Đúng' : 'Sai'}</b>
              </div>
            ))}
          </div>
          <div className="exp">
            <b>Đáp án từng ý ở trên.</b>{' '}
            <span dangerouslySetInnerHTML={{ __html: expText }} />
            {q.wrongWord && (
              <>
                <br />
                <b>Từ sai:</b> {q.wrongWord} → <b>nên dùng:</b> {q.correctWord || ''}
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <ol type="A">
            {q.options?.map((o, i) => (
              <li key={i}>
                {isChem ? (
                  <span dangerouslySetInnerHTML={{ __html: chemFormat(o) }} />
                ) : (
                  o
                )}
              </li>
            ))}
          </ol>
          <div className="exp">
            <b>
              Đáp án: {correctLetter}.
            </b>
            <br />
            <span dangerouslySetInnerHTML={{ __html: expText }} />
            {q.wrongWord && (
              <>
                <br />
                <b>Từ sai:</b> {q.wrongWord} → <b>nên dùng:</b> {q.correctWord || ''}
              </>
            )}
          </div>
        </>
      )}
    </details>
  );
}
