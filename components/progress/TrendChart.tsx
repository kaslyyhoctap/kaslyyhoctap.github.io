/**
 * TrendChart — port of app.js `renderTrend()` (line 453).
 *
 * Client component. Props: `hist` (exam-history entries). Reads the weekly
 * goal from the `ontap12-v1` localStorage state (default 3); the +/- buttons
 * clamp 1–14 and persist immediately (mirrors app.js goal +/- click handler).
 *
 * The weekly goal is NOT part of `AppState` (lib/storage.ts) — it lives on the
 * same legacy state object as `S.goal` in app.js — so this component reads/writes
 * localStorage directly via `STORAGE_KEY`.
 */
'use client';

import { useState, useEffect } from 'react';
import { STORAGE_KEY } from '@/lib/storage';

export interface HistEntry {
  when: number;
  point: number;
  sub: string;
  lesson: string | number;
  ok: number;
  tot: number;
  ids?: string[];
}

const DEFAULT_GOAL = 3;
const WEEK_MS = 7 * 864e5;

/** Read `S.goal` from the legacy localStorage state (default 3). */
function readGoal(): number {
  if (typeof localStorage === 'undefined') return DEFAULT_GOAL;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const g = raw ? JSON.parse(raw)?.goal : undefined;
    return typeof g === 'number' && g >= 1 ? g : DEFAULT_GOAL;
  } catch {
    return DEFAULT_GOAL;
  }
}

/** Persist `S.goal` back into the legacy state object. */
function writeGoal(g: number): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const s = raw ? JSON.parse(raw) : {};
    s.goal = g;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore — localStorage full / private mode */
  }
}

export default function TrendChart({ hist }: { hist: HistEntry[] }) {
  // Initialise to the SSR-safe default; the real goal is read from
  // localStorage on mount (avoids caching the SSR snapshot on hydration).
  const [goal, setGoal] = useState<number>(DEFAULT_GOAL);
  useEffect(() => {
    const sync = () => setGoal(readGoal());
    sync();
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const changeGoal = (delta: number) => {
    const next = Math.min(14, Math.max(1, goal + delta));
    writeGoal(next);
    setGoal(next);
  };

  const histArr = hist ?? [];
  // Exams in the last 7 days (app.js renderTrend).
  const wk = histArr.filter((h) => h.when >= Date.now() - WEEK_MS).length;
  const pct = Math.min(100, Math.round((wk / Math.max(1, goal)) * 100));
  // Last 14 exams, oldest-first for display.
  const last = histArr.slice(0, 14).reverse();

  return (
    <div id="trendBox">
      <div className="prog-row">
        <div className="lbl">
          <span>Mục tiêu tuần</span>
          <span>
            {' '}
            {wk}/{goal} đề
          </span>
        </div>
        <div className="pbar">
          <i style={{ width: `${pct}%` }}></i>
        </div>
        <div className="row">
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => changeGoal(-1)}
            aria-label="Giảm mục tiêu"
          >
            −
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => changeGoal(1)}
            aria-label="Tăng mục tiêu"
          >
            +
          </button>
        </div>
      </div>

      {last.length ? (
        <div style={{ marginTop: 14 }}>
          {last.map((h, i) => (
            <div className="trow" key={i}>
              <span>{new Date(h.when).toLocaleDateString('vi-VN')}</span>
              <span className="pbar">
                <i style={{ width: `${h.point * 10}%` }}></i>
              </span>
              <b>{h.point.toFixed(1)}</b>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">Làm bài để thấy biểu đồ điểm ở đây.</p>
      )}
    </div>
  );
}
