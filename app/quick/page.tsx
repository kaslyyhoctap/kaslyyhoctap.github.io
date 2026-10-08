/**
 * app/quick/page.tsx — server-side "Kiểm tra nhanh" entry point.
 *
 * Picks a random subject server-side and redirects to the regular quiz page
 * with the legacy quick config (lesson=all, 10 câu / 10 phút, quick=true).
 * Fixes the 404 on header "Kiểm tra nhanh" links (`/quick`).
 */
import { redirect } from 'next/navigation';
import { SUBJECTS } from '@/lib/meta';
import { buildQuizUrl } from '@/lib/quiz/urls';

export const metadata = {
  title: 'Kiểm tra nhanh',
};

export default async function QuickPage() {
  const subject = SUBJECTS[Math.floor(Math.random() * SUBJECTS.length)];
  redirect(
    buildQuizUrl({
      subject,
      lesson: 'all',
      count: 10,
      time: 10,
      level: 'all',
      qtype: 'all',
      practice: false,
      shQ: true,
      shA: true,
      quick: true,
    }),
  );
}
