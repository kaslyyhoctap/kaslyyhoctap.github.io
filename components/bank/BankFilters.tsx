/**
 * components/bank/BankFilters.tsx — bank filter bar.
 *
 * Ports app.js renderBank() filter controls (lines 314–315, 330) and the
 * markup from index.html `<section id="view-bank">` (lines 173–181): a search
 * box (fQ) plus a 5-select `frow` grid — subject (fSub), lesson (fLes),
 * difficulty (fDif), question-type (fType), and answer-state (fState).
 *
 * Controlled: the parent owns the filter values and re-filters on every
 * keystroke/change. The lesson options are supplied by the parent (derived
 * from the selected subject) so this component stays presentational.
 *
 * Styled by the legacy styles.css classes `.filters`, `.search`, `.frow`.
 */
'use client';

import { SUBJECTS, subjectName, TYPES, LEVELS } from '@/lib/meta';

/** Filter state mirrors the six app.js controls (fSub..fQ). */
export interface FilterValues {
  sub: string;
  les: string;
  dif: string;
  ft: string;
  st: string;
  q: string;
}

const EMPTY_FILTERS: FilterValues = {
  sub: '',
  les: '',
  dif: '',
  ft: '',
  st: '',
  q: '',
};

/** fState options (app.js index.html line 180). */
const STATE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Đã/chưa làm' },
  { value: 'done', label: 'Đã làm đúng' },
  { value: 'wrong', label: 'Đã làm sai' },
  { value: 'star', label: 'Đánh dấu sao' },
  { value: 'todo', label: 'Chưa làm' },
];

interface BankFiltersProps {
  filters: FilterValues;
  /** Distinct lesson numbers available for the current subject selection. */
  lessons: number[];
  /** Display word for the selected subject's lessons ("Bài"/"Chương"/"Unit"). */
  unitWord: string;
  /** Merge a patch into the filter state. */
  onChange: (patch: Partial<FilterValues>) => void;
  onReset: () => void;
}

export default function BankFilters({
  filters,
  lessons,
  unitWord,
  onChange,
  onReset,
}: BankFiltersProps) {
  const anyActive = Object.values(filters).some((v) => v !== '');

  return (
    <div className="panel filters">
      {/* search box (app.js fQ) */}
      <label className="search">
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          value={filters.q}
          placeholder="Tìm câu hỏi..."
          aria-label="Tìm câu hỏi"
          onChange={(e) => onChange({ q: e.target.value })}
        />
      </label>

      {/* 5-select grid (app.js frow) */}
      <div className="frow">
        <select
          aria-label="Môn"
          value={filters.sub}
          onChange={(e) => {
            // Switching subject invalidates the lesson filter.
            onChange({ sub: e.target.value, les: '' });
          }}
        >
          <option value="">Mọi môn</option>
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {subjectName(s)}
            </option>
          ))}
        </select>

        <select
          aria-label="Bài/Unit"
          value={filters.les}
          onChange={(e) => onChange({ les: e.target.value })}
        >
          <option value="">Mọi {unitWord.toLowerCase()}</option>
          {lessons.map((n) => (
            <option key={n} value={String(n)}>
              {unitWord} {n}
            </option>
          ))}
        </select>

        <select
          aria-label="Mức độ"
          value={filters.dif}
          onChange={(e) => onChange({ dif: e.target.value })}
        >
          {LEVELS.map((d) => (
            <option key={d} value={d === 'all' ? '' : d}>
              {d === 'all' ? 'Mọi mức độ' : d}
            </option>
          ))}
        </select>

        <select
          aria-label="Dạng câu hỏi"
          value={filters.ft}
          onChange={(e) => onChange({ ft: e.target.value })}
        >
          <option value="">Mọi dạng</option>
          {Object.entries(TYPES).map(([k, lbl]) => (
            <option key={k} value={k}>
              {lbl}
            </option>
          ))}
        </select>

        <select
          aria-label="Trạng thái"
          value={filters.st}
          onChange={(e) => onChange({ st: e.target.value })}
        >
          {STATE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {anyActive && (
        <button type="button" className="btn btn-sm btn-ghost" onClick={onReset}>
          Xóa bộ lọc
        </button>
      )}
    </div>
  );
}

export { EMPTY_FILTERS };
