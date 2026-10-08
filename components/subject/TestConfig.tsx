/**
 * Test configuration form — ports the `cfg` panel from index.html lines 91–107
 * and `collectCfg()` from app.js line 106.
 *
 * Client component: manages form field state. The exam-start action is a
 * TODO (Task 4+ — quiz view not yet built); form state is collected and logged.
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TYPES, subjectUnits, COUNT_OPTIONS, TIME_OPTIONS, LEVELS } from '@/lib/meta';
import { buildQuizUrl } from '@/lib/quiz/urls';

interface TestConfigProps {
  subject: string;
  lessons: number[];
}

const LEVEL_OPTIONS: { value: string; label: string }[] = LEVELS.map((v) => ({
  value: v,
  label: v === 'all' ? 'Mọi mức độ' : v,
}));

export default function TestConfig({ subject, lessons }: TestConfigProps) {
  const units = subjectUnits(subject);
  const isEnglish = subject === 'english';
  const router = useRouter();

  const [count, setCount] = useState(20);
  const [time, setTime] = useState(20);
  const [lesson, setLesson] = useState('all');
  const [level, setLevel] = useState('all');
  const [type, setType] = useState('all');
  const [shuffleQ, setShuffleQ] = useState(true);
  const [shuffleA, setShuffleA] = useState(true);

  // Ports collectCfg() — builds the exam config object (app.js line 106).
  const buildConfig = (practice: boolean) => ({
    subject,
    lesson: lesson === 'all' ? 'all' : Number(lesson),
    count,
    time,
    level,
    qtype: isEnglish ? type : 'all',
    shQ: shuffleQ,
    shA: shuffleA,
    practice,
  });

  const onStart = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(buildQuizUrl({ ...buildConfig(false), quick: false }));
  };

  const onPractice = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(buildQuizUrl({ ...buildConfig(true), quick: false }));
  };

  return (
    <div className="cfg panel">
      <h3>Tạo đề kiểm tra</h3>
      <form onSubmit={onStart}>
        <div className="cfg-grid">
          <label>
            Số câu
            <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {COUNT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <label>
            Thời gian (phút)
            <select value={time} onChange={(e) => setTime(Number(e.target.value))}>
              {TIME_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <label>
            Bài
            <select value={lesson} onChange={(e) => setLesson(e.target.value)}>
              <option value="all">
                Tổng hợp {lessons.length} {units.toLowerCase()}
              </option>
              {lessons.map((l) => (
                <option key={l} value={l}>
                  {units} {l}
                </option>
              ))}
            </select>
          </label>

          <label>
            Mức độ
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              {LEVEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          {/* Only shown for English (app.js line 96: cfgTypeWrap display toggle) */}
          {isEnglish && (
            <label>
              Dạng bài (Tiếng Anh)
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="all">Tất cả dạng</option>
                {Object.entries(TYPES).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="chk">
            <input
              type="checkbox"
              checked={shuffleQ}
              onChange={(e) => setShuffleQ(e.target.checked)}
            />
            Trộn câu hỏi
          </label>
          <label className="chk">
            <input
              type="checkbox"
              checked={shuffleA}
              onChange={(e) => setShuffleA(e.target.checked)}
            />
            Trộn đáp án
          </label>
        </div>

        <div className="row">
          <button type="submit" className="btn btn-primary">
            Bắt đầu làm bài
          </button>
          <button type="button" className="btn btn-ghost" onClick={onPractice}>
            Luyện tập (xem đáp án ngay)
          </button>
        </div>
      </form>
    </div>
  );
}
