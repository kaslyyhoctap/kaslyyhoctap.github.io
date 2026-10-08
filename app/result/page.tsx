/**
 * app/result/page.tsx — result page.
 *
 * Reads the exam result from sessionStorage (stored by QuizView on submit),
 * then renders <ResultView>. If no result is found, redirects to home.
 *
 * Note: must be a Client Component to read sessionStorage (the plan labels
 * this a Server Component, but sessionStorage is client-only — the
 * serverless future of this is `app/result/[id]/page.tsx` which fetches from
 * the DB. For Task 3.6 (client-side port of app.js submit), client is correct.)
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ResultView, { type ResultData } from '@/components/result/ResultView';

const RESULT_KEY = 'ontap12-result';

export default function ResultPage() {
  const router = useRouter();
  const [data, setData] = useState<ResultData | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem(RESULT_KEY);
    if (!raw) {
      router.replace('/');
      return;
    }
    try {
      setData(JSON.parse(raw) as ResultData);
    } catch {
      router.replace('/');
      return;
    }
    setChecked(true);
  }, [router]);

  if (!checked || !data) {
    return (
      <div className="panel" style={{ marginTop: 16 }}>
        <p className="muted">Không có kết quả. Đang chuyển hướng…</p>
      </div>
    );
  }

  return <ResultView {...data} />;
}
