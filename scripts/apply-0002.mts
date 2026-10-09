/* One-off: apply drizzle/0002 (create the ai_explain_logs table) via the app's
 * neon-http connection — drizzle-kit push hangs on the websocket driver here.
 * Run: bun scripts/apply-0002.mts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
const { neon } = await import('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL!);

await sql`
  CREATE TABLE IF NOT EXISTS "ai_explain_logs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" text NOT NULL,
    "question_id" text,
    "created_at" timestamp DEFAULT now()
  )
`;

// Round-trip proof (count/insert/delete) so the quota queries in
// lib/db/queries.ts have a live table to hit — then leave the table empty.
await sql`INSERT INTO "ai_explain_logs" ("user_id", "question_id") VALUES ('_probe', '_probe')`;
const afterInsert = await sql`SELECT count(*)::int AS n FROM "ai_explain_logs"`;
await sql`DELETE FROM "ai_explain_logs" WHERE "user_id" = '_probe'`;
const afterDelete = await sql`SELECT count(*)::int AS n FROM "ai_explain_logs"`;

console.log(
  'ai_explain_logs: rows after insert =',
  afterInsert[0].n,
  '| after cleanup =',
  afterDelete[0].n,
);
process.exit(0);
