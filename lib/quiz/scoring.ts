/**
 * lib/quiz/scoring.ts — exam scoring + verdict.
 *
 * Ports app.js `verdict()` (line 238) and the scoring loop inside
 * `submit()` (lines 242–256). Pure: no localStorage mutation, no DOM.
 *
 * `scoreExam` consumes *runtime* questions — i.e. base `Question` objects that
 * have already been mapped by `mapToRuntime` (shuffled `opts` with `ok` flags for
 * MCQ, and a `tf` answer-slot array for true/false). The quiz hook produces
 * these; tests can use the exported `mapToRuntime` helper.
 */
import type { Question, Statement } from '@/lib/types';
import { typeOf, shuffle } from './pool';
import type { ExamConfig } from './pool';

/** A question that carries its runtime answer state. */
export interface RuntimeQuestion extends Question {
  /** MCQ: options shuffled, each tagged with whether it's correct. TF: `[]`. */
  opts: { t: string; ok: boolean }[];
  /** TF: per-statement answer slot, -1=unanswered, 0=Sai (false), 1=Đúng (true). MCQ: `[]`. */
  tf: number[];
}

/** Verdict label + CSS class pair (app.js `verdict`, line 238). */
export type Verdict = [text: string, cssClass: string];

export function verdict(point: number): Verdict {
  if (point < 5) return ['Cần cố gắng', 'low'];
  if (point < 6.5) return ['Đạt', 'mid'];
  if (point < 8) return ['Khá', 'mid'];
  if (point < 9) return ['Tốt', 'good'];
  return ['Xuất sắc', 'good'];
}

export interface TopicStat {
  ok: number;
  tot: number;
}

export interface ExamScore {
  point: number;
  ok: number;
  bad: number;
  skip: number;
  total: number;
  verdict: string;
  verdictClass: string;
  topics: Record<string, TopicStat>;
  types: Record<string, TopicStat>;
}

/** Map base questions into runtime form (app.js `startExam` list-map, lines 164–166). */
export function mapToRuntime(questions: Question[], shA: boolean = true): RuntimeQuestion[] {
  return questions.map((q) => {
    if (typeOf(q) === 'true_false') {
      return { ...q, opts: [], tf: [-1, -1, -1, -1] };
    }
    const opts = (q.options || []).map((t, i) => ({ t, ok: i === q.correctAnswer }));
    const shuffled = shA !== false ? shuffle(opts) : opts;
    return { ...q, opts: shuffled, tf: [] };
  });
}

/**
 * Score an exam (app.js `submit` scoring loop, lines 242–256).
 *
 * - `qs`: runtime questions (see `mapToRuntime`) in display order.
 * - `ans`: parallel answer array. MCQ → chosen option index (>=0) or -1 skip.
 *   For true/false questions the per-statement answers live in `qs[n].tf`;
 *   `ans[n]` is expected to be -1 for TF slots (mirrors the original where TF
 *   never touches `E.ans`).
 * - `cfg`: exam config (only `cfg.subject` is read, for the english `types`
 *   breakdown).
 */
export function scoreExam(qs: RuntimeQuestion[], ans: number[], cfg: ExamConfig): ExamScore {
  let ok = 0;
  let bad = 0;
  let skip = 0;
  let pts = 0;
  const topics: Record<string, TopicStat> = {};
  const types: Record<string, TopicStat> = {};

  qs.forEach((s, n) => {
    const q = s;
    const a = ans[n];
    let st: 'ok' | 'bad' | 'skip';
    let fr = 0;

    if (typeOf(q) === 'true_false') {
      // Correct count across 4 statements (app.js line 244).
      const statements = q.statements || [];
      const gd = statements.reduce(
        (m, t, i) => m + (s.tf[i] === (t.ok ? 1 : 0) ? 1 : 0),
        0,
      );
      const an = s.tf.filter((v) => v >= 0).length;
      st = an === 0 ? 'skip' : gd === 4 ? 'ok' : 'bad';
      // Points: 4/4=1, 3/4=0.5, 2/4=0.25, else 0 (app.js line 244).
      fr = gd === 4 ? 1 : gd === 3 ? 0.5 : gd === 2 ? 0.25 : 0;
    } else {
      st = a >= 0 ? (s.opts[a]?.ok ? 'ok' : 'bad') : 'skip';
      fr = st === 'ok' ? 1 : 0;
    }

    pts += fr;
    if (st === 'ok') {
      ok++;
    } else if (st === 'bad') {
      bad++;
    } else {
      skip++;
    }

    // Topic breakdown (all subjects).
    const tkey = q.topic ?? '';
    const tp = (topics[tkey] = topics[tkey] || { ok: 0, tot: 0 });
    tp.tot++;
    if (st === 'ok') tp.ok++;

    // Type breakdown (english only — app.js line 249).
    if (cfg.subject === 'english') {
      const ty = (types[typeOf(q)] = types[typeOf(q)] || { ok: 0, tot: 0 });
      ty.tot++;
      if (st === 'ok') ty.ok++;
    }
  });

  const total = qs.length;
  const point = Math.round((pts / total) * 100) / 10;
  const [vText, vClass] = verdict(point);

  return {
    point,
    ok,
    bad,
    skip,
    total,
    verdict: vText,
    verdictClass: vClass,
    topics,
    types,
  };
}

/** Re-evaluate a single question's status for the review list (app.js `tfSt`, line 177). */
export function questionStatus(q: Question, runtime: RuntimeQuestion, ansIdx: number): 'ok' | 'bad' | 'skip' {
  if (typeOf(q) === 'true_false') {
    const statements = q.statements || [];
    const gd = statements.reduce(
      (m, t, i) => m + (runtime.tf[i] === (t.ok ? 1 : 0) ? 1 : 0),
      0,
    );
    const an = runtime.tf.filter((v) => v >= 0).length;
    return an === 0 ? 'skip' : gd === 4 ? 'ok' : 'bad';
  }
  return ansIdx >= 0 ? (runtime.opts[ansIdx]?.ok ? 'ok' : 'bad') : 'skip';
}
