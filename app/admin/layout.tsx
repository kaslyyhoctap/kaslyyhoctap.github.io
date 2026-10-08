import { requireAdmin } from '@/lib/auth-utils';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  try {
    await requireAdmin();
  } catch {
    redirect('/');
  }
  return (
    <div>
      <h2>Admin Panel</h2>
      <nav>
        <Link href="/admin">Dashboard</Link> | <Link href="/admin/questions">Questions</Link>
      </nav>
      {children}
    </div>
  );
}
