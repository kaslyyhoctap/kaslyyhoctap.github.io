/**
 * components/result/ResultView.tsx — full exam result summary.
 *
 * Ports app.js `submit()` result rendering (lines 259–300): rSub, rPoint,
 * rFrac, verdict, rOk/rBad/rSkip/rTime, rTopics, rTypes buttons (rDrill,
 * rRetry, rNew, rHome).
 *
 * Client component: uses `useRouter` for the retry/drill/new flow.
 *
 * The score + runtime questions + answers + config are passed as props,
 * typically deserialised from sessionStorage by the result page.
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { META, TYPES, SKILLS, subjectUnits } from '@/lib/meta';
import { buildQuizUrl } from '@/lib/quiz/urls';
import { typeOf } from '@/lib/quiz/pool';
import {
  questionStatus,
  type ExamScore,
  type RuntimeQuestion,
} from '@/lib/quiz/scoring';
import type { ExamConfig } from '@/lib/quiz/pool';
import type { PassageMap } from '@/components/quiz/QuestionCard';
import ResultReview from './ResultReview';

/** Everything the result page needs, stored in sessionStorage. */
export interface ResultData {
  score: ExamScore;
  qs: RuntimeQuestion[];
  ans: number[];
  cfg: ExamConfig;
  passages: PassageMap;
  elapsedSecs: number;
  timeout: boolean;
}

/** English type ordering / letter mapping (app.js lines 271–272). */
const EN_TYPE_ORDER = [
  'multiple_choice',
  'cloze',
  'word_usage_error',
  'closest_meaning',
  'reading_comprehension',
] as const;

const EN_TYPE_LETTERS: Record<string, string> = {
  multiple_choice: 'A',
  cloze: 'B',
  word_usage_error: 'C',
  closest_meaning: 'D',
  reading_comprehension: 'E',
};

