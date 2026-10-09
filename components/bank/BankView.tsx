/**
 * components/bank/BankView.tsx — question bank viewer.
 *
 * Ports app.js `renderBank()` (lines 314–329): it takes the full question bank
 * (already fetched server-side, mirroring app.js global `Q`), builds the
 * valid + de-duplicated set, applies the six client-side filters
 * (subject / lesson / difficulty / type / answer-state / search), and renders
 * the list with 20-per-page pagination (numbered pages + prev/next).
 *
 * Answer-status (`S.answered`) and star state (`S.starred`) are read from the
 * legacy `ontap12-v1` localStorage via `useAppState`; star toggles persist back
 * to the same key so the `star` filter sees them immediately.
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import BankFilters, { type FilterValues, EMPTY_FILTERS } from './BankFilters';
import BankItem, { type PassageMap } from './BankItem';
import { typeOf } from '@/lib/quiz/pool';
import { subjectUnits } from '@/lib/meta';
import { readAppState, useAppState, STORAGE_KEY } from '@/lib/storage';
import type { Question } from '@/lib/types';

const PAGE_SIZE = 20;

interface BankViewProps {
  /** All questions from the DB (raw; validity + dedup done here). */
  questions: Question[];
  /** Reading passages keyed by passageId (app.js `window.PASSAGES`). */
  passages: PassageMap;
  /** Filters applied on mount + after "Xóa bộ lọc" — e.g. the notebook pins st:'star'. */
  initialFilters?: Partial<FilterValues>;
  /** Heading above the list (default: "Ngân hàng câu hỏi"). */
  heading?: string;
  /** Empty-state message (default: the bank's "nới lỏng bộ lọc" hint). */
  emptyText?: string;
}

/**
 * app.js `Q` validity predicate (lines 24–26): a question is part of the bank
 * when it has id + question text + explanation, and is either a valid 4-option
 * MCQ (correctAnswer in 0–3), a 4-statement true/false question, or a
 * short_answer question with a string answer.
 */
function isValidBankQuestion(q: Question): boolean {
  if (!q?.id || !q.question || !q.explanation) return false;
  if (typeOf(q) === 'true_false') {
    return !!(q.statements && q.statements.length === 4);
  }
  if (typeOf(q) === 'short_answer') {
    return typeof q.answer === 'string';
  }
  return (
    !!(q.options && q.options.length === 4) &&
    q.correctAnswer != null &&
    q.correctAnswer >= 0 &&
    q.correctAnswer < 4
  );
}

export default function BankView({
  questions,
  passages,
  initialFilters,
  heading,
  emptyText,
}: BankViewProps) {
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
  // `starred` must follow the (post-mount) localStorage read, otherwise it
  // freezes the SSR-matching empty state and /notebook shows 0 items.
  const [starredLocal, setStarred] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setStarred(appState.starred || {});
  }, [appState.starred]);
  const starred = starredLocal;

  const [filters, setFilters] = useState<FilterValues>({
    ...EMPTY_FILTERS,
    ...initialFilters,
  });
  const onChange = (patch: Partial<FilterValues>) =>
    setFilters((f) => ({ ...f, ...patch }));
  // Reset returns to the page's pinned defaults (notebook keeps st:'star').
  const onReset = () => setFilters({ ...EMPTY_FILTERS, ...initialFilters });
  const [page, setPage] = useState(1);

  // `starredLocal` is the single source of truth in-session: seeded from the
  // post-mount localStorage read (see the effect above) and thereafter holding
  // every in-session toggle. A deleted key must stay deleted — merging over
  // `appState.starred` would resurrect it.
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

  // Pagination: 20/page; reset to page 1 whenever the filter result changes.
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  useEffect(() => {
    setPage(1);
  }, [filters, bank]);
  const safePage = Math.min(page, totalPages);
  const showList = list.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  // Windowed page numbers: first · last · current ± 2.
  const pageNums = useMemo(() => {
    const nums = new Set([1, totalPages, safePage - 2, safePage - 1, safePage, safePage + 1, safePage + 2]);
    return [...nums].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  }, [safePage, totalPages]);

  return (
    <>
      <BankFilters
        filters={filters}
        lessons={lessons}
        unitWord={unitWord}
        onChange={onChange}
        onReset={onReset}
      />

      {/* bankCount (app.js line 322): "· X/Y câu" + pager position */}
      <h2>
        {heading ?? 'Ngân hàng câu hỏi'}{' '}
        <small className="muted">
          · {list.length}/{bank.length} câu
        </small>
      </h2>

      {showList.length === 0 ? (
        <div className="panel">
          {emptyText ?? 'Không tìm thấy câu hỏi nào. Hãy thử nới lỏng bộ lọc.'}
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

      {list.length > 0 && (
        <nav className="pager" aria-label="Phân trang ngân hàng câu hỏi">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage(safePage - 1)}
            aria-label="Trang trước"
          >
            ← Trước
          </button>
          {pageNums.map((n, i) => (
            <span key={n} style={{ display: 'contents' }}>
              {i > 0 && n - pageNums[i - 1]! > 1 && (
                <span className="muted" aria-hidden="true">
                  …
                </span>
              )}
              <button
                type="button"
                onClick={() => setPage(n)}
                aria-label={`Trang ${n}`}
                aria-current={n === safePage ? 'page' : undefined}
              >
                {n}
              </button>
            </span>
          ))}
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage(safePage + 1)}
            aria-label="Trang sau"
          >
            Sau →
          </button>
          <span className="pg-info">
            Trang {safePage}/{totalPages} · {list.length} câu
          </span>
        </nav>
      )}
    </>
  );
}
