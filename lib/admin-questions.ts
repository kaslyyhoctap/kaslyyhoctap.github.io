/**
 * lib/admin-questions.ts — server-side validation for admin question writes.
 *
 * Mirrors the `validateQuestion` pattern in app/api/ai/generate/route.ts:
 * reject unknown fields, require the not-null columns on create, and check
 * the enum columns against the allowlists already in the codebase
 * (SUBJECTS / LEVELS / TYPES in lib/meta.ts).
 */
import { SUBJECTS, LEVELS, TYPES } from '@/lib/meta';

/** Writable columns of the `questions` table (everything except `createdAt`). */
const KNOWN_FIELDS = new Set([
  'id',
  'subject',
  'lesson',
  'type',
  'topic',
  'difficulty',
  'band',
  'question',
  'options',
  'correctAnswer',
  'statements',
  'answer',
  'maxLen',
  'explanation',
  'wrongWord',
  'correctWord',
  'source',
  'sourceType',
  'sourceUrl',
  'passageId',
]);

const DIFFICULTIES = LEVELS.filter((l) => l !== 'all');
const TYPE_KEYS = new Set(Object.keys(TYPES));

const nonEmpty = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;

/**
 * Validate an admin question body. Returns an error message, or null when
 * the body is acceptable. On PUT the `id`/`createdAt` keys are stripped
 * in place first (no PK reassignment — the URL id wins).
 */
export function validateQuestionInput(
  body: unknown,
  mode: 'POST' | 'PUT',
): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Thiếu nội dung câu hỏi.';
  }
  const b = body as Record<string, unknown>;

  if (mode === 'PUT') {
    // The admin QuestionForm sends its `id` in the PUT body — drop it (and
    // any forged createdAt) so the URL id is authoritative.
    delete b.id;
    delete b.createdAt;
  }

  for (const key of Object.keys(b)) {
    if (!KNOWN_FIELDS.has(key)) return `Trường không hợp lệ: ${key}.`;
  }

  // Empty update: PUT carries no writable field, so `.set({})` would throw
  // at the ORM layer. Reject it as a 400 with a clear message instead of
  // letting it surface as a 500.
  if (mode === 'PUT' && Object.keys(b).length === 0) {
    return 'Không có nội dung nào để cập nhật.';
  }

  if (mode === 'POST') {
    if (!nonEmpty(b.id)) return 'Thiếu id câu hỏi.';
    if (!nonEmpty(b.subject)) return 'Thiếu môn học.';
    if (!nonEmpty(b.question)) return 'Thiếu nội dung câu hỏi.';
    if (!nonEmpty(b.explanation)) return 'Thiếu giải thích.';
  }

  if (b.subject !== undefined && !SUBJECTS.includes(b.subject as string)) {
    return 'Môn học không hợp lệ.';
  }
  if (
    b.difficulty !== undefined &&
    b.difficulty !== null &&
    !DIFFICULTIES.includes(b.difficulty as string)
  ) {
    return 'Mức độ không hợp lệ.';
  }
  if (b.type !== undefined && b.type !== null && !TYPE_KEYS.has(b.type as string)) {
    return 'Loại câu hỏi không hợp lệ.';
  }

  return null;
}
