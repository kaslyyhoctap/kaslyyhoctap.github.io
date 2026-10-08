/**
 * Test configuration form — ports the `cfg` panel from index.html lines 91–106
 * and `collectCfg()` from app.js line 108 (checkbox era: chọn nhiều Bài +
 * nhiều dạng bài, counts per type, disabled when a type has 0 questions).
 *
 * Client component: checkbox-grid state for lessons + types, then builds the
 * quiz URL via `buildQuizUrl` (arrays serialize comma-joined).
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TYPES, subjectUnits, COUNT_OPTIONS, TIME_OPTIONS, LEVELS } from '@/lib/meta';
import { buildQuizUrl } from '@/lib/quiz/urls';
import { toast } from '@/components/ui/toast';

interface TestConfigProps {
  subject: string;
  lessons: number[];
  /** Question count per type for this subject (drives disabled + labels). */
  typeCounts: Record<string, number>;
}

const LEVEL_OPTIONS: { value: string; label: string }[] = LEVELS.map((v) => ({
  value: v,
  label: v === 'all' ? 'Mọi mức độ' : v,
}));

// ponytail: short_answer có trong bank nhưng UI nhập đáp án trong đề chưa
// port — tạm khóa checkbox này; mở khi có ô nhập (app.js renderSA/#saIn).
const LOCKED_TYPES = new Set(['short_answer']);

export default function TestConfig({ subject, lessons, typeCounts }: TestConfigProps) {
  const units = subjectUnits(subject);
  const router = useRouter();

  const [count, setCount] = useState(20);
  const [time, setTime] = useState(20);
  const [level, setLevel] = useState('all');
  const [shuffleQ, setShuffleQ] = useState(true);
  const [shuffleA, setShuffleA] = useState(true);

  // Checkbox state — every lesson + every selectable type starts checked.
  const lessonKeys = lessons.map(String);
  const typeEntries = Object.keys(TYPES).map((t) => ({
    key: t,
    count: typeCounts[t] ?? 0,
    locked: LOCKED_TYPES.has(t),
  }));
  const selectableTypes = typeEntries.filter((t) => t.count > 0 && !t.locked);

  const [lessonChecks, setLessonChecks] = useState<Record<string, boolean>>(
    Object.fromEntries(lessonKeys.map((l) => [l, true])),
  );
  const [typeChecks, setTypeChecks] = useState<Record<string, boolean>>(
    Object.fromEntries(typeEntries.map((t) => [t.key, t.count > 0 && !t.locked])),
  );

  const allLessonsChecked = lessonKeys.every((l) => lessonChecks[l]);
  const allTypesChecked = selectableTypes.every((t) => typeChecks[t.key]);

  const toggleAllLessons = (on: boolean) =>
    setLessonChecks(Object.fromEntries(lessonKeys.map((l) => [l, on])));
  const toggleAllTypes = (on: boolean) =>
    setTypeChecks((prev) => ({
      ...Object.fromEntries(Object.keys(prev).map((k) => [k, on])),
    }));

  const countItems = COUNT_OPTIONS.map((n) => ({ value: String(n), label: String(n) }));
  const timeItems = TIME_OPTIONS.map((n) => ({ value: String(n), label: String(n) }));

  // Ports collectCfg() (app.js line 108): validation toasts + 'all' vs array.
  const start = (practice: boolean) => {
    const checkedLessons = lessonKeys.filter((l) => lessonChecks[l]);
    if (!checkedLessons.length) {
      toast.add({ title: 'Hãy chọn ít nhất 1 bài', type: 'warning' });
      return;
    }
    const checkedTypes = selectableTypes.filter((t) => typeChecks[t.key]).map((t) => t.key);
    if (!checkedTypes.length) {
      toast.add({ title: 'Hãy chọn ít nhất 1 dạng bài', type: 'warning' });
      return;
    }
    router.push(
      buildQuizUrl({
        subject,
        lesson: allLessonsChecked ? 'all' : checkedLessons,
        count,
        time,
        level,
        qtype: allTypesChecked ? 'all' : checkedTypes,
        shQ: shuffleQ,
        shA: shuffleA,
        practice,
        quick: false,
      }),
    );
  };

  const onStart = (e: React.FormEvent) => {
    e.preventDefault();
    start(false);
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

          {/* Bài (chọn nhiều) — index.html line 96 */}
          <div className="cfg-group">
            <span className="cfg-t">Bài (chọn nhiều)</span>
            <div className="chk-grid">
              <label className="chk">
                <input
                  type="checkbox"
                  checked={allLessonsChecked}
                  onChange={(e) => toggleAllLessons(e.target.checked)}
                />{' '}
                Tất cả
              </label>
              {lessonKeys.map((l) => (
                <label key={l} className="chk">
                  <input
                    type="checkbox"
                    checked={!!lessonChecks[l]}
                    onChange={(e) =>
                      setLessonChecks((prev) => ({ ...prev, [l]: e.target.checked }))
                    }
                  />{' '}
                  {units} {l}
                </label>
              ))}
            </div>
          </div>

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

          {/* Dạng bài (chọn nhiều) — index.html line 98, counts per type */}
          <div className="cfg-group">
            <span className="cfg-t">Dạng bài (chọn nhiều)</span>
            <div className="chk-grid">
              <label className="chk">
                <input
                  type="checkbox"
                  checked={allTypesChecked}
                  onChange={(e) => toggleAllTypes(e.target.checked)}
                />{' '}
                Tất cả
              </label>
              {typeEntries.map((t) => (
                <label
                  key={t.key}
                  className={`chk${t.count === 0 || t.locked ? ' dis' : ''}`}
                  title={t.locked ? 'Sắp có — ô nhập đáp án đang được port' : undefined}
                >
                  <input
                    type="checkbox"
                    checked={!!typeChecks[t.key]}
                    disabled={t.count === 0 || t.locked}
                    onChange={(e) =>
                      setTypeChecks((prev) => ({ ...prev, [t.key]: e.target.checked }))
                    }
                  />{' '}
                  {TYPES[t.key]} ({t.count})
                </label>
              ))}
            </div>
          </div>

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
          <button type="button" className="btn btn-ghost" onClick={() => start(true)}>
            Luyện tập (xem đáp án ngay)
          </button>
        </div>
      </form>
    </div>
  );
}
