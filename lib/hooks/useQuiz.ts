/**
 * lib/hooks/useQuiz.ts — quiz state machine (port of app.js `E` state +
 * `startExam` / `renderQ` / `tick` / `submit` / keyboard / beforeunload).
 *
 * The hook holds runtime question state (shuffled opts + TF slots), the
 * answer/flag arrays, the current index, the countdown timer, and the final
 * `ExamScore`. Pure selection logic (pool) and scoring live in `lib/quiz/*`.
 *
 * @param cfg  exam config (from URL search params).
 */
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { pool, type ExamConfig, type AnsweredMap, typeOf } from '@/lib/quiz/pool';
import {
  mapToRuntime,
  scoreExam,
  type RuntimeQuestion,
  type ExamScore,
} from '@/lib/quiz/scoring';
import type { Question } from '@/lib/types';

export interface UseQuizReturn {
  /** Runtime questions currently in the exam. */
  qs: RuntimeQuestion[];
  /** MCQ answer per slot: option index (>=0) or -1 (unanswered/TF). */
  ans: number[];
  /** Flagged-for-review per slot. */
  flag: boolean[];
  /** Current question index. */
  i: number;
  /** Practice mode (answers + explanations shown). */
  practice: boolean;
  /** Seconds left on the clock. */
  timeLeft: number;
  /** Has `start()` been called. */
  started: boolean;
  /** Has the exam been submitted. */
  done: boolean;
  /** Final score (null until submitted). */
  score: ExamScore | null;
  /** Number of answered questions. */
  doneCount: number;
  /** 0–100 progress. */
  progressPct: number;
  /** Current question object. */
  current: RuntimeQuestion | undefined;
  /** Starred question ids (persisted to localStorage key `ontap12-v1`). */
  starred: Record<string, true>;

  start: (questions: Question[], answeredMap?: AnsweredMap) => void;
  answer: (idx: number) => void;
  tfAnswer: (idx: number, val: 0 | 1) => void;
  next: () => void;
  prev: () => void;
  goTo: (idx: number) => void;
  /** Toggle the "review" flag on the current question. */
  toggleFlag: () => void;
  /** Toggle "sổ tay" star on the current question id. */
  toggleStar: () => void;
  submit: () => ExamScore;
  /** Keyboard dispatcher — attach to the quiz viewport container. */
  onKeyDown: (e: React.KeyboardEvent<Element>) => void;
}

const STORAGE_KEY = 'ontap12-v1';

