/**
 * Hero section — ports `renderHome()` hero logic (app.js lines 77–80).
 *
 * Client component: reads best-score / exams-done / per-lesson progress from
 * the `ontap12-v1` localStorage object. Receives totalQuestions + enriched
 * subject data from the server (DB counts).
 */
'use client';

import Link from 'next/link';
import { useAppState, subjProg, unitPrefix } from '@/lib/storage';
import { SUBJECTS, META, btnCls } from '@/lib/meta';

export interface HeroSubject {
  subject: string;
  name: string;
  short: string;
  units: string;
  lessons: number[];
}

export default function Hero({
  totalQuestions,
  subjects,
}: {
  totalQuestions: number;
  subjects: HeroSubject[];
}) {
  const state = useAppState();
  const tot = state.exams;
  const best = tot > 0 ? state.best.toFixed(2) : '–';

  // Hero bars: one progress <i> per lesson across all subjects.
  const bars = subjects.flatMap((s) => {
    const cfg = META[s.subject];
    if (!cfg) return [];
    return s.lessons.map((l) => {
      const p = s.subject in state.prog ? state.prog[s.subject]?.[l] ?? 0 : 0;
      const label = `${cfg.short} ${unitPrefix(cfg.units)}${l}`;
      return (
        <div className="hbar" key={`${s.subject}-${l}`}>
          <span>{label}</span>
          <i>
            <em style={{ width: `${p}%` }}></em>
          </i>
          <span>{p}%</span>
        </div>
      );
    });
  });

  return (
    <section className="view">
      <div className="hero">
        <div className="hero-txt">
          <p className="eyebrow">Lớp 12 · Kết nốp tri thức + Global Success</p>
          <h1>ÔN TẬP LỚP 12</h1>
          <p className="hero-sub">Ôn đúng trọng tâm – Luyện đúng dạng – Kiểm tra hiệu quả</p>

          <div className="hero-cta">
            {SUBJECTS.map((sub) => (
              <Link key={sub} href={`/${sub}`} className={`btn ${btnCls(sub)}`}>
                Học {META[sub]?.name ?? sub}
              </Link>
            ))}
          </div>

          <div className="hero-stats">
            <div>
              <b>{totalQuestions}</b>
              <span>câu hỏi</span>
            </div>
            <div>
              <b>{tot}</b>
              <span>đề đã làm</span>
            </div>
            <div>
              <b>{best}</b>
              <span>điểm cao nhất</span>
            </div>
          </div>
        </div>

        <div className="hero-card" aria-hidden="true">
          <div className="hero-score">
            <span>{best}</span>
            <small>điểm cao nhất của bạn</small>
          </div>
          <div className="hero-bars">{bars}</div>
        </div>
      </div>
    </section>
  );
}
