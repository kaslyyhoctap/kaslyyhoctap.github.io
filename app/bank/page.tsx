/**
 * app/bank/page.tsx — question bank entry point (Task 3.7).
 *
 * Server Component: fetches the full question bank + passages from the Neon DB
 * (mirrors app.js global `Q` + `window.PASSAGES`) and hands them to the
 * client-side <BankView>, which filters / limits client-side (app.js
 * `renderBank`, lines 314–329).
 */
import Link from 'next/link';
import { getQuestions, getPassages } from '@/lib/db/queries';
import BankView from '@/components/bank/BankView';
import type { Question } from '@/lib/types';

export const metadata = {
  title: 'Ngân hàng câu hỏi',
};

type PassageMap = Record<string, { title?: string | null; text?: string | null }>;

export default async function BankPage() {
  let questions: Question[] = [];
  let passages: PassageMap = {};
  let error: string | null = null;

  try {
    [questions, passages] = await Promise.all([
      // All subjects — the bank spans history, biology, chemistry, english.
      getQuestions({ limit: 2000 }),
      getPassages(),
    ]);
  } catch (err) {
    console.error('[BankPage] DB fetch failed:', err);
    error = 'Không thể tải câu hỏi. Vui lòng thử lại sau.';
  }

  if (error) {
    return (
      <>
        <Link href="/" className="link">
          ← Trang chủ
        </Link>
        <div className="panel">
          <p className="muted">{error}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Link href="/" className="link">
        ← Trang chủ
      </Link>
      <BankView questions={questions} passages={passages} />
    </>
  );
}
