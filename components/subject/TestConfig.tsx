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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const router = useRouter();

  const [count, setCount] = useState(20);
  const [time, setTime] = useState(20);
  const [lesson, setLesson] = useState('all');
  const [level, setLevel] = useState('all');
  const [type, setType] = useState('all');
  const [shuffleQ, setShuffleQ] = useState(true);
  const [shuffleA, setShuffleA] = useState(true);

  // Option lists for shadcn Select: `items` feeds SelectValue's label.
  const countItems = COUNT_OPTIONS.map((n) => ({ value: String(n), label: String(n) }));
  const timeItems = TIME_OPTIONS.map((n) => ({ value: String(n), label: String(n) }));
  const lessonItems = [
    { value: 'all', label: `Tổng hợp ${lessons.length} ${units.toLowerCase()}` },
    ...lessons.map((l) => ({ value: String(l), label: `${units} ${l}` })),
  ];
  const typeItems = [
    { value: 'all', label: 'Tất cả dạng' },
    ...Object.entries(TYPES).map(([value, label]) => ({ value, label })),
  ];

  // Ports collectCfg() — builds the exam config object (app.js line 106).
  // qtype applies to every subject that has typed questions (english 5 types,
  // chemistry true_false); subjects with MCQ only ignore it in pool().
  const buildConfig = (practice: boolean) => ({
    subject,
    lesson: lesson === 'all' ? 'all' : Number(lesson),
    count,
    time,
    level,
    qtype: type,
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
            <Select
              value={String(count)}
              onValueChange={(v) => v !== null && setCount(Number(v))}
              items={countItems}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {countItems.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label>
            Thời gian (phút)
            <Select
              value={String(time)}
              onValueChange={(v) => v !== null && setTime(Number(v))}
              items={timeItems}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeItems.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label>
            Bài
            <Select
              value={lesson}
              onValueChange={(v) => v !== null && setLesson(v)}
              items={lessonItems}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {lessonItems.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label>
            Mức độ
            <Select
              value={level}
              onValueChange={(v) => v !== null && setLevel(v)}
              items={LEVEL_OPTIONS}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEVEL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          {/* Question type filter — every subject (english has 5 types,
              chemistry has true_false; MCQ-only subjects show just that) */}
          <label>
            Dạng bài
            <Select
              value={type}
              onValueChange={(v) => v !== null && setType(v)}
              items={typeItems}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeItems.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

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
