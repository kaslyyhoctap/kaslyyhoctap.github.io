/**
 * lib/vocab.ts — pure helpers ported from app.js vocab section (lines 334–351).
 *
 * These are pure functions with no DOM dependency, extracted so they can be
 * unit-tested independently (like `computeWeakAreas` in queries.ts).
 */
import type { Vocabulary } from '@/lib/types';

export type VocabMode = 'envi' | 'vien';
export type VocabKind = '' | 'word' | 'phrase';

// ── Key helpers ─────────────────────────────────────────────────────

/** app.js `vocabKey()` (line 342): `"unit::en"` — used for vocabKnown map. */
export const vocabKey = (unit: string, en: string): string => `${unit}::${en}`;

/** Star key: `"v::unit::en"` — used for starred map (app.js line 340, 381, 396). */
export const starKey = (unit: string, en: string): string => `v::${unit}::${en}`;

// ── Face text selectors ─────────────────────────────────────────────

/** app.js `fcFront()` (line 350). envi → en; vien → vi. */
export const fcFront = (w: Vocabulary, mode: VocabMode): string =>
  mode === 'vien' ? (w.vi ?? '') : w.en;

/** app.js `fcBack()` (line 351). envi → vi; vien → en. */
export const fcBack = (w: Vocabulary, mode: VocabMode): string =>
  mode === 'vien' ? w.en : (w.vi ?? '');

// ── Filter ─────────────────────────────────────────────────────────

/**
 * app.js `vocabFilter()` (lines 337–341): filters vocabulary by kind,
 * star-only, and search query.
 *
 * `list` is the vocabulary already narrowed to the current unit (the server
 * page fetches one unit at a time via `getVocabulary(unit)`).
 */
export function vocabFilter(
  list: Vocabulary[],
  opts: { kind: string; starOnly: boolean; query: string },
  starred: Record<string, boolean>,
  unit: string,
): Vocabulary[] {
  const q = opts.query.trim().toLowerCase();
  return list.filter((w) => {
    return (
      (!opts.kind || w.kind === opts.kind) &&
      (!opts.starOnly || !!starred[starKey(unit, w.en)]) &&
      (!q ||
        w.en.toLowerCase().includes(q) ||
        (w.vi || '').toLowerCase().includes(q))
    );
  });
}
