/**
 * components/result/ResultReview.tsx — per-question review list.
 *
 * Ports app.js `renderList()` (lines 281–294): for each question, a `div.panel.rev`
 * with rev-head (number / star / status tag / chip), passage, question text,
 * result options (✓/✗), and explanation.
 *
 * Features:
 * - "Xem lại câu sai" toggle → onlyWrong mode (app.js `rWrong` / `_wrongOnly`)
 * - Star button per question → persists to `ontap12-v1` localStorage (app.js `qStar`)
 * - AI Explain button per question → wired to <ExplainButton> (calls /api/ai/explain)
 */
'use client';

import { useState, useEffect } from 'react';
import { typeOf } from '@/lib/quiz/pool';
import { chemFormat, isMathSubject, LETTERS } from '@/lib/quiz/render';
import {
  questionStatus,
  type RuntimeQuestion,
} from '@/lib/quiz/scoring';
import { TYPES } from '@/lib/meta';
import { readAppState, STORAGE_KEY } from '@/lib/storage';
import type { ExamConfig } from '@/lib/quiz/pool';
import type { PassageMap } from '@/components/quiz/QuestionCard';
import ExplainButton from '@/components/ai/ExplainButton';

interface ResultReviewProps {
  qs: RuntimeQuestion[];
  ans: number[];
  cfg: ExamConfig;
  passages: PassageMap;
  /** Wrong-only filter, owned by ResultView so its toggle can live in the hero. */
  onlyWrong: boolean;
  onToggleWrong: () => void;
}

/** Build the chip text: topic · type · difficulty · Band (app.js `chipFor`, line 23). */
function chipText(q: {
  topic?: string | null;
  type?: string | null;
  difficulty?: string | null;
  band?: number | null;
}): string {
  const typeLabel = q.type ? TYPES[q.type] : '';
  const showType =
    typeLabel &&
    q.topic &&
    typeLabel.toLowerCase() !== String(q.topic).toLowerCase()
      ? typeLabel
      : '';
  const parts: string[] = [];
  if (q.topic) parts.push(q.topic);
  if (showType) parts.push(showType);
  if (q.difficulty) parts.push(q.difficulty);
  if (q.band) parts.push(`Band ${Number(q.band).toFixed(1)}`);
  return parts.join(' · ') || '—';
}

/** "Đáp án đúng: A" letter for an MCQ question (app.js line 293). */
function correctLetter(s: RuntimeQuestion): string {
  const idx = s.opts.findIndex((o) => o.ok);
  return idx >= 0 ? LETTERS[idx] : '?';
}

/** Render the result options with ✓/✗ markers (app.js `resultOpts`, lines 192–196). */
function ResultOpts({ q, a }: { q: RuntimeQuestion; a: number }) {
  const isMath = isMathSubject(q.subject);

  if (typeOf(q) === 'true_false') {
    return q.statements?.map((t, i) => {
      const mine = q.tf[i];
      const good = mine >= 0 && mine === (t.ok ? 1 : 0);
      return (
        <div
          key={i}
          className={`opt${
            mine >= 0 ? (good ? ' practice-ok' : ' practice-bad') : ''
          }`}
          style={{ cursor: 'default' }}
        >
          <span className="k">{LETTERS[i].toLowerCase()}</span>
          <span>
            {isMath ? (
              <span dangerouslySetInnerHTML={{ __html: chemFormat(t.t) }} />
            ) : (
              t.t
            )}
          </span>
          <b>
            {mine >= 0 ? (mine ? 'Đúng' : 'Sai') : '—'} · Đáp án:{' '}
            {t.ok ? 'Đúng' : 'Sai'}
            {mine >= 0 ? (good ? ' ✓' : ' ✗') : ''}
          </b>
        </div>
      );
    });
  }

  // MCQ
  return q.opts.map((op, idx) => {
    const isCorrect = op.ok;
    const isWrongSel = idx === a && !op.ok;
    return (
      <div
        key={idx}
        className={`opt${
          isCorrect ? ' practice-ok' : isWrongSel ? ' practice-bad' : ''
        }`}
        style={{ cursor: 'default' }}
      >
        <span className="k">{LETTERS[idx]}</span>
        <span>
          {isMath ? (
            <span dangerouslySetInnerHTML={{ __html: chemFormat(op.t) }} />
          ) : (
            op.t
          )}
          {isCorrect && ' ✓'}
          {isWrongSel && ' ✗'}
        </span>
      </div>
    );
  });
}