export default function ResultView({
  score,
  qs,
  ans,
  cfg,
  passages,
  elapsedSecs,
  timeout,
}: ResultData) {
  const router = useRouter();
  // "Xem lại câu sai" toggle lives here so the button can sit in the hero
  // section while ResultReview consumes the filter below.
  const [onlyWrong, setOnlyWrong] = useState(false);
  const toggleWrong = () => {
    setOnlyWrong((v) => !v);
    document
      .getElementById('reviewList')
      ?.scrollIntoView({ behavior: 'smooth' });
  };
  const isEnglish = cfg.subject === 'english';
  const m = META[cfg.subject] || { name: cfg.subject, units: 'Bài' };
  const units = subjectUnits(cfg.subject);

  // Scope label (app.js line 260).
  const uniqueLessons = new Set(qs.map((q) => q.lesson)).size;
  const scope =
    cfg.lesson === 'all'
      ? ` · Tổng hợp ${uniqueLessons} ${units.toLowerCase()}`
      : ` · ${units} ${cfg.lesson}`;
  const rSub = `${timeout ? 'Hết giờ · ' : ''}${m.name}${scope}`;

  // Time formatting (app.js line 266).
  const elapsed = Math.min(elapsedSecs, cfg.time * 60);
  const timeStr = `${Math.floor(elapsed / 60)}:${String(
    elapsed % 60,
  ).padStart(2, '0')}`;

  // Drill: collect wrong/skip IDs (app.js line 298).
  // Uses questionStatus (more correct than the original's naive ans check for TF).
  const wrongIds = qs
    .filter((s, n) => questionStatus(s, s, ans[n]) !== 'ok')
    .map((s) => s.id);

  const handleDrill = () => {
    if (!wrongIds.length) return;
    const drillCfg = {
      subject: cfg.subject,
      lesson: 'all',
      count: wrongIds.length,
      time: Math.max(5, Math.ceil(wrongIds.length * 1.5)),
      level: 'all',
      qtype: 'all',
      practice: true,
      shQ: true,
      shA: true,
      ids: wrongIds,
    };
    router.push(buildQuizUrl(drillCfg));
  };

  const handleRetry = () => {
    router.push(buildQuizUrl({ ...cfg, quick: false }));
  };

  const handleHome = () => {
    router.push('/');
  };

  // --- English skills breakdown (app.js lines 276–279) ---
  const skillsBreakdown = Object.keys(SKILLS)
    .map((k) => {
      let ok = 0;
      let tot = 0;
      qs.forEach((s, n) => {
        if (s.topic !== k) return;
        const a = ans[n];
        tot++;
        if (a >= 0 && s.opts[a]?.ok) ok++;
      });
      if (!tot) return null;
      const pct = Math.round((ok / tot) * 100);
      const note = tot < 3 ? ' (cần ≥3 câu)' : '';
      return (
        <div key={k} className="trow">
          <span>
            {SKILLS[k]}
            {note && <span className="muted small">{note}</span>}
          </span>
          <span className="pbar">
            <i style={{ width: `${pct}%` }}></i>
          </span>
          <b>{pct}%</b>
        </div>
      );
    })
    .filter((node) => node !== null);

  return (
    <>
      <Link href="/" className="link">
        ← Trang chủ
      </Link>

      <section className="panel result-hero">
        <p className="eyebrow" id="rSub">
          {rSub}
        </p>

        <div className="r-score">
          <span id="rPoint">{score.point.toFixed(1)}</span>
          <small>/10</small>
        </div>

        <p id="rFrac" className="r-frac">
          {score.ok}/{score.total} · {score.total > 0 ? Math.round((score.ok / score.total) * 100) : 0}%
        </p>

        <p
          id="rVerdict"
          className={`r-verdict ${score.verdictClass}`}
        >
          {score.verdict}
        </p>

        {/* Stats grid (app.js lines 265–266) */}
        <div className="r-grid">
          <div className="r-box ok">
            <b id="rOk">{score.ok}</b>
            <span>Đúng</span>
          </div>
          <div className="r-box bad">
            <b id="rBad">{score.bad}</b>
            <span>Sai</span>
          </div>
          <div className="r-box skip">
            <b id="rSkip">{score.skip}</b>
            <span>Bỏ qua</span>
          </div>
          <div className="r-box time">
            <b id="rTime">{timeStr}</b>
            <span>Thời gian</span>
          </div>
        </div>

        {/* Topics breakdown — non-English only (app.js line 267).
            Small topics (<2 questions) are merged into "Chủ đề khác" so the
            list stays informative instead of a wall of 0/1 rows. */}
        {!isEnglish &&
          (() => {
            const entries = Object.entries(score.topics).filter(([t]) => t);
            const big = entries.filter(([, s]) => s.tot >= 2);
            const small = entries.filter(([, s]) => s.tot < 2);
            const smallOk = small.reduce((a, [, s]) => a + s.ok, 0);
            const smallTot = small.reduce((a, [, s]) => a + s.tot, 0);
            const rows =
              smallTot > 0
                ? [...big, ['Chủ đề khác', { ok: smallOk, tot: smallTot }] as const]
                : big;
            if (!rows.length) return null;
            return (
              <div id="rTopics">
                <h3>Kết quả theo chủ đề</h3>
                {rows.map(([topic, stat]) => {
                  const pct = stat.tot > 0 ? Math.round((stat.ok / stat.tot) * 100) : 0;
                  return (
                    <div key={topic} className="trow">
                      <span>{topic}</span>
                      <span className="pbar">
                        <i style={{ width: `${pct}%` }}></i>
                      </span>
                      <b>
                        {stat.ok}/{stat.tot}
                      </b>
                    </div>
                  );
                })}
              </div>
            );
          })()}

        {/* Types + skills breakdown — English only (app.js lines 269–279) */}
        {isEnglish && (
          <div id="rTypes">
            <h3>Kết quả theo phần</h3>
            <div className="r-grid r-parts">
              {EN_TYPE_ORDER.map((t) => {
                const s = score.types[t];
                if (!s) return null;
                const pct = s.tot > 0 ? Math.round((s.ok / s.tot) * 100) : 0;
                return (
                  <div key={t} className="r-box">
                    <b>{s.ok}/{s.tot}</b>
                    <span>
                      Phần {EN_TYPE_LETTERS[t]} · {TYPES[t]}
                    </span>
                    <span className="pbar">
                      <i style={{ width: `${pct}%` }}></i>
                    </span>
                  </div>
                );
              })}
            </div>

            {skillsBreakdown.length > 0 && (
              <>
                <h3>Kỹ năng theo chủ đề</h3>
                {skillsBreakdown}
              </>
            )}
          </div>
        )}

        {/* Action buttons (app.js lines 296–301) */}
        <div className="row wrap-btns">
          <button
            type="button"
            className="btn"
            id="rWrongTop"
            onClick={toggleWrong}
          >
            {onlyWrong ? 'Xem tất cả câu' : 'Xem lại câu sai'}
          </button>
          <button
            type="button"
            className="btn"
            id="rDrill"
            onClick={handleDrill}
            disabled={!wrongIds.length}
          >
            Luyện câu sai
          </button>
          <button type="button" className="btn" id="rRetry" onClick={handleRetry}>
            Làm lại đề
          </button>
          <button
            type="button"
            className="btn btn-primary"
            id="rHome"
            onClick={handleHome}
          >
            Về trang chủ
          </button>
        </div>
      </section>

      <ResultReview
        qs={qs}
        ans={ans}
        cfg={cfg}
        passages={passages}
        onlyWrong={onlyWrong}
        onToggleWrong={toggleWrong}
      />
    </>
  );
}
