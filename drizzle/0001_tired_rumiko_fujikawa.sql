-- short_answer support (legacy app.js short-answer feature, data 2026-10-09):
ALTER TABLE "questions" ADD COLUMN "answer" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "max_len" integer;
