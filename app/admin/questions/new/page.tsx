import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth-utils';
import QuestionForm from '@/components/admin/QuestionForm';

export default async function NewQuestionPage() {
  try {
    await requireAdmin();
  } catch {
    notFound();
  }
  return (
    <div className="panel">
      <h3>Thêm câu hỏi mới</h3>
      <QuestionForm />
    </div>
  );
}
