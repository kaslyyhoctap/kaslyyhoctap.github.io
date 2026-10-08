/**
 * ProgressView — port of app.js `renderProgress()` (lines 454–466).
 *
 * Client component: all progress data (prog / hist / answered / correct) lives
 * in the legacy `ontap12-v1` localStorage object, so the view reads it via
 * `useAppState`. The question bank (`data/questions.json`) is imported to derive
 * per-lesson question counts + "correct" counts the way app.js did by filtering
 * the global `Q`.
 *
 * Layout mirrors index.html's `#view-progress`: h2 → grid2#progCards →
 * panel(trendBox) → panel(weakBox) → panel(histList) → wipe button.
 */
'use client';

import Link from 'next/link';
import { useAppState, STORAGE_KEY } from '@/lib/storage';
import { META, SUBJECTS } from '@/lib/meta';
import TrendChart, { type HistEntry } from '@/components/progress/TrendChart';
import WeaknessAnalysis from '@/components/progress/WeaknessAnalysis';
import questions from '@/data/questions.json';
import type { Question } from '@/lib/types';

const Q = questions as unknown as Question[];

export default function ProgressView() {
  const state = useAppState();
  const { answered, prog, hist, correct } = state;
  const histArr = (hist ?? []) as HistEntry[];
  const tot = histArr.length;
  // app.js: best = S.hist.reduce((m,h)=>Math.max(m,h.point),0)
  const best = tot ? histArr.reduce((m, h) => Math.max(m, h.point), 0) : 0;

  // --- Per (subject, lesson) question count + "ok" count (single pass) ---
  // app.js: n = Q.filter(...).length ; good = Q.filter(...&&answered[q.id]==='ok').length
  const qCount: Record<string, Record<number, number>> = {};
  const qGood: Record<string, Record<number, number>> = {};
  for (const q of Q) {
    const c = (qCount[q.subject] ||= {});
    c[q.lesson] = (c[q.lesson] || 0) + 1;
    if (answered[q.id] === 'ok') {
      const g = (qGood[q.subject] ||= {});
      g[q.lesson] = (g[q.lesson] || 0) + 1;
    }
  }

  // Lesson numbers present in the bank per subject (app.js lessonsOf reads
  // META lessons; here derived from Q, which carries the same lesson set).
  const lessonsOf = (sub: string): number[] =>
    Array.from(new Set(Q.filter((q) => q.subject === sub).map((q) => q.lesson))).sort(
      (a, b) => a - b,
    );

  // --- progCards (app.js lines 456–461) ---
  const progCards = SUBJECTS.map((k) => {
    const m = META[k];
    if (!m) return null;
    const rows = lessonsOf(k).map((l) => {
      const p = prog[k]?.[l] ?? 0; // (S.prog[k]||{})[l]||0
      const n = qCount[k]?.[l] ?? 0;
      const good = qGood[k]?.[l] ?? 0;
      // app.js label: m.lessons[l] || (m.units+" "+l) — port META has no lessons map.
      const lbl = `${m.units} ${l}`;
      return (
        <div className="prog-row" key={`${k}-${l}`}>
          <div className="lbl">
            <span>{lbl}</span>
            <span>{`${good}/${n} đúng · ${p}%`}</span>
          </div>
          <div className="pbar">
            <i style={{ width: `${p}%` }}></i>
          </div>
        </div>
      );
    });
    return (
      <div className="panel" key={k}>
        <h3>
          {m.name} <small className="muted">· {m.book}</small>
        </h3>
        {rows}
      </div>
    );
  }).filter(Boolean);

  // --- histList (app.js lines 462–465) ---
  const histList = tot ? (
    <div>
      <div className="hist">
        {histArr.map((h, i) => {
          const d = new Date(h.when);
          const hm = META[h.sub];
          const scope =
            h.lesson === 'all'
              ? 'Tổng hợp'
              : `${hm?.units ?? 'Bài'} ${h.lesson}`;
          return (
            <div className="hist-item" key={i}>
              <span>
                <b>{h.point.toFixed(1)}/10</b> · {hm?.name ?? h.sub} {scope} ·{' '}
                {h.ok}/{h.tot}
              </span>
              <span className="muted">
                {d.toLocaleDateString('vi-VN')}{' '}
                {d.toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          );
        })}
      </div>
      <p className="muted">
        Tổng {tot} đề · điểm cao nhất {best.toFixed(1)} · {correct} câu đúng tích lũy
      </p>
    </div>
  ) : (
    <p className="muted">
      Chưa có đề nào. Hãy bắt đầu một bài kiểm tra — kết quả sẽ hiện ở đây.
    </p>
  );

  // --- wipe button (app.js line 468) ---
  const wipe = () => {
    if (confirm('Xoá toàn bộ điểm, tiến độ và lịch sử?')) {
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    }
  };

  return (
    <section className="view" id="view-progress">
      <Link href="/" className="link">
        ← Trang chủ
      </Link>

      <h2>Tiến độ học tập</h2>

      <div className="grid2" id="progCards">
        {progCards}
      </div>

      <div className="panel">
        <h3>Biểu đồ tiến bộ</h3>
        <TrendChart hist={histArr} />
      </div>

      <div className="panel">
        <h3>Phân tích điểm yếu</h3>
        <WeaknessAnalysis />
      </div>

      <div className="panel">
        <h3>Lịch sử làm bài</h3>
        <div id="histList">{histList}</div>
      </div>

      <div className="row">
        <button
          type="button"
          className="btn btn-danger"
          id="wipeBtn"
          onClick={wipe}
        >
          Xoá toàn bộ dữ liệu
        </button>
      </div>
    </section>
  );
}
