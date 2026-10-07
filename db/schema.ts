import { pgTable, text, integer, real, timestamp, jsonb } from 'drizzle-orm/pg-core';

/*
 * Drizzle schema stubs — full schema defined in Phase 1 (Task 1.2).
 * This stub exists so drizzle.config.ts resolves without errors during scaffolding.
 */

export const questions = pgTable('questions', {
  id: text('id').primaryKey(),
  subject: text('subject').notNull(),
  lesson: integer('lesson').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const passages = pgTable('passages', {
  id: text('id').primaryKey(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const theory = pgTable('theory', {
  id: text('id').primaryKey(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const vocabulary = pgTable('vocabulary', {
  id: text('id').primaryKey(),
  createdAt: timestamp('created_at').defaultNow(),
});