export default function ResultReview({ qs, ans, cfg, passages, onlyWrong, onToggleWrong }: ResultReviewProps) {
  const [starred, setStarred] = useState<Record<string, boolean>>({});

  // Load starred from localStorage on mount (app.js `S.starred`).
  useEffect(() => {
    setStarred(readAppState().starred || {});
  }, []);

  const toggleStar = (id: string) => {
    const next = { ...starred };
    if (next[id]) delete next[id];
    else next[id] = true;
    setStarred(next);
    // Persist to ontap12-v1 (app.js `qStar` → `S.starred` → `save()`).
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const state = raw ? JSON.parse(raw) : {};
      state.starred = next;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  };

  // Build visible items, preserving the original index for answer lookup.
  const items = qs.map((s, n) => ({ s, n }));
  const visible = onlyWrong
    ? items.filter((item) => questionStatus(item.s, item.s, ans[item.n]) !== 'ok')
    : items;

  const stLabel = (st: 'ok' | 'bad' | 'skip') =>
    st === 'ok' ? 'Đúng' : st === 'bad' ? 'Sai' : 'Bỏ qua';

  return (
    <div id="reviewList">
      <h2>
        Chi tiết từng câu
        {onlyWrong && ' (chỉ câu sai/bỏ qua)'}
      </h2>

      {visible.length === 0 ? (
        <p className="muted">Không có câu nào.</p>
      ) : (
        visible.map(({ s, n }) => {
          const st = questionStatus(s, s, ans[n]);
          const isMath = isMathSubject(s.subject);
          const isTF = typeOf(s) === 'true_false';

          return (
            <div key={s.id} className="panel rev">
              {/* rev-head (app.js line 289) */}
              <div className="rev-head">
                <b>Câu {n + 1}</b>
                <span className={`tag ${st}`}>
                  {stLabel(st)}
                </span>
                <span className="chip">{chipText(s)}</span>
              </div>
              <div className="rev-tools">
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  data-star={s.id}
                  onClick={() => toggleStar(s.id)}
                  aria-label={starred[s.id] ? 'Bỏ sao chép' : 'Lưu vào sổ tay'}
                >
                  {starred[s.id] ? '★ Sổ tay' : '☆ Sổ tay'}
                </button>
                <ExplainButton q={s} userAnswer={ans[n]} />
              </div>

              {/* Passage (app.js line 290) */}
              {s.passageId && passages[s.passageId] && (
                <div className="passage">
                  <b>{passages[s.passageId].title || ''}</b>
                  <p>{passages[s.passageId].text || ''}</p>
                </div>
              )}

              {/* Question text (app.js line 291) */}
              <p>
                {isMath ? (
                  <span
                    dangerouslySetInnerHTML={{
                      __html: chemFormat(s.question || ''),
                    }}
                  />
                ) : (
                  s.question
                )}
              </p>

              {/* Result options (app.js line 292) */}
              <div id="qOpts" className="result-opts">
                <ResultOpts q={s} a={ans[n]} />
              </div>

              {/* Explanation (app.js line 293) */}
              <div className="rev exp">
                {isTF ? (
                  <>
                    <b>Đúng/Sai từng ý ở trên</b>
                    <br />
                    <b>Giải thích:</b>{' '}
                    {isMath ? (
                      <span
                        dangerouslySetInnerHTML={{
                          __html: chemFormat(s.explanation || ''),
                        }}
                      />
                    ) : (
                      s.explanation
                    )}
                  </>
                ) : (
                  <>
                    <b>Đáp án đúng: {correctLetter(s)}</b>
                    <br />
                    <b>Giải thích:</b>{' '}
                    {isMath ? (
                      <span
                        dangerouslySetInnerHTML={{
                          __html: chemFormat(s.explanation || ''),
                        }}
                      />
                    ) : (
                      s.explanation || ''
                    )}
                    {s.wrongWord && (
                      <>
                        <br />
                        <b>Từ sai:</b> {s.wrongWord} → <b>nên dùng:</b>{' '}
                        {s.correctWord || ''}
                      </>
                    )}
                    <br />
                    <span className="muted small">
                      Nguồn: {s.source || ''}
                      {s.sourceType && ` (${s.sourceType})`}
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