export function useQuiz(cfg: ExamConfig): UseQuizReturn {
  const [qs, setQs] = useState<RuntimeQuestion[]>([]);
  const [ans, setAns] = useState<number[]>([]);
  const [flag, setFlag] = useState<boolean[]>([]);
  const [i, setI] = useState(0);
  const [timeLeft, setTimeLeft] = useState(cfg.time * 60);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const [score, setScore] = useState<ExamScore | null>(null);
  const [starred, setStarred] = useState<Record<string, true>>({});

  const timerRef = useRef<number | null>(null);
  const limitRef = useRef<number>(0);

  const practice = !!cfg.practice;

  // Load starred from localStorage once.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setStarred((JSON.parse(raw)?.starred) || {});
    } catch {
      /* ignore */
    }
  }, []);

  /** Persist a single storage key back to `ontap12-v1` (keeps the legacy shape). */
  const saveState = useCallback((patch: (s: any) => void) => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const s = raw ? JSON.parse(raw) : {};
      patch(s);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }, []);

  const start = useCallback(
    (questions: Question[], answeredMap: AnsweredMap = {}) => {
      const selected = pool(questions, cfg, answeredMap);
      if (!selected.length) {
        // Mirror app.js: empty pool → nothing starts.
        setQs([]);
        setAns([]);
        setFlag([]);
        setI(0);
        setStarted(false);
        return;
      }
      const runtime = mapToRuntime(selected, cfg.shA !== false);
      // pool already shuffles question order when shQ !== false.
      setQs(runtime);
      setAns(new Array(runtime.length).fill(-1));
      setFlag(new Array(runtime.length).fill(false));
      setI(0);
      setTimeLeft(cfg.time * 60);
      setStarted(true);
      setDone(false);
      setScore(null);
      limitRef.current = cfg.time * 60;
    },
    [cfg],
  );

  const answer = useCallback(
    (idx: number) => {
      setAns((a) => {
        const next = a.slice();
        next[i] = idx;
        return next;
      });
    },
    [i],
  );

  const tfAnswer = useCallback(
    (idx: number, val: 0 | 1) => {
      setQs((list) => {
        const next = list.slice();
        const q = { ...next[i], tf: next[i].tf.slice() };
        q.tf[idx] = val;
        next[i] = q;
        return next;
      });
    },
    [i],
  );

  const goTo = useCallback((idx: number) => setI(Math.max(0, Math.min(idx, qs.length - 1))), [qs.length]);
  const next = useCallback(() => goTo(i + 1), [goTo, i]);
  const prev = useCallback(() => goTo(i - 1), [goTo, i]);

  const toggleFlag = useCallback(() => {
    setFlag((f) => {
      const next = f.slice();
      next[i] = !next[i];
      return next;
    });
  }, [i]);

  const toggleStar = useCallback(() => {
    const id = qs[i]?.id;
    if (!id) return;
    setStarred((star) => {
      const next = { ...star };
      if (next[id]) delete next[id];
      else next[id] = true;
      saveState((s) => {
        s.starred = next;
      });
      return next;
    });
  }, [i, qs, saveState]);

  const submit = useCallback((): ExamScore => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    const sc = scoreExam(qs, ans, cfg);
    setScore(sc);
    setDone(true);
    // Persist answer status to the legacy `answered` map (app.js submit lines 246).
    const status: Record<string, string> = {};
    qs.forEach((s, n) => {
      if (typeOf(s) === 'true_false') {
        const gd = (s.statements || []).reduce((m, t, k) => m + (s.tf[k] === (t.ok ? 1 : 0) ? 1 : 0), 0);
        const an = s.tf.filter((v) => v >= 0).length;
        status[s.id] = an === 0 ? 'skip' : gd === 4 ? 'ok' : 'bad';
      } else {
        status[s.id] = ans[n] >= 0 ? (s.opts[ans[n]]?.ok ? 'ok' : 'bad') : 'skip';
      }
    });
    saveState((s) => {
      s.answered = { ...(s.answered || {}), ...status };
    });
    return sc;
  }, [qs, ans, cfg, saveState]);

  // ── timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!started || done) return;
    const tick = () => {
      setTimeLeft((t) => {
        if (t <= 1) {
          // Auto-submit on timeout (app.js `tick`, line 171).
          // Use a microtask to read the latest score after submit.
          return 0;
        }
        return t - 1;
      });
    };
    // We need to auto-submit when timeLeft hits 0 — handle in a separate effect.
    timerRef.current = window.setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [started, done]);

  // Auto-submit when the clock hits 0.
  useEffect(() => {
    if (!started || done) return;
    if (timeLeft <= 0) {
      submit();
    }
  }, [timeLeft, started, done, submit]);

  // ── beforeunload warning (app.js line 237) ─────────────────────
  useEffect(() => {
    if (!started || done) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [started, done]);

  const doneCount = qs.reduce((n, s, idx) => {
    if (typeOf(s) === 'true_false') return n + (s.tf.some((v) => v >= 0) ? 1 : 0);
    return n + (ans[idx] >= 0 ? 1 : 0);
  }, 0);
  const progressPct = Math.round((doneCount / (qs.length || 1)) * 100);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<Element>) => {
      if (done) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key;
      if (key >= '1' && key <= '4') {
        const q = qs[i];
        if (q && typeOf(q) !== 'true_false') answer(+key - 1);
      } else if (key === 'ArrowRight') {
        next();
      } else if (key === 'ArrowLeft') {
        prev();
      }
    },
    [done, qs, i, answer, next, prev],
  );

  // Clean up the timer on unmount.
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  return {
    qs, ans, flag, i, practice, timeLeft, started, done, score,
    doneCount, progressPct,
    current: qs[i], starred,
    start, answer, tfAnswer, next, prev, goTo, toggleFlag, toggleStar, submit, onKeyDown,
  };
}
