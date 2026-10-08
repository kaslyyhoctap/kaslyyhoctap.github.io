/**
 * Data-access layer (Drizzle ORM).
 *
 * Reads against the 7 schema tables in `db/schema.ts`; writes touch
 * `user_progress` and `exam_results`. Analytics (`getWeakAreas`) aggregates
 * the per-question answer map stored under `user_progress.key = 'answered'`
 * together with the `questions` table.
 *
 * @see lib/types.ts for the domain interfaces used here.
 */

import { db } from '@/db';
import {
  questions,
  passages,
  theory,
  vocabulary,
  user_progress,
  exam_results,
  ai_generated_tests,
  ai_explain_logs,
  users,
} from '@/db/schema';
import { and, desc, eq, gte, inArray, sql, type SQLWrapper } from 'drizzle-orm';
import type {
  Question,
  Passage,
  Vocabulary,
  ExamResult,
  WeakArea,
  ExamResultInput,
  SubjectMeta,
} from '@/lib/types';

/** user_progress row key that stores the per-question answer map. */
const ANSWERED_KEY = 'answered';

// ── Reads (public) ───────────────────────────────────────────────────

/**
 * Count questions matching the same filter set as getQuestions — used for
 * pagination totals in the questions API.
 */
export async function countQuestions(opts?: {
  subject?: string;
  lesson?: number;
  type?: string;
  difficulty?: string;
  topic?: string;
}): Promise<number> {
  const { subject, lesson, type, difficulty, topic } = opts ?? {};

  const conds: SQLWrapper[] = [];
  if (subject !== undefined) conds.push(eq(questions.subject, subject));
  if (lesson !== undefined) conds.push(eq(questions.lesson, lesson));
  if (type !== undefined) conds.push(eq(questions.type, type));
  if (difficulty !== undefined) conds.push(eq(questions.difficulty, difficulty));
  if (topic !== undefined) conds.push(eq(questions.topic, topic));
  const whereClause = conds.length > 0 ? and(...conds) : undefined;

  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(questions)
    .where(whereClause);
  return Number(rows[0]?.count ?? 0);
}

export async function getQuestions(opts?: {
  subject?: string;
  lesson?: number;
  type?: string;
  difficulty?: string;
  topic?: string;
  limit?: number;
  offset?: number;
}): Promise<Question[]> {
  const { subject, lesson, type, difficulty, topic, limit, offset } = opts ?? {};

  const conds: SQLWrapper[] = [];
  if (subject !== undefined) conds.push(eq(questions.subject, subject));
  if (lesson !== undefined) conds.push(eq(questions.lesson, lesson));
  if (type !== undefined) conds.push(eq(questions.type, type));
  if (difficulty !== undefined) conds.push(eq(questions.difficulty, difficulty));
  if (topic !== undefined) conds.push(eq(questions.topic, topic));

  const whereClause = conds.length > 0 ? and(...conds) : undefined;

  // Single fluent chain — Drizzle's per-clause variants aren't assignable back
  // to the base builder, so avoid reassigning a `let`. `.where` accepts
  // `undefined` (no filter); `limit`/`offset` need a number, so default them.
  return (await db
    .select()
    .from(questions)
    .where(whereClause)
    .orderBy(questions.id)
    .limit(limit ?? 1000)
    .offset(offset ?? 0)) as Question[];
}

export async function getQuestionById(id: string): Promise<Question | null> {
  const rows = await db
    .select()
    .from(questions)
    .where(eq(questions.id, id))
    .limit(1);
  return (rows[0] as Question | undefined) ?? null;
}

export async function getPassages(): Promise<Record<string, Passage>> {
  const rows = await db.select().from(passages);
  return Object.fromEntries(rows.map((p) => [p.passageId, p]));
}

export async function getTheory(
  subject: string,
  lesson: number,
): Promise<{ title: string | null; description: string | null; html: string | null } | null> {
  const rows = await db
    .select({
      title: theory.title,
      description: theory.description,
      html: theory.html,
    })
    .from(theory)
    .where(and(eq(theory.subject, subject), eq(theory.lesson, lesson)))
    .limit(1);
  return (rows[0] ?? null) as { title: string | null; description: string | null; html: string | null } | null;
}

