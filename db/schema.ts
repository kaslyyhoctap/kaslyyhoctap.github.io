import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  integer,
  real,
  uuid,
  boolean,
  timestamp,
  jsonb,
  primaryKey,
} from 'drizzle-orm/pg-core';

/*
 * Drizzle ORM schema — 7 tables for the Ontap12 fullstack app.
 * All column names use explicit snake_case DB names; property names use camelCase.
 */

// ── 1. questions ─────────────────────────────────────────────────────
export const questions = pgTable('questions', {
  id: text('id').primaryKey(),
  subject: text('subject').notNull(), // 'history' | 'biology' | 'chemistry' | 'english'
  lesson: integer('lesson').notNull(),
  type: text('type'), // 'multiple_choice' | 'true_false' | 'cloze' | 'reading_comprehension' | 'word_usage_error'
  topic: text('topic'),
  difficulty: text('difficulty'), // 'Nhận biết' | 'Thông hiểu' | 'Vận dụng' | 'Vận dụng cao'
  band: real('band'), // IELTS band score (english only)
  question: text('question').notNull(),
  options: text('options').array(),
  correctAnswer: integer('correct_answer'),
  statements: jsonb('statements'), // true_false only: [{ t: string, ok: boolean }]
  answer: text('answer'), // short_answer only: expected short answer
  maxLen: integer('max_len'), // short_answer only: input maxLength
  explanation: text('explanation'),
  wrongWord: text('wrong_word'), // word_usage_error only
  correctWord: text('correct_word'),
  source: text('source'),
  sourceType: text('source_type'),
  sourceUrl: text('source_url'),
  passageId: text('passage_id'), // cloze / reading_comprehension only
  createdAt: timestamp('created_at').defaultNow(),
});

// ── 2. passages ──────────────────────────────────────────────────────
export const passages = pgTable('passages', {
  passageId: text('passage_id').primaryKey(),
  title: text('title'),
  text: text('text'),
});

// ── 3. theory ────────────────────────────────────────────────────────
export const theory = pgTable(
  'theory',
  {
    subject: text('subject').notNull(),
    lesson: integer('lesson').notNull(),
    title: text('title'),
    description: text('description'),
    html: text('html'),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.subject, table.lesson] }),
  }),
);

// ── 4. vocabulary ────────────────────────────────────────────────────
export const vocabulary = pgTable(
  'vocabulary',
  {
    unit: text('unit').notNull(),
    en: text('en').notNull(),
    vi: text('vi'),
    pos: text('pos'),
    ipa: text('ipa'),
    kind: text('kind'),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.unit, table.en] }),
  }),
);

// ── 5. user_progress ─────────────────────────────────────────────────
export const user_progress = pgTable(
  'user_progress',
  {
    userId: text('user_id').notNull(),
    key: text('key').notNull(),
    value: jsonb('value'),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.key] }),
  }),
);

// ── 6. exam_results ──────────────────────────────────────────────────
export const exam_results = pgTable('exam_results', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: text('user_id'), // nullable — anonymous submissions allowed
  subject: text('subject').notNull(),
  lesson: integer('lesson').notNull(),
  point: real('point'),
  ok: integer('ok'),
  wrong: integer('wrong'),
  skip: integer('skip'),
  total: integer('total'),
  timeSeconds: integer('time_seconds'),
  isPractice: boolean('is_practice'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ── 7. ai_generated_tests ────────────────────────────────────────────
export const ai_generated_tests = pgTable('ai_generated_tests', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: text('user_id').notNull(),
  criteria: jsonb('criteria'),
  questions: jsonb('questions'),
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at'),
});

// ── 8. ai_explain_logs ─────────────────────────────────────────────────
// Tracks explain-button usage for the 50-explanations-per-user-per-day quota.
export const ai_explain_logs = pgTable('ai_explain_logs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: text('user_id').notNull(),
  questionId: text('question_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ── 9-12. Auth.js (NextAuth) tables ─────────────────────────────────────
// These mirror @auth/drizzle-adapter's defineTables() defaults EXACTLY
// (table + column names incl. snake_case OAuth keys). Keep in sync: they
// are passed to DrizzleAdapter and generate the DB columns via DrizzleKit.
export const users = pgTable('user', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
});

export const accounts = pgTable(
  'account',
  {
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (table) => ({
    compositePk: primaryKey({
      columns: [table.provider, table.providerAccountId],
    }),
  }),
);

export const sessions = pgTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable(
  'verificationToken',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (table) => ({
    compositePk: primaryKey({ columns: [table.identifier, table.token] }),
  }),
);
