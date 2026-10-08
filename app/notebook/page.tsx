/**
 * app/notebook/page.tsx — "Sổ tay": the questions the user starred
 * (`ontap12-v1 → starred` in localStorage, written by the ☆ buttons in
 * quiz / result / bank). Reuses BankView with the star filter pinned.
 */
import Link from 'next/link';
import { getQuestions, getPassages } from '@/lib/db/queries';
import BankView from '@/components/bank/BankView';
import type { Question } from '@/lib/types';

export const metadata = {
  title: 'Sổ tay',
};

type PassageMap = Record<string, { title?: string | null; text?: string | null }>;

export default async function NotebookPage() {
  let questions: Question[] = [];
  let passages: PassageMap = {};
  let error: string | null = null;

  try {
    [questions, passages] = await Promise.all([
      getQuestions({ limit: 2000 }),
      getPassages(),
    ]);
  } catch (err) {
    console.error('[NotebookPage] DB fetch failed:', err);
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
      <BankView
        questions={questions}
        passages={passages}
        initialFilters={{ st: 'star' }}
        heading="Sổ tay"
        emptyText="Chưa có câu nào trong sổ tay. Bấm ☆ Sổ tay khi làm bài, trong ngân hàng câu hỏi hoặc ở trang kết quả để lưu câu vào đây."
      />
    </>
  );
}
