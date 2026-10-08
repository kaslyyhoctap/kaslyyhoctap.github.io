/**
 * Shared types for the exam API routes.
 *
 * ExamStartRequest  → POST /api/exam/start
 * ExamSubmitRequest → POST /api/exam/submit
 */
import type { Question } from '@/lib/types';
import type { ExamConfig } from '@/lib/quiz/pool';
import type { RuntimeQuestion, ExamScore } from '@/lib/quiz/scoring';

/** Body for POST /api/exam/start — mirrors QuizParams with optional fields. */
export interface ExamStartRequest {
  subject: string;
  lesson: string | number;
  count?: number;
  time?: number;
  level?: string;
  qtype?: string;
  shQ?: boolean;
  shA?: boolean;
  practice?: boolean;
  quick?: boolean;
  ids?: string[];
  topic?: string;
  band?: number;
}

/** Success response from POST /api/exam/start. */
export interface ExamStartResponse {
  questions: Question[];
  /** Draft exam id (always undefined until draft persistence is implemented). */
  examId?: string;
}

/** Body for POST /api/exam/submit — the client sends the full runtime state
 * so the server can score deterministically (the option shuffle happens on
 * the client and can't be reproduced server-side). */
export interface ExamSubmitRequest {
  /** Per-slot answer: MCQ → option index (>=0) or -1 (unanswered). TF → -1 (answers live in tf[]). */
  answers: number[];
  /** Per-slot "review later" flag. */
  flags: boolean[];
  /** Elapsed time in seconds. */
  timeSec: number;
  /** Exam config (cfg.subject drives the english types breakdown in scoreExam). */
  cfg: ExamConfig;
  /** Runtime questions as seen by the user (shuffled opts + TF slots). */
  questions: RuntimeQuestion[];
}

/** Success response from POST /api/exam/submit — full ExamScore plus wrong IDs. */
export interface ExamSubmitResponse extends ExamScore {
  /** IDs of questions the user attempted but answered incorrectly. */
  wrongIds: string[];
}
