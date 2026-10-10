/**
 * app/notebook/page.tsx — "Sổ tay" merged into the question bank.
 *
 * The notebook was BankView with the star filter pinned (`st:'star'`); it now
 * redirects to `/bank?st=star`, so one page owns the bank UI and the old URL
 * keeps working (bookmarks + the header nav link land on the same view).
 */
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Sổ tay',
};

export default async function NotebookPage() {
  redirect('/bank?st=star');
}
