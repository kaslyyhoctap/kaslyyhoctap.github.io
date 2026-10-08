/**
 * Shared quiz-URL builder.
 *
 * The legacy vanilla app built the exam config object client-side (`collectCfg`
 * / `startExam`) and kept it in memory. In the Next.js port the quiz page
 * (Task 3.5) reads its config from URL search params, so every "start quiz"
 * button — TestConfig form, LessonList cards, QuickQuiz, TheoryView — builds
 * its URL through `buildQuizUrl` to keep the param set consistent.
 *
 * Booleans are serialised as `true`/`false` strings (Next.js searchParams are
 * always strings); the quiz page parses them with `=== 'true'`.
 */

export interface QuizParams {
  subject: string;
  /** 'all' | a single lesson | several checked lessons (checkbox UI). */
  lesson: 'all' | string | number | (string | number)[];
  count: number;
  time: number;
  level?: string;
  /** 'all' | a single type | several checked types (checkbox UI). */
  qtype?: 'all' | string | string[];
  practice: boolean;
  shQ?: boolean;
  shA?: boolean;
  quick?: boolean;
  /** Optional question ids to drill a specific set (app.js `startExam` ids). */
  ids?: string[];
}

export function buildQuizUrl(p: QuizParams): string {
  const sp = new URLSearchParams();
  // Arrays (multi-checked) serialise comma-joined: lesson=1,3 qtype=a,b.
  const list = (v: 'all' | string | number | (string | number)[]) =>
    Array.isArray(v) ? v.map(String).join(',') : String(v);
  sp.set('subject', p.subject);
  sp.set('lesson', list(p.lesson));
  sp.set('count', String(p.count));
  sp.set('time', String(p.time));
  sp.set('level', p.level ?? 'all');
  sp.set('qtype', p.qtype == null ? 'all' : list(p.qtype));
  sp.set('practice', String(p.practice));
  sp.set('shQ', p.shQ === false ? 'false' : 'true');
  sp.set('shA', p.shA === false ? 'false' : 'true');
  if (p.quick) sp.set('quick', 'true');
  if (p.ids && p.ids.length) sp.set('ids', p.ids.join(','));
  return `/quiz?${sp.toString()}`;
}
