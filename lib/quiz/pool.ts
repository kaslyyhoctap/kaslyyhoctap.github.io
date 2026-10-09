/**
 * lib/quiz/pool.ts — question-pool selection.
 *
 * Faithful port of app.js `pool()` (lines 122–153), `pickFresh()` (121),
 * `recentMap()` (120), `typeOf()` (22), `blankNo()` (34) and `shuffle()` (31).
 *
 * Made PURE: the global bank `Q` is passed in as `questions`; the "recently
 * answered" priority map (derived from `S.hist` in the original) is passed in
 * as `answeredMap` so the function is deterministic and unit-testable.
 *
 * The `toast()` side-effect in the english level/cloze branch is intentionally
 * dropped — a pure selector cannot toast.
 */
import type { Question } from '@/lib/types';
import { type QuizParams } from './urls';

/** Exam configuration — mirrors app.js `o` (line 106) plus the drill `ids`. */
export interface ExamConfig extends Omit<QuizParams, 'practice'> {
  practice: boolean;
  ids?: string[];
  /** Filter by topic (used by weakness-drill). */
  topic?: string;
  /** Filter by IELTS band (used by weakness-drill). */
  band?: number;
}

/**
 * Map of question ids that were answered recently (last 3 exam histories in
 * the original app). `pool` / `pickFresh` deprioritise these so fresh
 * questions are selected first.
 */
export type AnsweredMap = Record<string, true>;

/**
 * Clamp an unknown (URL search-param) value to an integer in [min, max].
 * Non-finite / non-numeric → `def`. (B06: `Number(x) || default` passed
 * negatives through — count=-5 selected 85 questions, time=-5
 * instant-submitted. URL params arrive as strings, so numeric strings are
 * floored and clamped like numbers.)
 */
export function clampInt(
  v: unknown,
  min: number,
  max: number,
  def: number,
): number {
  const n = Number(v);
  return Number.isFinite(n)
    ? Math.min(max, Math.max(min, Math.floor(n)))
    : def;
}

/**
 * Question type label, defaulting to `multiple_choice` (app.js `typeOf`,
 * line 22).
 */
export function typeOf(q: Question): string {
  return q.type || 'multiple_choice';
}

/**
 * Cloze blank number parsed from the `(N)` placeholder in a question's text
 * (app.js `blankNo`, line 34).
 */
export function blankNo(q: Question): string | null {
  const m = /\((\d+)\)/.exec(q.question || '');
  return m ? m[1] : null;
}

/**
 * Fisher–Yates shuffle returning a NEW array (app.js `shuffle`, line 31).
 * Never mutates the input.
 */
export function shuffle<T>(a: T[]): T[] {
  const out = a.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = out[i];
    out[i] = out[j];
    out[j] = t;
  }
  return out;
}

/**
 * Build a list of ids from the last N exam-history records (app.js
 * `recentMap`, line 120). Pure — takes history id-lists as input.
 */
export function buildRecentMap(histIds: string[][], take: number = 3): AnsweredMap {
  const r: AnsweredMap = {};
  const recent = (histIds || []).slice(-take);
  for (const ids of recent) {
    for (const id of ids) r[id] = true;
  }
  return r;
}

/**
 * pickFresh: if `shQ !== false`, shuffle first; then stable-sort so that any
 * id present in `answeredMap` sinks to the tail (answered questions last).
 * (app.js `pickFresh`, line 121.)
 */
export function pickFresh(
  arr: Question[],
  n: number,
  shQ: boolean = true,
  answeredMap: AnsweredMap = {},
): Question[] {
  const a = shQ !== false ? shuffle(arr) : arr.slice();
  const sorted = a.slice().sort(
    (x, y) => (answeredMap[x.id] ? 1 : 0) - (answeredMap[y.id] ? 1 : 0),
  );
  return sorted.slice(0, Math.min(n, sorted.length));
}

/**
 * Pool: select `opts.count` questions from `questions` (the full subject bank,
 * i.e. app.js global `Q`) matching the exam configuration.
 *
 * Faithfully ports app.js lines 122–153. Returns ≤ `count` questions, each
 * unique by id. Question ORDER is shuffled by `pickFresh` when `shQ !== false`.
 */
