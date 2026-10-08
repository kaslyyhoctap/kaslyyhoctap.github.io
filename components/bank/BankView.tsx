/**
 * components/bank/BankView.tsx — question bank viewer.
 *
 * Ports app.js `renderBank()` (lines 314–329): it takes the full question bank
 * (already fetched server-side, mirroring app.js global `Q`), builds the
 * valid + de-duplicated set, applies the six client-side filters
 * (subject / lesson / difficulty / type / answer-state / search), and renders
 * the list with a 120-item cap (app.js used a 20/page pager — replaced here by
 * the simpler cap per the task spec).
 *
 * Answer-status (`S.answered`) and star state (`S.starred`) are read from the
 * legacy `ontap12-v1` localStorage via `useAppState`; star toggles persist back
 * to the same key so the `star` filter sees them immediately.
 */
'use client';

import { useMemo, useState } from 'react';
import BankFilters, { type FilterValues, EMPTY_FILTERS } from './BankFilters';
import BankItem, { type PassageMap } from './BankItem';
import { typeOf } from '@/lib/quiz/pool';
import { subjectUnits } from '@/lib/meta';
import { readAppState, useAppState, STORAGE_KEY } from '@/lib/storage';
import type { Question } from '@/lib/types';

const BANK_LIMIT = 120;

interface BankViewProps {
  /** All questions from the DB (raw; validity + dedup done here). */
  questions: Question[];
  /** Reading passages keyed by passageId (app.js `window.PASSAGES`). */
  passages: PassageMap;
}

/**
 * app.js `Q` validity predicate (lines 24–26): a question is part of the bank
 * when it has id + question text + explanation, and is either a valid 4-option
 * MCQ (correctAnswer in 0–3) or a 4-statement true/false question.
 */
function isValidBankQuestion(q: Question): boolean {
  if (!q?.id || !q.question || !q.explanation) return false;
  if (typeOf(q) === 'true_false') {
    return !!(q.statements && q.statements.length === 4);
  }
  return (
    !!(q.options && q.options.length === 4) &&
    q.correctAnswer != null &&
    q.correctAnswer >= 0 &&
    q.correctAnswer < 4
  );
}

export default function BankView({ questions, passages }: BankViewProps) {
  // Build the valid, de-duplicated bank once (app.js global `Q`, lines 24–26).
  const bank = useMemo(() => {
    const seen = new Set<string>();
    return questions.filter(isValidBankQuestion).filter((q) => {
      // Dedup key: (passageId||"") + question.trim().toLowerCase() (app.js line 26).
      const k = `${q.passageId || ''}${q.question.trim().toLowerCase()}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [questions]);

  // Legacy user state (app.js `S`). Answered is read-once per mount; starred is
  // owned locally so star toggles update the UI + `star` filter immediately.
  const appState = useAppState();
  const answered = appState.answered;
  const [starred, setStarred] = useState<Record<string, boolean>>(appState.starred || {});

  const [filters, setFilters] = useState<FilterValues>(EMPTY_FILTERS);
  const onChange = (patch: Partial<FilterValues>) =>
    setFilters((f) => ({ ...f, ...patch }));
  const onReset = () => setFilters(EMPTY_FILTERS);

  const toggleStar = (id: string) => {
    setStarred((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const state = raw ? JSON.parse(raw) : {};
        state.starred = next;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  // Filtered view (app.js renderBank predicate, lines 316–320).
  const list = useMemo(() => {
    const { sub, les, dif, ft, st, q } = filters;
    const ql = q.trim().toLowerCase();
    const lesNum = les ? Number(les) : NaN;
    return bank.filter((x) => {
      return (
        (!sub || x.subject === sub) &&
        (!les || x.lesson === lesNum) &&
        (!dif || x.difficulty === dif) &&
        (!ft || typeOf(x) === ft) &&
        (!ql ||
          x.question.toLowerCase().includes(ql) ||
          (x.topic || '').toLowerCase().includes(ql)) &&
        (!st ||
          (st === 'star'
            ? !!starred[x.id]
            : st === 'todo'
              ? !answered[x.id]
              : st === 'done'
                ? answered[x.id] === 'ok'
                : answered[x.id] === 'bad'))
      );
    });
  }, [bank, filters, answered, starred]);

  // Distinct lessons for the current subject selection (app.js fLes).
  const lessons = useMemo(() => {
    const pool = filters.sub ? bank.filter((x) => x.subject === filters.sub) : bank;
    return Array.from(new Set(pool.map((x) => x.lesson))).sort((a, b) => a - b);
  }, [bank, filters.sub]);

  const unitWord = filters.sub ? subjectUnits(filters.sub) : 'Bài';
  const showList = list.slice(0, BANK_LIMIT);
  const limited = list.length > BANK_LIMIT;

  return (
    <>
      <BankFilters
        filters={filters}
        lessons={lessons}
        unitWord={unitWord}
        onChange={onChange}
        onReset={onReset}
      />

      {/* bankCount (app.js line 322): "· X/Y câu" */}
      <h2>
        Ngân hàng câu hỏi{' '}
        <small className="muted">
          · {list.length}/{bank.length} câu
        </small>
      </h2>

      {/* 120-item cap message (replaces app.js pager). */}
      {limited && (
        <p className="muted small">Chỉ hiện {BANK_LIMIT}/{list.length} câu</p>
      )}

      {showList.length === 0 ? (
        <div className="panel">
          Không tìm thấy câu hỏi nào. Hãy thử nới lỏng bộ lọc.
        </div>
      ) : (
        <div id="bankList">
          {showList.map((q) => (
            <BankItem
              key={q.id}
              q={q}
              status={
                answered[q.id] === 'ok'
                  ? 'ok'
                  : answered[q.id] === 'bad'
                    ? 'bad'
                    : undefined
              }
              isStarred={!!starred[q.id]}
              onToggleStar={toggleStar}
              passage={q.passageId ? passages[q.passageId] : undefined}
            />
          ))}
        </div>
      )}
    </>
  );
}
