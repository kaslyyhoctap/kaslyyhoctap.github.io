/**
 * POST /api/ai/generate
 *
 * Authenticated users can generate N multiple-choice questions for a given
 * subject / lesson / difficulty via Google Gemini (AI Studio free tier).
 *
 * Rate limit: 5 generations per user per day.
 * Cache: identical criteria within 24 h → return cached questions.
 * Failure (quota, network, bad JSON) → { error, fallback: true } so the
 * client can surface a graceful message.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import {
  countAiGenerateRequests,
  getCachedAiTest,
  saveAiTest,
  todayStart,
  type GenerateCriteria,
} from '@/lib/db/queries';
import { buildGeneratePrompt } from '@/lib/ai/prompts';
import { generateText } from '@/lib/ai/client';
import { SUBJECTS, LEVELS } from '@/lib/meta';
import type { Question } from '@/lib/types';

const MAX_PER_DAY = 5;

interface GenerateBody {
  subject: string;
  lesson: number | string;
  count: number;
  difficulty?: string;
}

/** A raw question as returned by the AI — validated before persistence. */
interface AiQuestionRaw {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty?: string;
  topic?: string;
  type?: string;
}

/**
 * Extract a JSON array from the AI response, tolerating markdown fences
 * and trailing prose.  Throws on parse failure.
 */
function extractJsonArray(text: string): unknown {
  // Strip markdown code fences.
  const cleaned = text.replace(/```\w*\n?/g, '').replace(/```/g, '').trim();
  // Locate the outermost [ … ].
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) {
    // Try whole-string parse as a last resort.
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* fall through to throw */
    }
    throw new Error('No JSON array found in AI response');
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

/** Validate one AI question — returns the normalised question or null. */
function validateQuestion(item: unknown, subject: string, lesson: number | string): Question | null {
  if (!item || typeof item !== 'object') return null;
  const r = item as Record<string, unknown>;
  const q = String(r.question ?? '').trim();
  const opts = Array.isArray(r.options) ? r.options.map(String) : null;
  const ca = Number(r.correctAnswer);

  if (!q || !opts || opts.length !== 4 || Number.isNaN(ca) || ca < 0 || ca > 3) {
    return null;
  }

  return {
    id: `ai_${crypto.randomUUID()}`,
    subject,
    lesson: lesson === 'all' ? 0 : Number(lesson),
    type: (r.type as string) ?? 'multiple_choice',
    question: q,
    options: opts,
    correctAnswer: ca,
    explanation: String(r.explanation ?? '').trim(),
    difficulty: String(r.difficulty ?? '').trim() || null,
    topic: String(r.topic ?? '').trim() || null,
    source: 'AI Generated',
    sourceType: 'ai',
  };
}

export async function POST(req: NextRequest) {
  try {
    // ── Auth ───────────────────────────────────────────────────────
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json(
        { error: 'Bạn cần đăng nhập để dùng tính năng này.' },
        { status: 401 },
      );
    }

    const userId = user.id;
    const body = (await req.json()) as GenerateBody;
    const { subject, lesson, count, difficulty } = body;

    // ── Input validation ──────────────────────────────────────────
    if (!subject || !SUBJECTS.includes(subject)) {
      return NextResponse.json({ error: 'Môn học không hợp lệ.' }, { status: 400 });
    }
    if (!count || count < 1 || count > 50) {
      return NextResponse.json({ error: 'Số câu phải từ 1–50.' }, { status: 400 });
    }
    if (difficulty && difficulty !== 'all' && !LEVELS.includes(difficulty)) {
      return NextResponse.json({ error: 'Mức độ không hợp lệ.' }, { status: 400 });
    }

    const criteria: GenerateCriteria = {
      subject,
      lesson,
      count,
      difficulty: difficulty && difficulty !== 'all' ? difficulty : null,
    };

    // ── Rate limit: 5/day ──────────────────────────────────────────
    const used = await countAiGenerateRequests(userId, todayStart());
    if (used >= MAX_PER_DAY) {
      return NextResponse.json(
        {
          error: `Bạn đã dùng hết ${MAX_PER_DAY} lượt tạo đề hôm nay. Vui lòng thử lại sau.`,
          fallback: true,
        },
        { status: 429 },
      );
    }

    // ── Cache: identical criteria within 24 h ──────────────────────
    const cached = await getCachedAiTest(userId, criteria);
    if (cached) {
      return NextResponse.json({ questions: cached, cached: true });
    }

    // ── Call AI ────────────────────────────────────────────────────
    const prompt = buildGeneratePrompt(subject, lesson, count, difficulty);
    let rawText: string;
    try {
      rawText = await generateText(prompt);
    } catch (err: any) {
      const msg = err?.message ?? '';
      // Quota / rate-limit from the provider.
      if (/429|quota|rate.?limit/i.test(msg)) {
        return NextResponse.json(
          {
            error: 'AI đã hết lượt. Vui lòng thử lại sau.',
            fallback: true,
          },
          { status: 429 },
        );
      }
      console.error('[ai/generate] AI call failed:', err);
      return NextResponse.json(
        { error: 'AI không thể tạo đề lúc này.', fallback: true },
        { status: 502 },
      );
    }

    // ── Parse + validate JSON ──────────────────────────────────────
    let parsed: unknown;
    try {
      parsed = extractJsonArray(rawText);
    } catch (err) {
      console.error('[ai/generate] JSON parse failed:', rawText?.slice(0, 200));
      return NextResponse.json(
        { error: 'AI trả về định dạng không hợp lệ.', fallback: true },
        { status: 502 },
      );
    }

    const arr = Array.isArray(parsed) ? parsed : [];
    const valid: Question[] = [];
    for (const item of arr) {
      const q = validateQuestion(item, subject, lesson);
      if (q) valid.push(q);
    }

    if (valid.length === 0) {
      return NextResponse.json(
        { error: 'Không thể tạo câu hỏi hợp lệ.', fallback: true },
        { status: 502 },
      );
    }

    // ── Persist ────────────────────────────────────────────────────
    try {
      await saveAiTest(userId, criteria, valid);
    } catch (err) {
      console.error('[ai/generate] save failed:', err);
      // Don't block: return the questions even if DB save fails.
    }

    return NextResponse.json({ questions: valid });
  } catch (err) {
    console.error('[ai/generate]', err);
    return NextResponse.json(
      { error: 'Có lỗi xảy ra.', fallback: true },
      { status: 500 },
    );
  }
}
