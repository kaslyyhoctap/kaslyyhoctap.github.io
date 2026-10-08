'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SUBJECTS, TYPES, LEVELS } from '@/lib/meta';
import type { Question } from '@/lib/types';
import type { FormEvent } from 'react';

export interface QuestionFormData {
  id: string;
  subject: string;
  lesson: number;
  type: string;
  topic: string;
  difficulty: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

interface QuestionFormProps {
  initial?: Partial<Question>;
  onSubmit?: (data: QuestionFormData) => Promise<void> | void;
}

const DIFFICULTY = LEVELS.filter((l) => l !== 'all');
const INPUT_CLS =
  "w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

export default function QuestionForm({ initial, onSubmit }: QuestionFormProps) {
  const router = useRouter();
  const isEdit = !!initial?.id;
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState<QuestionFormData>({
    id: initial?.id ?? '',
    subject: initial?.subject ?? 'history',
    lesson: initial?.lesson ?? 1,
    type: initial?.type ?? 'multiple_choice',
    topic: initial?.topic ?? '',
    difficulty: initial?.difficulty ?? 'Nhận biết',
    question: initial?.question ?? '',
    options:
      initial?.options && initial.options.length >= 4
        ? [
            initial.options[0] ?? '',
            initial.options[1] ?? '',
            initial.options[2] ?? '',
            initial.options[3] ?? '',
          ]
        : ['', '', '', ''],
    correctAnswer: initial?.correctAnswer ?? 0,
    explanation: initial?.explanation ?? '',
  });

  const update = (field: keyof QuestionFormData, value: string | number) =>
    setForm((p) => ({ ...p, [field]: value }));

  const updateOption = (i: number, v: string) =>
    setForm((p) => ({ ...p, options: p.options.map((o, j) => (j === i ? v : o)) }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    const data: QuestionFormData = {
      ...form,
      lesson: Number(form.lesson) || 0,
    };
    try {
      if (onSubmit) {
        await onSubmit(data);
      } else {
        const url = isEdit
          ? `/api/admin/questions/${form.id}`
          : '/api/admin/questions';
        await fetch(url, {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        router.push('/admin/questions');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="cfg">
      <div className="cfg-grid">
        <label>
          ID
          <input
            type="text"
            value={form.id}
            readOnly={isEdit}
            onChange={(e) => update('id', e.target.value)}
            className={INPUT_CLS}
          />
        </label>

        <label>
          Môn học
          <select
            value={form.subject}
            onChange={(e) => update('subject', e.target.value)}
            className={INPUT_CLS}
          >
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label>
          Bài
          <input
            type="number"
            min={1}
            value={form.lesson}
            onChange={(e) => update('lesson', Number(e.target.value))}
            className={INPUT_CLS}
          />
        </label>

        <label>
          Loại câu hỏi
          <select
            value={form.type}
            onChange={(e) => update('type', e.target.value)}
            className={INPUT_CLS}
          >
            {Object.entries(TYPES).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>

        <label>
          Chủ đề
          <input
            type="text"
            value={form.topic}
            onChange={(e) => update('topic', e.target.value)}
            className={INPUT_CLS}
          />
        </label>

        <label>
          Độ khó
          <select
            value={form.difficulty}
            onChange={(e) => update('difficulty', e.target.value)}
            className={INPUT_CLS}
          >
            {DIFFICULTY.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block mt-4">
        Câu hỏi
        <textarea
          value={form.question}
          onChange={(e) => update('question', e.target.value)}
          className={INPUT_CLS}
          rows={4}
        />
      </label>

      <fieldset className="mt-4">
        <legend className="font-semibold mb-1">Đáp án (4 phương án)</legend>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2 mt-1">
            <span className="w-6 font-medium">{String.fromCharCode(65 + i)}.</span>
            <input
              type="text"
              value={form.options[i] ?? ''}
              onChange={(e) => updateOption(i, e.target.value)}
              className={INPUT_CLS}
            />
          </div>
        ))}

        <label className="block mt-4">
          Đáp án đúng
          <select
            value={form.correctAnswer}
            onChange={(e) => update('correctAnswer', Number(e.target.value))}
            className={INPUT_CLS}
          >
            <option value={0}>A</option>
            <option value={1}>B</option>
            <option value={2}>C</option>
            <option value={3}>D</option>
          </select>
        </label>
      </fieldset>

      <label className="block mt-4">
        Giải thích
        <textarea
          value={form.explanation}
          onChange={(e) => update('explanation', e.target.value)}
          className={INPUT_CLS}
          rows={3}
        />
      </label>

      <div className="row mt-4">
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Đang lưu…' : isEdit ? 'Cập nhật' : 'Tạo mới'}
        </button>
      </div>
    </form>
  );
}
