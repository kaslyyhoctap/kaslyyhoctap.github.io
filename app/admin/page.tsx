import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth-utils';
import { getQuestions } from '@/lib/db/queries';

export default async function AdminDashboard() {
  try {
    await requireAdmin();
  } catch {
    notFound();
  }
  const questions = await getQuestions({ limit: 1 });
  // Count per subject
  const subjects = ['history', 'biology', 'chemistry', 'english'];
  const counts = await Promise.all(
    subjects.map(async (s) => {
      const qs = await getQuestions({ subject: s, limit: 10000 });
      return { subject: s, count: qs.length };
    }),
  );
  const total = counts.reduce((a, c) => a + c.count, 0);
  return (
    <div className="panel">
      <h3>Dashboard</h3>
      <p>Total questions: {total}</p>
      {counts.map((c) => (
        <div key={c.subject}>
          {c.subject}: {c.count}
        </div>
      ))}
    </div>
  );
}
