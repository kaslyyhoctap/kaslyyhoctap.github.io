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
        set: {
          subject: questions.subject,
          lesson: questions.lesson,
          type: questions.type,
          topic: questions.topic,
          difficulty: questions.difficulty,
          band: questions.band,
          question: questions.question,
          options: questions.options,
          correctAnswer: questions.correctAnswer,
          statements: questions.statements,
          explanation: questions.explanation,
          wrongWord: questions.wrongWord,
          correctWord: questions.correctWord,
          source: questions.source,
          sourceType: questions.sourceType,
          sourceUrl: questions.sourceUrl,
          passageId: questions.passageId,
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
      set: { title: passages.title, text: passages.text },
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
        title: theory.title,
        description: theory.description,
        html: theory.html,
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
        vi: vocabulary.vi,
        pos: vocabulary.pos,
        ipa: vocabulary.ipa,
        kind: vocabulary.kind,
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
