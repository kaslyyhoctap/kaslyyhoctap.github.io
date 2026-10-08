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
        <h3>Đề đã tạo ({questions.length} câu)</h3>
        <p className="muted small">
          Môn: {subjName} · {lesson === 'all' ? 'Tổng hợp' : `${units} ${lesson}`}
          {difficulty !== 'all' ? ` · ${difficulty}` : ''}
        </p>

        <div className="rev">
          {questions.map((q, i) => (
            <div key={q.id} className="opt">
              <span className="k">{i + 1}</span>
              <span>
                <b>{q.question}</b>
                <br />
                {q.options?.map((opt, j) => (
                  <span key={j}>
                    {String.fromCharCode(65 + j)}. {opt}
                    {j === q.correctAnswer && ' ✓'}
                  </span>
                ))}
                <br />
                <span className="muted small">
                  Đáp án: {q.correctAnswer != null && q.options
                    ? String.fromCharCode(65 + q.correctAnswer)
                    : '?'}
                  {q.topic && ` · Chủ đề: ${q.topic}`}
                  {q.difficulty && ` · ${q.difficulty}`}
                </span>
              </span>
            </div>
          ))}
        </div>

        <div className="row wrap-btns">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleStartQuiz}
          >
            Bắt đầu làm bài
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
    <div className="panel">
      <h3>Tạo đề kiểm tra AI</h3>
      <p className="muted small">
        Tạo đề trắc nghiệm tự động bằng AI (Gemini 2.0 Flash). Tối đa 5 đề/ngày.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="cfg-grid">
          <label>
            Môn học
            <select
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setLesson('all');
              }}
            >
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {subjectName(s)}
                </option>
              ))}
            </select>
          </label>

          <label>
            {units}
            <select
              value={lesson}
              onChange={(e) => setLesson(e.target.value)}
              disabled={loading}
            >
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
            Số câu
            <select value={count} onChange={(e) => setCount(Number(e.target.value))} disabled={loading}>
              {COUNT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <label>
            Mức độ
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              disabled={loading}
            >
              {LEVEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="row">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Đang tạo...' : 'Tạo đề'}
          </button>
        </div>
      </form>

      {error && (
        <div className="panel" style={{ marginTop: 12 }}>
          <p className="muted">
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
