import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  // Output directory for generated migrations (using push, not generate)
  out: './drizzle',
  // Schema location — TypeScript schema via drizzle-orm
  schema: './db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Verbose output during push
  verbose: true,
  // Strict mode ensures type safety in schema
  strict: true,
});
