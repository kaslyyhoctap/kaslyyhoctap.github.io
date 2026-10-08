/**
 * components/vocab/VocabGrid.tsx — grid of vocabulary cards with per-card flip.
 *
 * Ports app.js `renderVGrid()` (lines 377–386) + the click-to-toggle-mask
 * handler (lines 387–391). Each card uses the `.vcard` CSS class with a
 * `.masked` toggle on the `.vi` element (defined in styles.css).
 */
'use client';

import { vocabKey, starKey } from '@/lib/vocab';
import type { Vocabulary } from '@/lib/types';

export interface VocabGridProps {
  list: Vocabulary[];
  unit: string;
  hideAll: boolean;
  knownMap: Record<string, boolean>;
  starredMap: Record<string, boolean>;
  /** Set of card indices that currently have the `masked` class. */
  masked: Set<number>;
  onToggleMask: (idx: number) => void;
}

export default function VocabGrid({
  list,
  unit,
  hideAll,
  knownMap,
  starredMap,
  masked,
  onToggleMask,
}: VocabGridProps) {
  if (!list.length) {
    return <div className="panel">Không có thẻ nào.</div>;
  }

  return (
    <div id="vocabGrid" className="vgrid">
      {list.map((w, idx) => {
        const known = !!knownMap[vocabKey(unit, w.en)];
        const isStarred = !!starredMap[starKey(unit, w.en)];
        const isMasked = masked.has(idx);

        return (
          <button
            key={`${w.en}-${idx}`}
            type="button"
            className={`vcard${known ? ' known' : ''}`}
            data-vi={idx}
            onClick={() => onToggleMask(idx)}
            aria-label={w.en}
          >
            <span className="en">
              {w.en}
              {isStarred && ' ★'}
            </span>
            {w.pos || w.ipa ? (
              <span className="ipa">
                {[w.pos, w.ipa].filter(Boolean).join(' · ')}
              </span>
            ) : null}
            <span className={`vi${isMasked ? ' masked' : ''}`}>
              <span>{w.vi}</span>
            </span>
            <span className="rowline">
              <span className="badge e">
                {w.kind === 'phrase' ? 'Cụm từ' : 'Từ vựng'}
              </span>
              <span className="muted small">
                {known ? 'Đã thuộc ✓' : 'Bấm để lật'}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
