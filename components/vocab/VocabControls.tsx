/**
 * components/vocab/VocabControls.tsx — filter bar + action toggles.
 *
 * Ports app.js index.html `<section id="view-vocab">` controls
 * (vQ, vUnit, vKind, vMode, vShuffle, vStarOnly, vHideAll) and the
 * `vocabCount` / `vocabHint` elements updated by `renderVocab()` (line 346).
 *
 * Presentational: the parent `VocabView` owns all state and callbacks.
 * Unit changes call `onUnitChange` which the parent maps to `router.push`.
 */
'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { VocabMode, VocabKind } from '@/lib/vocab';

/** Kind select options (app.js index.html line 194). */
const KIND_OPTIONS: { value: VocabKind; label: string }[] = [
  { value: '', label: 'Từ + cụm từ' },
  { value: 'word', label: 'Từ lẻ' },
  { value: 'phrase', label: 'Cụm từ' },
];

/** Mode select options (app.js index.html line 195). */
const MODE_OPTIONS: { value: VocabMode; label: string }[] = [
  { value: 'envi', label: 'Anh → Việt' },
  { value: 'vien', label: 'Việt → Anh' },
];

interface VocabControlsProps {
  unit: string;
  units: string[];
  kind: string;
  mode: VocabMode;
  starOnly: boolean;
  hideAll: boolean;
  query: string;
  /** Filtered count (for heading). */
  count: number;
  /** Total count for this unit (for heading). */
  total: number;
  onUnitChange: (unit: string) => void;
  onKindChange: (kind: VocabKind) => void;
  onModeChange: (mode: VocabMode) => void;
  onQueryChange: (query: string) => void;
  onShuffle: () => void;
  onStarOnlyToggle: () => void;
  onHideAllToggle: () => void;
}

export default function VocabControls({
  unit,
  units,
  kind,
  mode,
  starOnly,
  hideAll,
  query,
  count,
  total,
  onUnitChange,
  onKindChange,
  onModeChange,
  onQueryChange,
  onShuffle,
  onStarOnlyToggle,
  onHideAllToggle,
}: VocabControlsProps) {
  // Option lists for shadcn Select: `items` feeds SelectValue's label.
  const unitItems = units.length
    ? units.map((u) => ({ value: u, label: `Unit ${u}` }))
    : [{ value: unit, label: `Unit ${unit}` }];

  return (
    <>
      {/* Heading with count — app.js vocabCount (line 346) */}
      <h2>
        Flashcard từ vựng{' '}
        <small className="muted">
          · Unit {unit} · {count}/{total} thẻ
        </small>
      </h2>

      <div className="panel filters">
        {/* Search box (app.js vQ, index.html line 191) */}
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
            value={query}
            placeholder="Tìm từ vựng..."
            aria-label="Tìm từ vựng"
            onChange={(e) => onQueryChange(e.target.value)}
          />
        </label>

        {/* Control row — app.js vfrow (index.html line 192) */}
        <div className="frow vfrow">
          <Select
            value={unit}
            onValueChange={(v) => v !== null && onUnitChange(v)}
            items={unitItems}
          >
            <SelectTrigger id="vUnit" aria-label="Unit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {unitItems.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={kind}
            onValueChange={(v) => v !== null && onKindChange(v as VocabKind)}
            items={KIND_OPTIONS}
          >
            <SelectTrigger id="vKind" aria-label="Loại">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KIND_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={mode}
            onValueChange={(v) => v !== null && onModeChange(v as VocabMode)}
            items={MODE_OPTIONS}
          >
            <SelectTrigger id="vMode" aria-label="Chế độ">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <button
            type="button"
            className="btn btn-sm"
            id="vShuffle"
            onClick={onShuffle}
          >
            Trộn thứ tự
          </button>

          <button
            type="button"
            className="btn btn-sm btn-ghost"
            id="vStarOnly"
            aria-pressed={starOnly ? 'true' : 'false'}
            onClick={onStarOnlyToggle}
          >
            {starOnly ? '★ Đang lọc' : 'Sổ tay ★'}
          </button>

          <button
            type="button"
            className="btn btn-sm btn-ghost"
            id="vHideAll"
            aria-pressed={hideAll ? 'true' : 'false'}
            onClick={onHideAllToggle}
          >
            {hideAll ? 'Hiện hết nghĩa' : 'Ẩn hết nghĩa'}
          </button>
        </div>

        <p className="muted small mt-3" id="vocabHint">
          Bấm vào thẻ để lật nghĩa. Phím ←/→ chuyển thẻ.
        </p>
      </div>
    </>
  );
}
