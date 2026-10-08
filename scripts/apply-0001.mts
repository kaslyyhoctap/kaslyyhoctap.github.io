/* One-off: apply drizzle/0001 (answer + max_len columns) via the app's
 * neon-http connection — drizzle-kit push hangs on the websocket driver here.
 * Run: bun scripts/apply-0001.mts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
const { neon } = await import('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL!);
await sql`ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "answer" text`;
await sql`ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "max_len" integer`;

const cols = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'questions' AND column_name IN ('answer', 'max_len')
`;
console.log('columns present:', cols.map((c: any) => c.column_name));
process.exit(0);
