/*
 * Seed script — push JSON data into Neon tables using Drizzle ORM.
 *
 * Idempotent (upsert) so it can be re-run safely.
 * Run with: npx tsx scripts/seed.mts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

// Dynamic imports after env is loaded (db/index.ts calls neon() at module eval time)
const { db } = await import('@/db/index');
const { questions, passages, theory, vocabulary } = await import('@/db/schema');
const { sql } = await import('drizzle-orm');

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readJson(name: string): any {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), 'data', name), 'utf8'),
  );
}

async function seedQuestions(data: any[]): Promise<void> {
  const rows = data.map((q: any) => ({
    id: q.id,
    subject: q.subject,
    lesson: q.lesson,
    type: q.type ?? null,
    topic: q.topic ?? null,
    difficulty: q.difficulty ?? null,
    band: q.band ?? null,
    question: q.question,
    options: q.options ?? null,
    correctAnswer: q.correctAnswer ?? null,
    statements: q.statements ?? null,
    answer: q.answer ?? null,
    maxLen: q.maxLen ?? null,
    explanation: q.explanation ?? null,
    wrongWord: q.wrongWord ?? null,
    correctWord: q.correctWord ?? null,
    source: q.source ?? null,
    sourceType: q.sourceType ?? null,
    sourceUrl: q.sourceUrl ?? null,
    passageId: q.passageId ?? null,
  }));

  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await db
      .insert(questions)
      .values(batch)
      .onConflictDoUpdate({
        target: questions.id,
        // excluded.* = the incoming row — actually overwrites on conflict.
        // (Referencing questions.x here is the OLD bug: it copies the
        // existing row onto itself, so edits never landed.)
        set: {
          subject: sql`excluded.subject`,
          lesson: sql`excluded.lesson`,
          type: sql`excluded.type`,
          topic: sql`excluded.topic`,
          difficulty: sql`excluded.difficulty`,
          band: sql`excluded.band`,
          question: sql`excluded.question`,
          options: sql`excluded.options`,
          correctAnswer: sql`excluded.correct_answer`,
          statements: sql`excluded.statements`,
          answer: sql`excluded.answer`,
          maxLen: sql`excluded.max_len`,
          explanation: sql`excluded.explanation`,
          wrongWord: sql`excluded.wrong_word`,
          correctWord: sql`excluded.correct_word`,
          source: sql`excluded.source`,
          sourceType: sql`excluded.source_type`,
          sourceUrl: sql`excluded.source_url`,
          passageId: sql`excluded.passage_id`,
        },
      });
    console.log(`  batch ${i / batchSize + 1}/${Math.ceil(rows.length / batchSize)}`);
  }
  console.log(`\u2705 questions: ${rows.length} rows`);
}

async function seedPassages(data: Record<string, { title: string; text: string }>): Promise<void> {
  const rows = Object.entries(data).map(([passageId, p]) => ({
    passageId,
    title: p.title ?? null,
    text: p.text ?? null,
  }));

  await db
    .insert(passages)
    .values(rows)
    .onConflictDoUpdate({
      target: passages.passageId,
      set: {
        title: sql`excluded.title`,
        text: sql`excluded.text`,
      },
    });
  console.log(`\u2705 passages: ${rows.length} rows`);
}

async function seedTheory(
  theoryData: Record<string, Record<string, any>>,
  englishTheory: Record<string, any>,
): Promise<void> {
  // Merge: english-theory.json is the english slice; merge into theory.json structure
  const merged = { ...theoryData, english: englishTheory };

  const rows: any[] = [];
  for (const subject of Object.keys(merged)) {
    for (const lesson of Object.keys(merged[subject])) {
      const t = merged[subject][lesson];
      rows.push({
        subject,
        lesson: Number(lesson),
        title: t.title ?? null,
        description: t.desc ?? null,
        html: t.html ?? null,
      });
    }
  }

  await db
    .insert(theory)
    .values(rows)
    .onConflictDoUpdate({
      target: [theory.subject, theory.lesson],
      set: {
        title: sql`excluded.title`,
        description: sql`excluded.description`,
        html: sql`excluded.html`,
      },
    });
  console.log(`\u2705 theory: ${rows.length} rows`);
}

async function seedVocabulary(data: Record<string, any[]>): Promise<void> {
  // Deduplicate on (unit, en) — keep last occurrence (more complete entry wins)
  const seen = new Map<string, any>();
  for (const unit of Object.keys(data)) {
    for (const entry of data[unit]) {
      seen.set(`${unit}|${entry.en}`, {
        unit,
        en: entry.en,
        vi: entry.vi ?? null,
        pos: entry.pos ?? null,
        ipa: entry.ipa ?? null,
        kind: entry.kind ?? null,
      });
    }
  }
  const rows = Array.from(seen.values());

  await db
    .insert(vocabulary)
    .values(rows)
    .onConflictDoUpdate({
      target: [vocabulary.unit, vocabulary.en],
      set: {
        vi: sql`excluded.vi`,
        pos: sql`excluded.pos`,
        ipa: sql`excluded.ipa`,
        kind: sql`excluded.kind`,
      },
    });
  console.log(`\u2705 vocabulary: ${rows.length} rows`);
}

async function main() {
  console.log('Loading data files...');
  const [qData, pData, tData, etData, vData] = await Promise.all([
    readJson('questions.json'),
    readJson('passages.json'),
    readJson('theory.json'),
    readJson('english-theory.json'),
    readJson('vocab.json'),
  ]);

  console.log('\nSeeding...');
  await seedQuestions(qData);
  await seedPassages(pData);
  await seedTheory(tData, etData);
  await seedVocabulary(vData);

  console.log('\n\u2723 Seed complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n\u274c Seed failed:', err);
  process.exit(1);
});
