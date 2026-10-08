/**
 * components/quiz/Timer.tsx — countdown timer.
 * Ports app.js `tick()` timer display (line 172).
 */
'use client';

interface TimerProps {
  seconds: number;
}

export default function Timer({ seconds }: TimerProps) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const low = seconds < 60;
  const label = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return (
    <span className={`timer${low ? ' low' : ''}`} aria-label="Thời gian còn lại">
      <time dateTime={`PT${seconds}S`}>{label}</time>
    </span>
  );
}
