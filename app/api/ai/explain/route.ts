/**
 * POST /api/ai/explain
 *
 * Authenticated users can request an AI explanation for a single question
 * (why the correct answer is right, why theirs was wrong).
 *
 * Rate limit: 50 explanations per user per day.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import { countAiExplainRequests, logAiExplain, todayStart } from '@/lib/db/queries';
import { PROMPT_EXPLAIN, PROMPT_EXPLAIN_TF } from '@/lib/ai/prompts';
import { generateText } from '@/lib/ai/client';
import type { Statement } from '@/lib/types';

const MAX_PER_DAY = 50;

interface ExplainBody {
  question: string;
  options: string[];
  correctAnswer: number;
  userAnswer: number | number[];
  explanation?: string;
  /** True/false statements (for TF questions). */
  statements?: Statement[];
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
    const body = (await req.json()) as ExplainBody;
    const { question, options, correctAnswer, userAnswer, explanation, statements } = body;

    // ── Input validation ──────────────────────────────────────────
    if (!question || !Array.isArray(options)) {
      return NextResponse.json(
        { error: 'Thiếu câu hỏi hoặc đáp án.' },
        { status: 400 },
      );
    }

    // ── Rate limit: 50/day ────────────────────────────────────────
    const used = await countAiExplainRequests(userId, todayStart());
    if (used >= MAX_PER_DAY) {
      return NextResponse.json(
        { error: `Bạn đã dùng hết ${MAX_PER_DAY} lượt giải thích hôm nay.` },
        { status: 429 },
      );
    }

    // ── Build prompt ──────────────────────────────────────────────
    const isTF = Array.isArray(statements) && statements.length > 0;
    let prompt: string;
    if (isTF) {
      prompt = PROMPT_EXPLAIN_TF(
        question,
        statements as Statement[],
        Array.isArray(userAnswer) ? userAnswer : [],
      );
    } else {
      prompt = PROMPT_EXPLAIN(
        question,
        options,
        Number(correctAnswer),
        Array.isArray(userAnswer) ? userAnswer[0] ?? -1 : Number(userAnswer),
        explanation,
      );
    }

    // ── Call AI ────────────────────────────────────────────────────
    let text: string;
    try {
      text = await generateText(prompt);
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (/429|quota|rate.?limit/i.test(msg)) {
        return NextResponse.json(
          { error: 'AI đã hết lượt. Vui lòng thử lại sau.' },
          { status: 429 },
        );
      }
      console.error('[ai/explain] AI call failed:', err);
      return NextResponse.json(
        { error: 'AI không thể giải thích lúc này.' },
        { status: 502 },
      );
    }

    // ── Log + return ──────────────────────────────────────────────
    try {
      await logAiExplain(userId);
    } catch (err) {
      console.error('[ai/explain] log failed:', err);
    }

    return NextResponse.json({ explanation: text.trim() });
  } catch (err) {
    console.error('[ai/explain]', err);
    return NextResponse.json({ error: 'Có lỗi xảy ra.' }, { status: 500 });
  }
}
