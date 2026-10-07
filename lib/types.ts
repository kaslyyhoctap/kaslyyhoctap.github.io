/**
 * TypeScript types mirroring the Drizzle schema (db/schema.ts) and the
 * raw data shapes from data/*.js. These are the canonical types used
 * across queries, API routes, and components.
 */

// ── Helper types ─────────────────────────────────────────────────────

/** A single statement in a true_false question. */
export interface Statement {
  t: string;
  ok: boolean;
}

// ── Table row types ──────────────────────────────────────────────────

/** A question from the `questions` table. */
export interface Question {
  id: string;
  subject: string; // 'history' | 'biology' | 'chemistry' | 'english'
  lesson: number;
  type?: string | null;
  topic?: string | null;
  difficulty?: string | null;
  band?: number | null; // IELTS band (english only)
  question: string;
  options?: string[] | null;
  correctAnswer?: number | null;
  statements?: Statement[] | null; // true_false only
  explanation?: string | null;
  wrongWord?: string | null; // word_usage_error only
  correctWord?: string | null;
  source?: string | null;
  sourceType?: string | null;
  sourceUrl?: string | null;
  passageId?: string | null;
  createdAt?: Date | null;
}

/** A reading passage from the `passages` table. */
export interface Passage {
  passageId: string;
  title?: string | null;
  text?: string | null;
}

/** Theory note for a (subject, lesson) pair from the `theory` table. */
export interface Theory {
  subject: string;
  lesson: number;
  title?: string | null;
  description?: string | null;
  html?: string | null;
}

/** A vocabulary entry from the `vocabulary` table. */
export interface Vocabulary {
  unit: string;
  en: string;
  vi?: string | null;
  pos?: string | null;
  ipa?: string | null;
  kind?: string | null;
}

/** One row from the `user_progress` table. */
export interface UserProgress {
  userId: string;
  key: string;
  value: Record<string, unknown>;
  updatedAt?: Date | null;
}

/** One row from the `exam_results` table. */
export interface ExamResult {
  id: string;
  userId?: string | null;
  subject: string;
  lesson: number;
  point?: number | null;
  ok?: number | null;
  wrong?: number | null;
  skip?: number | null;
  total?: number | null;
  timeSeconds?: number | null;
  isPractice?: boolean | null;
  createdAt?: Date | null;
}

/** Aggregated weakness analysis row (computed by `getWeakAreas`). */
export interface WeakArea {
  subject: string;
  topic: string;
  difficulty?: string | null;
  total: number;
  correct: number;
  accuracy: number; // 0–1 ratio
}
