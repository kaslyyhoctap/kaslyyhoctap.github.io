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
          <select
            id="vUnit"
            aria-label="Unit"
            value={unit}
            onChange={(e) => onUnitChange(e.target.value)}
          >
            {units.length ? (
              units.map((u) => (
                <option key={u} value={u}>
                  Unit {u}
                </option>
              ))
            ) : (
              <option value={unit}>Unit {unit}</option>
            )}
          </select>

          <select
            id="vKind"
            aria-label="Loại"
            value={kind}
            onChange={(e) => onKindChange(e.target.value as VocabKind)}
          >
            {KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <select
            id="vMode"
            aria-label="Chế độ"
            value={mode}
            onChange={(e) => onModeChange(e.target.value as VocabMode)}
          >
            {MODE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

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

        <p className="muted small" id="vocabHint">
          Bấm vào thẻ để lật nghĩa. Phím ←/→ chuyển thẻ.
        </p>
      </div>
    </>
  );
}
