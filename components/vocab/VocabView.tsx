/**
 * components/vocab/VocabView.tsx — client wrapper orchestrating all vocab state.
 *
 * Holds the shared state that the original app.js kept in the module-level `V`
 * object (lines 335–341) and the `S` localStorage object (starred, vocabKnown):
 *
 *   - V.list   → derived via `vocabFilter` (app.js vocabFilter, lines 337–341)
 *   - V.i      → currentIndex
 *   - V.flip   → flipped
 *   - V.slide  → slide ('next' | 'prev' | null) for the slide animation
 *   - V.hideAll / V.starOnly → hideAll / starOnly booleans
 *   - S.starred / S.vocabKnown → persisted to localStorage key `ontap12-v1`
 *
 * Ports the global keydown handler (lines 402–408) and the input-change
 * reset (lines 401) into React effect / callback logic.
 */
'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppState, STORAGE_KEY } from '@/lib/storage';
import { shuffle } from '@/lib/quiz/pool';
import { toast } from '@/components/ui/toast';
import {
  vocabFilter,
  vocabKey,
  starKey,
  type VocabMode,
  type VocabKind,
} from '@/lib/vocab';
import Flashcard from './Flashcard';
import VocabGrid from './VocabGrid';
import VocabControls from './VocabControls';
import type { Vocabulary } from '@/lib/types';

interface VocabViewProps {
  /** Vocabulary rows already narrowed to the current unit (from getVocabulary). */
  vocabulary: Vocabulary[];
  unit: string;
  /** Distinct unit strings available for selection. */
  units: string[];
}

