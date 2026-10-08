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

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

  // Option lists for shadcn Select: `items` feeds SelectValue's label.
  const subItems = [
    { value: '', label: 'Mọi môn' },
    ...SUBJECTS.map((s) => ({ value: s, label: subjectName(s) })),
  ];
  const lesItems = [
    { value: '', label: `Mọi ${unitWord.toLowerCase()}` },
    ...lessons.map((n) => ({ value: String(n), label: `${unitWord} ${n}` })),
  ];
  const difItems = LEVELS.map((d) => ({
    value: d === 'all' ? '' : d,
    label: d === 'all' ? 'Mọi mức độ' : d,
  }));
  const ftItems = [
    { value: '', label: 'Mọi dạng' },
    ...Object.entries(TYPES).map(([value, label]) => ({ value, label })),
  ];

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
        <Select
          value={filters.sub}
          // Switching subject invalidates the lesson filter.
          onValueChange={(v) => v !== null && onChange({ sub: v, les: '' })}
          items={subItems}
        >
          <SelectTrigger aria-label="Môn">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {subItems.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.les}
          onValueChange={(v) => v !== null && onChange({ les: v })}
          items={lesItems}
        >
          <SelectTrigger aria-label="Bài/Unit">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {lesItems.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.dif}
          onValueChange={(v) => v !== null && onChange({ dif: v })}
          items={difItems}
        >
          <SelectTrigger aria-label="Mức độ">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {difItems.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.ft}
          onValueChange={(v) => v !== null && onChange({ ft: v })}
          items={ftItems}
        >
          <SelectTrigger aria-label="Dạng câu hỏi">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ftItems.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.st}
          onValueChange={(v) => v !== null && onChange({ st: v })}
          items={STATE_OPTIONS}
        >
          <SelectTrigger aria-label="Trạng thái">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
