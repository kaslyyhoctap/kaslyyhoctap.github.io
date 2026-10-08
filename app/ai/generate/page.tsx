/**
 * app/ai/generate/page.tsx — AI test generation page (Server Component wrapper).
 *
 * Fetches available subjects + lessons from the DB, then renders the
 * client-side <AiGenerateForm>. The form calls POST /api/ai/generate,
 * displays results, and on "Bắt đầu làm bài" stores the questions in
 * sessionStorage + navigates to /quiz (QuizView reads AI questions on mount).
 */
import Link from 'next/link';
import { getSubjects } from '@/lib/db/queries';
import AiGenerateForm from '@/components/ai/AiGenerateForm';
import type { SubjectMeta } from '@/lib/types';

export const metadata = {
  title: 'Tạo đề AI',
  description: 'Tạo đề kiểm tra trắc nghiệm tự động bằng AI cho lớp 12.',
};

export default async function AiGeneratePage() {
  let subjects: SubjectMeta[] = [];

  try {
    subjects = await getSubjects();
  } catch (err) {
    console.error('[AiGeneratePage] DB fetch failed:', err);
    subjects = [];
  }

  return (
    <>
      <Link href="/" className="link">
        ← Trang chủ
      </Link>

      <AiGenerateForm subjects={subjects} />
    </>
  );
}