export default function VocabView({ vocabulary, unit, units }: VocabViewProps) {
  const router = useRouter();

  // ── Controls state (app.js V.* + control selectors) ─────────────────
  const [kind, setKind] = useState<VocabKind>('');
  const [mode, setMode] = useState<VocabMode>('envi');
  const [query, setQuery] = useState('');
  const [hideAll, setHideAll] = useState(false);
  const [starOnly, setStarOnly] = useState(false);
  const [shuffled, setShuffled] = useState(false);

  // ── Flashcard navigation state (app.js V.i, V.flip, V.slide) ───────
  const [index, setIndex] = useState(0);
  const [flip, setFlip] = useState(false);
  const [slide, setSlide] = useState<'next' | 'prev' | null>(null);

  // ── Grid per-card mask state (app.js per-vcard `.masked` toggle) ───
  const [masked, setMasked] = useState<Set<number>>(new Set());

  // ── Legacy localStorage state (app.js S.starred, S.vocabKnown) ─────
  const appState = useAppState();
  const [starred, setStarred] = useState<Record<string, boolean>>(
    appState.starred || {},
  );
  const [vocabKnown, setVocabKnown] = useState<Record<string, boolean>>(
    appState.vocabKnown || {},
  );

  // ── Toast (app.js toast(), line 29) — global top-right component ───
  const showToast = useCallback((msg: string) => {
    toast.add({ title: msg, type: 'success' });
  }, []);

  // ── Derived: filtered + (optionally) shuffled list ─────────────────
  // app.js V.list = vocabFilter(); then vShuffle shuffles V.list in place.
  const list = useMemo(() => {
    const result = vocabFilter(vocabulary, { kind, starOnly, query }, starred, unit);
    return shuffled ? shuffle(result) : result;
  }, [vocabulary, kind, starOnly, query, starred, unit, shuffled]);

  // ── Known count for progress bar (app.js renderFc done/pct, lines 372–373) ──
  const knownCount = useMemo(
    () => list.filter((w) => vocabKnown[vocabKey(unit, w.en)]).length,
    [list, vocabKnown, unit],
  );

  // ── Persist helper (mirrors BankView localStorage write pattern) ────
  const persist = useCallback(
    (key: 'starred' | 'vocabKnown', value: Record<string, boolean>) => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const state = raw ? JSON.parse(raw) : {};
        state[key] = value;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        /* ignore */
      }
    },
    [],
  );

  // ── Star toggle (app.js fcStar onclick, line 396) ──────────────────
  const toggleStar = useCallback(() => {
    const w = list[index];
    if (!w) return;
    setStarred((prev) => {
      const next = { ...prev };
      const k = starKey(unit, w.en);
      if (next[k]) delete next[k];
      else next[k] = true;
      persist('starred', next);
      return next;
    });
  }, [list, index, unit, persist]);

  // ── Know toggle (app.js fcKnow onclick, line 397) ──────────────────
  const toggleKnow = useCallback(() => {
    const w = list[index];
    if (!w) return;
    setVocabKnown((prev) => {
      const next = { ...prev };
      const k = vocabKey(unit, w.en);
      if (next[k]) delete next[k];
      else next[k] = true;
      persist('vocabKnown', next);
      return next;
    });
  }, [list, index, unit, persist]);

  // ── Navigation (app.js fcPrev / fcNext, lines 394–395) ─────────────
  const goPrev = useCallback(() => {
    if (!list.length) return;
    setIndex((i) => (i - 1 + list.length) % list.length);
    setFlip(false);
    setSlide('prev');
  }, [list.length]);

  const goNext = useCallback(() => {
    if (!list.length) return;
    setIndex((i) => (i + 1) % list.length);
    setFlip(false);
    setSlide('next');
  }, [list.length]);

  const toggleFlip = useCallback(() => setFlip((f) => !f), []);

  // ── Shuffle (app.js vShuffle, line 398) ────────────────────────────
  const handleShuffle = useCallback(() => {
    setShuffled(true);
    setIndex(0);
    setFlip(false);
    setSlide(null);
    showToast(`Đã trộn ${list.length} thẻ`);
  }, [list.length, showToast]);

  // ── Star-only / hide-all toggles (app.js lines 399–400) ───────────
  const toggleStarOnly = useCallback(() => setStarOnly((s) => !s), []);
  const toggleHideAll = useCallback(() => setHideAll((h) => !h), []);

  // ── Grid mask toggle (app.js vcard click, lines 387–391) ───────────
  const toggleCardMask = useCallback((idx: number) => {
    setMasked((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  // ── Unit change → URL update (app.js vUnit input, line 401) ────────
  const handleUnitChange = useCallback(
    (newUnit: string) => {
      const sp = new URLSearchParams();
      if (newUnit) sp.set('unit', newUnit);
      const qs = sp.toString();
      router.push(qs ? `/vocab?${qs}` : '/vocab');
    },
    [router],
  );

  // ── Kind / mode / query change (app.js lines 401: reset hideAll + starOnly) ──
  const handleKindChange = useCallback((newKind: VocabKind) => {
    setKind(newKind);
    setHideAll(false);
    setStarOnly(false);
    setShuffled(false);
  }, []);
  const handleModeChange = useCallback((newMode: VocabMode) => {
    setMode(newMode);
    setHideAll(false);
    setStarOnly(false);
    setShuffled(false);
  }, []);
  const handleQueryChange = useCallback((newQuery: string) => {
    setQuery(newQuery);
    setHideAll(false);
    setStarOnly(false);
    setShuffled(false);
  }, []);

  // ── Reset index / flip / slide when list or unit changes ───────────
  // (app.js renderVocab sets V.i=0, V.flip=false)
  useEffect(() => {
    setIndex(0);
    setFlip(false);
    setSlide(null);
  }, [list, unit]);

  // ── Grid mask set: hideAll → all masked; !hideAll → all visible ────
  // Also resets when list changes (app.js re-renders grid from scratch).
  useEffect(() => {
    if (hideAll) {
      setMasked(new Set(list.map((_, i) => i)));
    } else {
      setMasked(new Set());
    }
  }, [hideAll, list]);

  // ── Keyboard handler (app.js lines 402–408) ───────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = e.target instanceof Element ? e.target.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
      if (!list.length) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === ' ') {
        // app.js: ignore if the flashcard div itself has focus
        if (document.activeElement?.id === 'fcMain') return;
        e.preventDefault();
        toggleFlip();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [list.length, goNext, goPrev, toggleFlip]);

  const currentWord =
    list.length > 0 ? list[Math.min(index, Math.max(0, list.length - 1))] : null;

  return (
    <div className="vocab-app">
      {/* ── Controls (search + unit/kind/mode + toggles) ── */}
      <VocabControls
        unit={unit}
        units={units}
        kind={kind}
        mode={mode}
        starOnly={starOnly}
        hideAll={hideAll}
        query={query}
        count={list.length}
        total={vocabulary.length}
        onUnitChange={handleUnitChange}
        onKindChange={handleKindChange}
        onModeChange={handleModeChange}
        onQueryChange={handleQueryChange}
        onShuffle={handleShuffle}
        onStarOnlyToggle={toggleStarOnly}
        onHideAllToggle={toggleHideAll}
      />

      {/* ── Flashcard (fc-stage + fc-nav + progress) ── */}
      <Flashcard
        word={currentWord}
        index={index}
        total={list.length}
        knownCount={knownCount}
        flipped={flip}
        hideAll={hideAll}
        mode={mode}
        unit={unit}
        known={currentWord ? !!vocabKnown[vocabKey(unit, currentWord.en)] : false}
        starred={currentWord ? !!starred[starKey(unit, currentWord.en)] : false}
        slide={slide}
        onFlip={toggleFlip}
        onPrev={goPrev}
        onNext={goNext}
        onKnow={toggleKnow}
        onStar={toggleStar}
      />

      {/* ── Grid (all cards with toggle-mask) ── */}
      <h3 className="sec-t">Tất cả thẻ</h3>
      <VocabGrid
        list={list}
        unit={unit}
        hideAll={hideAll}
        knownMap={vocabKnown}
        starredMap={starred}
        masked={masked}
        onToggleMask={toggleCardMask}
      />

      {/* ── Toast: rendered globally by <Toaster /> in the root layout ── */}
    </div>
  );
}
