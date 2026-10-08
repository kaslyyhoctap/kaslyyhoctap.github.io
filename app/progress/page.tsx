/**
 * app/progress/page.tsx — progress + analytics route (Task 3.9).
 *
 * Server Component wrapper. All progress data lives in localStorage
 * (`ontap12-v1`), so the real rendering is client-side in <ProgressView>.
 * Ports app.js `renderProgress()` (lines 454–466).
 */
import ProgressView from '@/components/progress/ProgressView';

export const metadata = {
  title: 'Tiến độ học tập',
};

export default function ProgressPage() {
  return <ProgressView />;
}
