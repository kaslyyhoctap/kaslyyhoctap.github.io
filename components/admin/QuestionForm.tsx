'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
// Option lists for shadcn Select: `items` feeds SelectValue's label.
const SUBJECT_ITEMS = SUBJECTS.map((s) => ({ value: s, label: s }));
const TYPE_ITEMS = Object.entries(TYPES).map(([value, label]) => ({ value, label }));
const DIFFICULTY_ITEMS = DIFFICULTY.map((d) => ({ value: d, label: d }));
const ANSWER_ITEMS = ['A', 'B', 'C', 'D'].map((label, i) => ({ value: String(i), label }));

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
          <Select
            value={form.subject}
            onValueChange={(v) => v !== null && update('subject', v)}
            items={SUBJECT_ITEMS}
          >
            <SelectTrigger className={INPUT_CLS}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUBJECT_ITEMS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <Select
            value={form.type}
            onValueChange={(v) => v !== null && update('type', v)}
            items={TYPE_ITEMS}
          >
            <SelectTrigger className={INPUT_CLS}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_ITEMS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <Select
            value={form.difficulty}
            onValueChange={(v) => v !== null && update('difficulty', v)}
            items={DIFFICULTY_ITEMS}
          >
            <SelectTrigger className={INPUT_CLS}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIFFICULTY.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <Select
            value={String(form.correctAnswer)}
            onValueChange={(v) => v !== null && update('correctAnswer', Number(v))}
            items={ANSWER_ITEMS}
          >
            <SelectTrigger className={INPUT_CLS}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ANSWER_ITEMS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
