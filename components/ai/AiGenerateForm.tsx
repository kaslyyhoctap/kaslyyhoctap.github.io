/**
 * components/ai/AiGenerateForm.tsx — form for generating AI-powered tests.
 *
 * Client component: manages form state, calls POST /api/ai/generate, shows
 * the generated questions, and offers a "Bắt đầu làm bài" (start quiz) button
 * that stores the questions in sessionStorage and navigates to /quiz.
 *
 * The quiz page's QuizView checks sessionStorage for `ontap12-ai-quiz` and
 * uses those questions instead of the DB bank.
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SUBJECTS, COUNT_OPTIONS, LEVELS, META, subjectName, subjectUnits } from '@/lib/meta';
import { buildQuizUrl } from '@/lib/quiz/urls';
import type { SubjectMeta, Question } from '@/lib/types';

interface AiGenerateFormProps {
  subjects: SubjectMeta[];
}

const LEVEL_OPTIONS: { value: string; label: string }[] = LEVELS.map((v) => ({
  value: v,
  label: v === 'all' ? 'Mọi mức độ' : v,
}));

export default function AiGenerateForm({ subjects }: AiGenerateFormProps) {
  const router = useRouter();

  // ── Form state ────────────────────────────────────────────────
  const [subject, setSubject] = useState(SUBJECTS[0] ?? 'history');
  const [lesson, setLesson] = useState('all');
  const [count, setCount] = useState(15);
  const [difficulty, setDifficulty] = useState('all');

  // ── Result state ──────────────────────────────────────────────
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);

  const lessons = subjects.find((s) => s.subject === subject)?.lessons ?? [];
  const units = subjectUnits(subject);
  const subjName = subjectName(subject);

  // Option lists for shadcn Select: `items` feeds SelectValue's label.
  const subjectItems = SUBJECTS.map((s) => ({ value: s, label: subjectName(s) }));
  const lessonItems = [
    { value: 'all', label: `Tổng hợp ${lessons.length} ${units.toLowerCase()}` },
    ...lessons.map((l) => ({ value: String(l), label: `${units} ${l}` })),
  ];
  const countItems = COUNT_OPTIONS.map((n) => ({ value: String(n), label: String(n) }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setQuestions(null);
    setIsFallback(false);

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          lesson: lesson === 'all' ? 'all' : Number(lesson),
          count,
          difficulty: difficulty === 'all' ? undefined : difficulty,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Có lỗi xảy ra.');
        setIsFallback(!!data.fallback);
        return;
      }

      setQuestions(data.questions);
    } catch (err) {
      setError('Không thể kết nối tới máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartQuiz = () => {
    if (!questions || !questions.length) return;

    const lessonNum = lesson === 'all' ? 'all' : Number(lesson);
    const cfg = {
      subject,
      lesson: lessonNum,
      count: questions.length,
      time: 20,
      level: difficulty === 'all' ? 'all' : difficulty,
      qtype: 'all',
      practice: false,
      shQ: true,
      shA: true,
      quick: false,
    };

    // Stash AI questions so QuizView picks them up on mount.
    sessionStorage.setItem(
      'ontap12-ai-quiz',
      JSON.stringify({ questions, cfg }),
    );

    router.push(buildQuizUrl({ ...cfg, quick: false }));
  };

  // ── Result view (generated questions) ─────────────────────────
  if (questions && questions.length > 0) {
    return (
      <div className="panel">
        <p className="eyebrow">Đề AI đã tạo</p>
        <h3>
          {questions.length} câu · {subjName}
        </h3>
        <p className="muted small">
          {lesson === 'all' ? 'Tổng hợp' : `${units} ${lesson}`}
          {difficulty !== 'all' ? ` · ${difficulty}` : ''}
        </p>

        <div>
          {questions.map((q, i) => {
            const letter =
              q.correctAnswer != null && q.options
                ? String.fromCharCode(65 + q.correctAnswer)
                : '?';
            return (
              <article key={q.id} className="panel ai-card">
                <div className="rev-head">
                  <span className="badge">Câu {i + 1}</span>
                  {q.difficulty && (
                    <span className="badge">{q.difficulty}</span>
                  )}
                  {q.topic && <span className="badge">{q.topic}</span>}
                  <span className="tag ok">Đáp án {letter}</span>
                </div>
                <p>
                  <b>{q.question}</b>
                </p>
                {q.options && (
                  <ol className="ai-opts">
                    {q.options.map((opt, j) => (
                      <li
                        key={j}
                        className={j === q.correctAnswer ? 'hit' : ''}
                      >
                        {String.fromCharCode(65 + j)}. {opt}
                      </li>
                    ))}
                  </ol>
                )}
                {q.statements && (
                  <ol className="ai-opts">
                    {q.statements.map((st, j) => (
                      <li key={j}>{st.t}</li>
                    ))}
                  </ol>
                )}
              </article>
            );
          })}
        </div>

        <div className="ai-cta">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleStartQuiz}
          >
            Bắt đầu làm bài ({questions.length} câu)
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setQuestions(null)}
          >
            Tạo đề khác
          </button>
        </div>
      </div>
    );
  }

  // ── Form view ─────────────────────────────────────────────────
  return (
    <div className="panel cfg">
      <p className="eyebrow">Tạo đề bằng AI</p>
      <h3>Tạo đề kiểm tra AI</h3>
      <p className="muted small">
        Tạo đề trắc nghiệm tự động bằng AI (Gemini 2.0 Flash). Tối đa 5 đề/ngày.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="cfg-grid">
          <label>
            Môn học
            <Select
              value={subject}
              onValueChange={(v) => {
                if (v === null) return;
                setSubject(v);
                setLesson('all');
              }}
              items={subjectItems}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {subjectItems.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label>
            {units}
            <Select
              value={lesson}
              onValueChange={(v) => v !== null && setLesson(v)}
              items={lessonItems}
              disabled={loading}
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
            Số câu
            <Select
              value={String(count)}
              onValueChange={(v) => v !== null && setCount(Number(v))}
              items={countItems}
              disabled={loading}
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
            Mức độ
            <Select
              value={difficulty}
              onValueChange={(v) => v !== null && setDifficulty(v)}
              items={LEVEL_OPTIONS}
              disabled={loading}
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
        </div>

        <div className="row">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? (
              <>
                <span className="spin" aria-hidden="true" /> Đang tạo đề…
              </>
            ) : (
              'Tạo đề'
            )}
          </button>
        </div>
      </form>

      {loading && (
        <p role="status" className="muted small" style={{ marginTop: 12 }}>
          AI đang soạn câu hỏi, vui lòng đợi trong giây lát…
        </p>
      )}

      {error && (
        <div className="panel ai-err" role="alert" style={{ marginTop: 12 }}>
          <p>
            {error}
            {isFallback && ' Hãy thử lại hoặc chọn môn học khác.'}
          </p>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setError(null);
              setIsFallback(false);
            }}
          >
            Đóng
          </button>
        </div>
      )}
    </div>
  );
}
