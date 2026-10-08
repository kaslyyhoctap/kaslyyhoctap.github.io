import QuestionForm from '@/components/admin/QuestionForm';
import { getQuestionById } from '@/lib/db/queries';

export default async function EditQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const question = await getQuestionById(id);
  if (!question) return <p>Không tìm thấy câu hỏi.</p>;
  return (
    <div className="panel">
      <h3>Sửa câu hỏi</h3>
      <QuestionForm initial={question} />
    </div>
  );
}