export async function getVocabulary(unit: string): Promise<Vocabulary[]> {
  return db.select().from(vocabulary).where(eq(vocabulary.unit, unit));
}

export async function getSubjects(): Promise<SubjectMeta[]> {
  const rows = await db
    .select({
      subject: questions.subject,
      count: sql<number>`count(*)`,
      lessons: sql<number[]>`array_agg(DISTINCT ${questions.lesson})`,
    })
    .from(questions)
    .groupBy(questions.subject)
    .orderBy(questions.subject);

  return rows.map((r) => ({
    subject: r.subject,
    count: Number(r.count),
    lessons: Array.isArray(r.lessons) ? (r.lessons as number[]).map(Number) : [],
  }));
}

// ── Writes (user progress) ───────────────────────────────────────────

export async function saveUserProgress(
  userId: string,
  key: string,
  value: any,
): Promise<void> {
  await db
    .insert(user_progress)
    .values({ userId, key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [user_progress.userId, user_progress.key],
      set: { value, updatedAt: new Date() },
    });
}

export async function getUserProgress(userId: string): Promise<Record<string, any>> {
  const rows = await db
    .select()
    .from(user_progress)
    .where(eq(user_progress.userId, userId));
  const out: Record<string, any> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

// ── Exam results ────────────────────────────────────────────────────

export async function saveExamResult(result: ExamResultInput): Promise<void> {
  await db.insert(exam_results).values(result);
}

export async function getUserExamResults(
  userId: string,
  limit: number = 50,
): Promise<ExamResult[]> {
  return db
    .select()
    .from(exam_results)
    .where(eq(exam_results.userId, userId))
    .orderBy(desc(exam_results.createdAt))
    .limit(limit);
}

// ── Analytics ───────────────────────────────────────────────────────

type AnsweredQuestion = {
  id: string;
  subject: string;
  topic: string | null;
  difficulty: string | null;
};

/**
 * Pure aggregation used by `getWeakAreas`.
 *
 * `questions` is the set of questions the user has *attempted*; `answered`
 * maps question id → status (`"ok"` | `"bad"` | `"skip"`).
 *
 * Groups by (subject, topic, difficulty), keeps only groups with >= 3
 * attempts (matches the `>= 3` threshold in the original `weakStats()`), sorts
 * by accuracy ascending (worst first) with the larger group winning ties, and
 * returns the 3 worst.
 */
export function computeWeakAreas(
  questions: AnsweredQuestion[],
  answered: Record<string, string>,
): WeakArea[] {
  const groups = new Map<
    string,
    { subject: string; topic: string; difficulty: string | null; total: number; correct: number }
  >();

  for (const q of questions) {
    const status = answered[q.id];
    // Skip unanswered / explicitly skipped — only attempted answers count.
    if (!status || status === 'skip') continue;
    const topic = q.topic ?? '';
    const key = `${q.subject}|${topic}|${q.difficulty ?? ''}`;
    const g = groups.get(key) ?? {
      subject: q.subject,
      topic,
      difficulty: q.difficulty ?? null,
      total: 0,
      correct: 0,
    };
    g.total += 1;
    if (status === 'ok') g.correct += 1;
    groups.set(key, g);
  }

  return [...groups.values()]
    .filter((g) => g.total >= 3)
    .map((g) => ({
      subject: g.subject,
      topic: g.topic,
      difficulty: g.difficulty,
      total: g.total,
      correct: g.correct,
      accuracy: g.correct / g.total,
    }))
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total)
    .slice(0, 3);
}

export async function getWeakAreas(userId: string): Promise<WeakArea[]> {
  const [prog] = await db
    .select({ value: user_progress.value })
    .from(user_progress)
    .where(and(eq(user_progress.userId, userId), eq(user_progress.key, ANSWERED_KEY)));
  const answered = (prog?.value ?? {}) as Record<string, string>;

  const answeredIds = Object.keys(answered);
  if (answeredIds.length === 0) return [];

  const qs = await db
    .select({
      id: questions.id,
      subject: questions.subject,
      topic: questions.topic,
      difficulty: questions.difficulty,
    })
    .from(questions)
    .where(inArray(questions.id, answeredIds));

  return computeWeakAreas(qs, answered);
}

