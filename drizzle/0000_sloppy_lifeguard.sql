CREATE TABLE "ai_generated_tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"criteria" jsonb,
	"questions" jsonb,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "exam_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"subject" text NOT NULL,
	"lesson" integer NOT NULL,
	"point" real,
	"ok" integer,
	"wrong" integer,
	"skip" integer,
	"total" integer,
	"time_seconds" integer,
	"is_practice" boolean,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "passages" (
	"passage_id" text PRIMARY KEY NOT NULL,
	"title" text,
	"text" text
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" text PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"lesson" integer NOT NULL,
	"type" text,
	"topic" text,
	"difficulty" text,
	"band" real,
	"question" text NOT NULL,
	"options" text[],
	"correct_answer" integer,
	"statements" jsonb,
	"explanation" text,
	"wrong_word" text,
	"correct_word" text,
	"source" text,
	"source_type" text,
	"source_url" text,
	"passage_id" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "theory" (
	"subject" text NOT NULL,
	"lesson" integer NOT NULL,
	"title" text,
	"description" text,
	"html" text,
	CONSTRAINT "theory_subject_lesson_pk" PRIMARY KEY("subject","lesson")
);
--> statement-breakpoint
CREATE TABLE "user_progress" (
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_progress_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
CREATE TABLE "vocabulary" (
	"unit" text NOT NULL,
	"en" text NOT NULL,
	"vi" text,
	"pos" text,
	"ipa" text,
	"kind" text,
	CONSTRAINT "vocabulary_unit_en_pk" PRIMARY KEY("unit","en")
);
