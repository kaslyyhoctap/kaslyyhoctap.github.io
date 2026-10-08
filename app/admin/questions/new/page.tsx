'use client';

import { useRouter } from 'next/navigation';
import QuestionForm, { type QuestionFormData } from '@/components/admin/QuestionForm';

export default function NewQuestionPage() {
  const router = useRouter();

  const handleSubmit = async (data: QuestionFormData) => {
    await fetch('/api/admin/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    router.push('/admin/questions');
  };

  return (
    <div className="panel">
      <h3>Thêm câu hỏi mới</h3>
      <QuestionForm onSubmit={handleSubmit} />
    </div>
  );
}