export function pool(
  questions: Question[],
  opts: ExamConfig,
  answeredMap: AnsweredMap = {},
): Question[] {
  const N = opts.count;
  const shQ = opts.shQ !== false;

  // ── ids branch (app.js line 123) ──────────────────────────────
  if (opts.ids && opts.ids.length) {
    const seen: Record<string, true> = {};
    const arr: Question[] = [];
    opts.ids.forEach((id) => {
      const q = questions.find((qq) => qq.id === id);
      if (q && !seen[id]) {
        seen[id] = true;
        arr.push(q);
      }
    });
    return pickFresh(arr, opts.count || arr.length, shQ, answeredMap);
  }

  // ── base filter (app.js line 124, checkbox era: lesson/qtype can be arrays) ──
  // 'all' (or empty array) means no filtering; a scalar is a 1-element array.
  const lessonRaw = opts.lesson;
  const lessons =
    lessonRaw === 'all' || lessonRaw == null
      ? null
      : (Array.isArray(lessonRaw) ? lessonRaw.map(String) : [String(lessonRaw)]);
  const qtypeRaw = opts.qtype;
  const qts =
    qtypeRaw === 'all' || qtypeRaw == null
      ? null
      : (Array.isArray(qtypeRaw) ? qtypeRaw.slice() : [qtypeRaw as string]);

  // ponytail: short_answer có trong bank (Xem ngân hàng câu hỏi) nhưng UI
  // nhập đáp án chưa được port — tạm bỏ khỏi mọi đề; đưa vào khi có ô nhập.
  let base = questions.filter((q) => {
    if (q.subject !== opts.subject) return false;
    if (lessons && !lessons.includes(String(q.lesson))) return false;
    if (opts.level && opts.level !== 'all' && q.difficulty !== opts.level) return false;
    if (opts.topic && q.topic !== opts.topic) return false;
    if (opts.band && q.band !== +opts.band) return false;
    if (typeOf(q) === 'short_answer') return false;
    return true;
  });
  // Checked type boxes (app.js line 129): keep only the requested types.
  if (qts) base = base.filter((q) => qts.includes(typeOf(q)));

  // ── chemistry: 2 true_false + 30% hard quota + rest (app.js line 130) ──
  // Only for the unfiltered ("Tất cả") case — a type checkbox set wins.
  if (opts.subject === 'chemistry' && !qts) {
    const tfs = base.filter((q) => typeOf(q) === 'true_false');
    const k = Math.min(2, tfs.length, N);
    const sel = pickFresh(tfs, k, shQ, answeredMap);
    const isHard = (q: Question) =>
      q.difficulty === 'Vận dụng' || q.difficulty === 'Vận dụng cao';
    // Hóa: mỗi đề ≥30% câu khó (Vận dụng / Vận dụng cao) khi ≥10 câu, mọi mức độ.
    const hNeed =
      (!opts.level || opts.level === 'all') && N >= 10
        ? Math.max(0, Math.ceil(N * 0.3) - sel.filter(isHard).length)
        : 0;
    const hPool = base.filter(
      (q) => typeOf(q) !== 'true_false' && isHard(q) && !sel.includes(q),
    );
    const hardSel = pickFresh(hPool, Math.min(hNeed, hPool.length), shQ, answeredMap);
    const picked = sel.concat(hardSel);
    const used = new Set(picked.map((q) => q.id));
    const rest = base.filter((q) => !used.has(q.id));
    const final = picked.concat(pickFresh(rest, N - picked.length, shQ, answeredMap));
    return shQ ? shuffle(final) : final;
  }

  // ── history / biology ─────────────────────────────────────────
  if (opts.subject !== 'english') {
    return pickFresh(base, N, shQ, answeredMap);
  }

  // ── english (app.js line 132) ─────────────────────────────────
  // qt: 'all' (no type filter) | the single checked type | 'multi'.
  const qt = !qts ? 'all' : qts.length === 1 ? qts[0] : 'multi';

  // Single question-type requested.
  if (qt !== 'all' && qt !== 'multi') {
    const only = base.filter((q) => typeOf(q) === qt);

    // cloze / reading_comprehension: keep whole passage blocks together
    // (app.js lines 128–129).
    if (qt === 'cloze' || qt === 'reading_comprehension') {
      const gs: Record<string, Question[]> = {};
      only.forEach((q) => {
        const p = q.passageId || 'x';
        (gs[p] = gs[p] || []).push(q);
      });
      let gl = Object.keys(gs).map((p) => gs[p]);

      // fullLen: how many cloze/reading questions exist for each passage in
      // the entire english bank (app.js `Q` here == `questions`).
      const fullLen: Record<string, number> = {};
      questions
        .filter((q) => q.subject === 'english' && q.passageId)
        .forEach((q) => {
          fullLen[q.passageId!] = (fullLen[q.passageId!] || 0) + 1;
        });

      gl = gl.filter((g) => {
        const p = g[0].passageId;
        return !p || g.length === (fullLen[p] ?? g.length);
      });

      if (shQ) gl = shuffle(gl);

      const take: Question[] = [];
      let n = N;
      gl.forEach((g) => {
        if (take.length + g.length <= n) take.push(...g);
      });
      if (!take.length && gl.length) take.push(...gl[0].slice(0, n));
      return take;
    }

    return pickFresh(only, N, shQ, answeredMap);
  }

  // ── english, all types (app.js lines 131–153) ──────────────────
  const mc = base.filter((q) => typeOf(q) === 'multiple_choice');
  const wue = base.filter((q) => typeOf(q) === 'word_usage_error');
  const cm = base.filter((q) => typeOf(q) === 'closest_meaning');

  const groups: Record<string, Question[]> = {};
  base
    .filter((q) => typeOf(q) === 'cloze' || typeOf(q) === 'reading_comprehension')
    .forEach((q) => {
      const p = q.passageId || 'x';
      (groups[p] = groups[p] || []).push(q);
    });

  // Sort each passage-group by blankNo ascending (app.js line 137).
  const ps = Object.keys(groups).map((p) =>
    groups[p].slice().sort((a, b) => {
      const ba = blankNo(a) || '';
      const bb = blankNo(b) || '';
      return ba < bb ? -1 : 1;
    }),
  );

  const wantWUE = N >= 30 ? 5 : N >= 20 ? 3 : 1;
  const wantCM = N >= 30 ? 5 : N >= 20 ? 2 : 1;
  const wueSel = pickFresh(wue, wantWUE, shQ, answeredMap);
  const cmSel = pickFresh(cm, wantCM, shQ, answeredMap);
  const budget = N - wueSel.length - cmSel.length;

  // fullLen across the whole english bank (app.js line 143).
  const fullLen: Record<string, number> = {};
  questions
    .filter((q) => q.subject === 'english' && q.passageId)
    .forEach((q) => {
      fullLen[q.passageId!] = (fullLen[q.passageId!] || 0) + 1;
    });

  // fullPs: passage-groups whose size matches the bank (complete passages only).
  // When shQ, shuffle the passage order (app.js `if(o.shQ!==false)fullPs=shuffle(fullPs)`).
  const passGroups = ps.filter((g) => {
    const p = g[0].passageId;
    // null passageId → treat as complete (mirrors `fullLen[p]||g.length` in JS).
    return !p || g.length === (fullLen[p] ?? g.length);
  });
  const fullPs = shQ ? shuffle(passGroups) : passGroups;

  // maxPass: how many full passages to pull in (app.js line 146–151).
  // (The cloze/reading special case lives in the single-type branch above.)
  let maxPass: number;
  if (opts.lesson === 'all') {
    maxPass = N >= 40 ? Math.min(2, fullPs.length) : Math.min(1, fullPs.length);
  } else {
    maxPass = Math.min(1, fullPs.length);
  }

  const clozeSel: Question[] = [];
  fullPs.slice(0, maxPass).forEach((g) => {
    if (clozeSel.length + g.length <= budget) clozeSel.push(...g);
  });

  // NOTE: original `toast(...)` here is dropped (pure function).
  // if (opts.level && opts.level !== 'all' && ps.length && !clozeSel.length) ...

  const mcSel = pickFresh(mc, Math.max(budget - clozeSel.length, 0), shQ, answeredMap);
  let sel = mcSel.concat(clozeSel, wueSel, cmSel);

  // Top up to N from the remaining base (excluding cloze, already pooled).
  if (sel.length < N) {
    const used: Record<string, true> = {};
    sel.forEach((q) => {
      used[q.id] = true;
    });
    sel = sel.concat(
      pickFresh(
        base.filter((q) => !used[q.id] && typeOf(q) !== 'cloze'),
        N - sel.length,
        shQ,
        answeredMap,
      ),
    );
  }

  return sel.slice(0, Math.min(N, sel.length));
}
