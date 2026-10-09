-- ai_explain_logs (explain-button quota accounting, declared in db/schema.ts
-- but never created by migration 0000 → authenticated /api/ai/explain 500'd):
CREATE TABLE IF NOT EXISTS "ai_explain_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"question_id" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
