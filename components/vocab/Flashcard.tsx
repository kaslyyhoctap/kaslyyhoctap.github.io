/**
 * components/vocab/Flashcard.tsx — single flashcard display with 3D flip.
 *
 * Ports app.js `renderFc()` (lines 352–376): the fc-stage / fc-main /
 * fc-face structure with CSS 3D flip, the slide-animation trigger
 * (from-next / from-prev / anim classes via the reflow trick), the
 * next/prev/know/star navigation buttons, and the progress bar.
 *
 * The `flipped` state and navigation callbacks are owned by the parent
 * `VocabView`; this component is purely presentational + the animation
 * ref side-effect.
 */
'use client';

import { useEffect, useRef } from 'react';
import { fcFront, fcBack, vocabKey, starKey, type VocabMode } from '@/lib/vocab';
import type { Vocabulary } from '@/lib/types';

export interface FlashcardProps {
  /** Current word (null when the list is empty). */
  word: Vocabulary | null;
  /** 0-based index of the current card. */
  index: number;
  /** Total cards in the filtered list. */
  total: number;
  /** How many cards are marked known (for the progress bar). */
  knownCount: number;
  flipped: boolean;
  hideAll: boolean;
  mode: VocabMode;
  unit: string;
  known: boolean;
  starred: boolean;
  /** Slide animation direction (null = no slide on this render). */
  slide: 'next' | 'prev' | null;
  onFlip: () => void;
  onPrev: () => void;
  onNext: () => void;
  onKnow: () => void;
  onStar: () => void;
}

export default function Flashcard({
  word,
  index,
  total,
  knownCount,
  flipped,
  hideAll,
  mode,
  unit,
  known,
  starred,
  slide,
  onFlip,
  onPrev,
  onNext,
  onKnow,
  onStar,
}: FlashcardProps) {
  const fcMainRef = useRef<HTMLDivElement>(null);

  // ── Slide animation (app.js renderFc lines 359–362) ──────────────
  // Remove all anim classes, trigger a reflow, then re-add anim +
  // the direction class so the CSS keyframes fire.
  useEffect(() => {
    const box = fcMainRef.current;
    if (!box) return;
    box.classList.remove('from-next', 'from-prev', 'anim');
    void box.offsetWidth; // forced reflow
    box.classList.add('anim');
    if (slide === 'next') box.classList.add('from-next');
    else if (slide === 'prev') box.classList.add('from-prev');
  }, [slide]);

  // ── Empty state (app.js renderFc line 354) ───────────────────────
  if (!word) {
    return (
      <div className="fc-top panel">
        <div className="fc-stage">
          <div
            ref={fcMainRef}
            id="fcMain"
            className="fc-main"
            role="button"
            tabIndex={0}
            aria-label="Thẻ từ vựng"
          >
            <span className="muted">
              Không có thẻ nào. Hãy nới lỏng bộ lọc.
            </span>
          </div>
        </div>
        <div className="fc-nav">
          <button className="btn" id="fcPrev" disabled>
            ← Trước
          </button>
          <span className="muted" id="fcCount">
            0/0
          </span>
          <button className="btn" id="fcNext" disabled>
            Tiếp →
          </button>
          <button className="btn btn-ghost" id="fcStar" disabled aria-label="Chưa có từ để lưu">
            ☆ Sổ tay
          </button>
          <button className="btn btn-ghost" id="fcKnow" disabled>
            Chưa thuộc
          </button>
        </div>
        <div
          className="progress"
          role="progressbar"
          aria-label="Tiến độ flashcard"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={0}
          id="fcProgWrap"
        >
          <div className="progress-fill" id="fcProg" style={{ width: '0%' }} />
        </div>
      </div>
    );
  }

  const frontText = fcFront(word, mode);
  const backText = fcBack(word, mode);
  const kindLabel = word.kind === 'phrase' ? 'Cụm từ' : 'Từ vựng';
  const showPos = !!word.pos && mode !== 'vien';
  const posText = showPos
    ? `${word.pos}${word.ipa ? ' · ' + word.ipa : ''}`
    : null;
  const progressPct = total > 0 ? Math.round((knownCount / total) * 100) : 0;
  const ariaLabel = `Thẻ từ vựng ${index + 1}/${total}` + (flipped ? `: ${backText}` : `: ${frontText}`);

  return (
    <div className="fc-top panel">
      {/* ── Stage + card (app.js fc-stage / fc-main) ── */}
      <div className="fc-stage">
        <div
          ref={fcMainRef}
          id="fcMain"
          className={`fc-main${flipped ? ' flipped' : ''}`}
          role="button"
          tabIndex={0}
          aria-label={ariaLabel}
          onClick={onFlip}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onFlip();
            }
          }}
        >
          {/* Front face */}
          <div className="fc-face fc-front">
            <div className="en">{frontText}</div>
            {posText && <div className="ipa">{posText}</div>}
            {/* When not flipped + hideAll → show hint; when not flipped + !hideAll → show meaning */}
            {!flipped && hideAll && <div className="hint">Bấm để hiện nghĩa</div>}
            {!flipped && !hideAll && <div className="vi">{backText}</div>}
            <div className="hint">
              {kindLabel} · Unit {unit}
              {known ? ' · Đã thuộc ✓' : ''}
            </div>
          </div>

          {/* Back face */}
          <div className="fc-face fc-back">
            <div className="en">{backText}</div>
            <div className="hint">
              {kindLabel} · Unit {unit}
              {known ? ' · Đã thuộc ✓' : ''}
            </div>
          </div>
        </div>
      </div>

      {/* ── Navigation (app.js fc-nav, lines 403–207) ── */}
      <div className="fc-nav">
        <button className="btn" id="fcPrev" onClick={onPrev} aria-label="Thẻ trước">
          ← Trước
        </button>
        <span className="muted" id="fcCount">
          {index + 1}/{total}
        </span>
        <button className="btn" id="fcNext" onClick={onNext} aria-label="Thẻ tiếp theo">
          Tiếp →
        </button>
        <button
          className="btn btn-ghost"
          id="fcStar"
          onClick={onStar}
          aria-label={starred ? 'Bỏ sao chép' : 'Lưu từ vào sổ tay'}
        >
          {starred ? '★ Sổ tay' : '☆ Sổ tay'}
        </button>
        <button
          className="btn btn-ghost"
          id="fcKnow"
          onClick={onKnow}
          aria-pressed={known ? 'true' : 'false'}
        >
          {known ? 'Chưa thuộc' : 'Đã thuộc ✓'}
        </button>
      </div>

      {/* ── Progress (app.js fcProg / fcProgWrap, line 209) ── */}
      <div
        className="progress"
        role="progressbar"
        aria-label="Tiến độ flashcard"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPct}
        id="fcProgWrap"
      >
        <div className="progress-fill" id="fcProg" style={{ width: `${progressPct}%` }} />
      </div>
    </div>
  );
}
