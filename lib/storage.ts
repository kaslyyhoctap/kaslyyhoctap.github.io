/**
 * Client-side hook for reading the legacy `ontap12-v1` localStorage state.
 *
 * In the original vanilla SPA, all user data (theme, best score, exams,
 * answered map, progress, starred, etc.) lived in a single localStorage
 * object under key `ontap12-v1`. This hook provides read-only access so
 * that Server Components can receive DB data as props while Client
 * Components (Hero, SubjectCard, LessonCard) can read per-user progress.
 */
'use client';

import { useEffect, useState } from 'react';

export const STORAGE_KEY = 'ontap12-v1';

export interface AppState {
  best: number;
  exams: number;
  correct: number;
  answered: Record<string, string>;
  marked: string[];
  hist: any[];
  prog: Record<string, Record<number, number>>;
  vocabKnown: Record<string, boolean>;
  starred: Record<string, boolean>;
}

const DEFAULT_STATE: AppState = {
  best: 0,
  exams: 0,
  correct: 0,
  answered: {},
  marked: [],
  hist: [],
  prog: {},
  vocabKnown: {},
  starred: {},
};

export function readAppState(): AppState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STATE, ...parsed } as AppState;
  } catch {
    return DEFAULT_STATE;
  }
}

/** Persist the full app state to localStorage under STORAGE_KEY. */
export function writeAppState(state: Partial<AppState>): void {
  if (typeof window === 'undefined') return;
  try {
    const current = readAppState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...state }));
  } catch {
    /* ignore — localStorage full or private mode */
  }
}

/** Hook that reads localStorage and re-reads on `storage` events. */
export function useAppState(): AppState {
  // T2 P2: useState(readAppState()) renders stored data on the FIRST client
  // render while SSR emitted the default-empty state → React 19 discards +
  // regenerates the tree (hydration pageerrors on /progress, /notebook,
  // /vocab). Render the default on first client render too, then re-read
  // after mount so SSR html == first client html. Data appears one frame
  // later; consumers already handle the empty state (skeletons/empties).
  const [state, setState] = useState<AppState>(DEFAULT_STATE);

  useEffect(() => {
    setState(readAppState());
    const handler = () => setState(readAppState());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return state;
}

/** Average progress across all lessons for a subject (app.js `subjProg`). */
export function subjProg(
  sub: string,
  lessons: number[],
  prog: Record<string, Record<number, number>>,
): number {
  const p = prog[sub] || {};
  const vals = lessons.map((l) => p[l] || 0);
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
}

/** Per-lesson progress (app.js `(S.prog[k]||{})[l]||0`). */
export function lessonProg(
  sub: string,
  lesson: number,
  prog: Record<string, Record<number, number>>,
): number {
  return prog[sub]?.[lesson] || 0;
}

/** Format a unit prefix: Unit→U, Chương→C, Bài→B. */
export function unitPrefix(units: string): string {
  return units === 'Unit' ? 'U' : units === 'Chương' ? 'C' : 'B';
}
