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
import { readdirSync, readFileSync, existsSync } from 'node:fs';
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

  it('every journal entry has a snapshot file with a chained prevId', () => {
    // The 0002 SQL was hand-written (one-off neon-http apply), so its snapshot
    // had to be hand-chained too: 0002's table set equals 0001's (0002 only
    // backfills the CREATE the 0001 snapshot already declared), and
    // 0002.prevId === 0001.id. Without this guard the chain silently drifts
    // and the next `drizzle-kit generate` emits a spurious diff.
    const meta = path.join(process.cwd(), 'drizzle', 'meta');
    const journal = JSON.parse(readFileSync(path.join(meta, '_journal.json'), 'utf8'));
    // This repo names snapshots by journal idx (`0002_snapshot.json`), not by
    // the drizzle default `${tag}_snapshot.json`.
    let prevId: string | null = null;
    for (const entry of journal.entries) {
      const snapPath = path.join(meta, `${String(entry.idx).padStart(4, '0')}_snapshot.json`);
      expect(existsSync(snapPath), `missing snapshot for ${entry.tag}`).toBe(true);
      const snap = JSON.parse(readFileSync(snapPath, 'utf8'));
      if (prevId !== null) {
        expect(snap.prevId, `${entry.tag}.prevId must chain to the previous id`).toBe(prevId);
      }
      prevId = snap.id;
    }
  });
});
