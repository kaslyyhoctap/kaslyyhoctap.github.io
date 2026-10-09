import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth-utils';
import { getQuestions } from '@/lib/db/queries';

export default async function AdminQuestions() {
  try {
    await requireAdmin();
  } catch {
    notFound();
  }
  const qs = await getQuestions({ limit: 50 });
  return (
    <div className="panel">
      <h3>Questions ({qs.length})</h3>
      <Link href="/admin/questions/new" className="btn btn-primary btn-sm">
        + New
      </Link>
      <div style={{ overflowX: 'auto' }}>
      <table>
        <tbody>
          {qs.map((q) => (
            <tr key={q.id}>
              <td>{q.id}</td>
              <td>{q.subject}</td>
              <td>{q.question?.slice(0, 60)}</td>
              <td>
                <Link href={`/admin/questions/${q.id}/edit`}>Edit</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