// ── AI features ────────────────────────────────────────────────────

/** Begin of "today" (midnight) for per-day rate limiting. */
export function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Criteria object stored alongside generated tests for cache lookup. */
export interface GenerateCriteria {
  subject: string;
  lesson: number | string;
  count: number;
  difficulty?: string | null;
}

/**
 * Count how many AI-generated tests the user has created since `since`
 * (used for the 5-generations-per-day quota).
 */
export async function countAiGenerateRequests(userId: string, since: Date): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(ai_generated_tests)
    .where(
      and(
        eq(ai_generated_tests.userId, userId),
        gte(ai_generated_tests.createdAt, since),
      ),
    );
  return Number(rows[0]?.count ?? 0);
}

/**
 * Return cached questions for identical criteria that haven't expired yet
 * (24 h TTL). Most-recent first.
 */
export async function getCachedAiTest(
  userId: string,
  criteria: GenerateCriteria,
): Promise<Question[] | null> {
  const rows = await db
    .select({ questions: ai_generated_tests.questions })
    .from(ai_generated_tests)
    .where(
      and(
        eq(ai_generated_tests.userId, userId),
        eq(ai_generated_tests.criteria, criteria),
        gte(ai_generated_tests.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(ai_generated_tests.createdAt))
    .limit(1);

  const raw = rows[0]?.questions;
  if (!raw) return null;
  return Array.isArray(raw) ? (raw as Question[]) : null;
}

/** Persist a generated test (questions + criteria) with a 24 h TTL. */
export async function saveAiTest(
  userId: string,
  criteria: GenerateCriteria,
  questions: Question[],
): Promise<void> {
  await db.insert(ai_generated_tests).values({
    userId,
    criteria,
    questions,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
}

/**
 * Count AI explain requests for the user since `since`
 * (used for the 50-explanations-per-day quota).
 */
export async function countAiExplainRequests(userId: string, since: Date): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(ai_explain_logs)
    .where(
      and(
        eq(ai_explain_logs.userId, userId),
        gte(ai_explain_logs.createdAt, since),
      ),
    );
  return Number(rows[0]?.count ?? 0);
}

/** Record a single explain request for rate-limit accounting. */
export async function logAiExplain(userId: string, questionId?: string): Promise<void> {
  await db.insert(ai_explain_logs).values({ userId, questionId });
}

// ── Admin: Question CRUD ────────────────────────────────────────────

/**
 * Insert a new question. `id` is caller-provided (text primary key), so
 * the input must include it. Returns the inserted row.
 */
export async function createQuestion(data: Omit<Question, 'createdAt'>): Promise<Question> {
  const rows = await db.insert(questions).values(data).returning();
  return rows[0] as Question;
}

/** Update an existing question by id. Returns the updated row or null. */
export async function updateQuestion(
  id: string,
  data: Partial<Omit<Question, 'createdAt'>>,
): Promise<Question | null> {
  const rows = await db
    .update(questions)
    .set(data)
    .where(eq(questions.id, id))
    .returning();
  return (rows[0] as Question | undefined) ?? null;
}

/** Delete a question by id. */
export async function deleteQuestion(id: string): Promise<void> {
  await db.delete(questions).where(eq(questions.id, id));
}

// ── Admin: aggregate stats ──────────────────────────────────────────

/** Count distinct registered users (from the auth `users` table). */
export async function countUsers(): Promise<number> {
  const rows = await db.select({ count: sql<number>`count(*)` }).from(users);
  return Number(rows[0]?.count ?? 0);
}

/**
 * Most-recent exam results across ALL users, newest first.
 * Used by the admin dashboard's "recent activity" panel.
 */
export async function getRecentExams(limit = 10): Promise<ExamResult[]> {
  return (await db
    .select()
    .from(exam_results)
    .orderBy(desc(exam_results.createdAt))
    .limit(limit)) as ExamResult[];
}
