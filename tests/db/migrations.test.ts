/**
 * tests/db/migrations.test.ts — schema/migration drift guard.
 *
 * Regression test for the outage where `db/schema.ts` declared the
 * `ai_explain_logs` table (explain-button quota accounting) but no migration
 * ever created it in the live DB: every authenticated POST /api/ai/explain
 * hit `countAiExplainRequests` on a missing relation and returned 500, and
 * the 50/day quota could never be counted.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** Concatenated SQL of every drizzle migration file, in name order. */
function migrationSql(): string {
  const dir = path.join(process.cwd(), 'drizzle');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(path.join(dir, f), 'utf8'))
    .join('\n');
}

describe('drizzle migrations', () => {
  it('creates the ai_explain_logs table declared in db/schema.ts', () => {
    expect(migrationSql()).toMatch(/CREATE TABLE (IF NOT EXISTS )?"ai_explain_logs"/i);
  });

  it('creates every column the explain queries read/write', () => {
    const sql = migrationSql();
    // countAiExplainRequests: user_id + created_at; logAiExplain: question_id.
    for (const col of ['"user_id"', '"question_id"', '"created_at"']) {
      expect(sql).toContain(col);
    }
  });
});
