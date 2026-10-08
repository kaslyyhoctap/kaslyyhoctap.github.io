/**
 * Test fixtures for pool() / scoring() — mimics the shapes in data/*.js
 * (MCQ with options/correctAnswer, true_false with statements, english
 * cloze/reading with passageId).
 */
import type { Question, Statement } from '@/lib/types';

/** Build a basic-choice question. */
export function mcq(
  id: string,
  subject: string,
  lesson: number,
  topic: string,
  difficulty: string,
  correct: number,
  opts: string[] = ['A', 'B', 'C', 'D'],
): Question {
  return {
    id,
    subject,
    lesson,
    type: 'multiple_choice',
    topic,
    difficulty,
    question: `Câu hỏi ${id}`,
    options: opts,
    correctAnswer: correct,
    explanation: 'Giải thích',
    passageId: null,
  };
}

function tf(
  id: string,
  subject: string,
  lesson: number,
  topic: string,
  difficulty: string,
  statements: { t: string; ok: boolean }[],
): Question {
  return {
    id,
    subject,
    lesson,
    type: 'true_false',
    topic,
    difficulty,
    question: `Đúng/Sai ${id}`,
    options: null,
    correctAnswer: null,
    explanation: 'Giải thích TF',
    statements: statements as Statement[],
  };
}

// ── Chemistry bank (Chương 1): 24 MCQ (incl. 4 hard) + 4 true/false ──
const CHEM: Question[] = [
  ...Array.from({ length: 20 }, (_, i) =>
    mcq(`chem1-mc-${i + 1}`, 'chemistry', 1, 'Lý thuyết', i < 10 ? 'Nhận biết' : 'Thông hiểu', 0),
  ),
  // Hard-tier MCQs for the 30% quota test (app.js line 130).
  mcq('chem1-mc-21', 'chemistry', 1, 'Tính toán', 'Vận dụng', 0),
  mcq('chem1-mc-22', 'chemistry', 1, 'Tính toán', 'Vận dụng', 1),
  mcq('chem1-mc-23', 'chemistry', 1, 'Tính toán', 'Vận dụng cao', 2),
  mcq('chem1-mc-24', 'chemistry', 1, 'Tính toán', 'Vận dụng cao', 3),
  mcq('chem2-mc-1', 'chemistry', 2, 'Chương 2', 'Nhận biết', 0),
  tf('chem1-tf-1', 'chemistry', 1, 'Ly thuyết', 'Thông hiểu', [
    { t: 'Ester tạo thành từ acid + alcohol', ok: true },
    { t: 'Ester tan trong nước', ok: false },
    { t: 'Ester có mùi thơm', ok: true },
    { t: 'Nhiệt độ sôi ester thấp hơn acid' , ok: false },
  ]),
  tf('chem1-tf-2', 'chemistry', 1, 'Ly thuyết', 'Thông hiểu', [
    { t: 'Triester có 3 nhóm ester', ok: true },
    { t: 'Ester không tan trong nước', ok: true },
    { t: 'Ester no có công thức CnH2nO2', ok: true },
    { t: 'Ester dễ bị thủy phân', ok: false },
  ]),
  tf('chem1-tf-3', 'chemistry', 1, 'Ứng dụng', 'Vận dụng', [
    { t: 'H2SO4 làm xúc tác este hóa', ok: true },
    { t: 'Phản ứng este hóa là thuận nghịch', ok: false },
    { t: 'Lấy ester tách khỏi dung dịch', ok: true },
    { t: 'Thêm nước làm tăng hiệu suất', ok: false },
  ]),
  tf('chem1-tf-4', 'chemistry', 1, 'Ứng dụng', 'Vận dụng', [
    { t: 'Palmitic là acid bão hòa', ok: true },
    { t: 'Oleic có 1 liên kết đôi', ok: true },
    { t: 'Linoleic có 3 liên kết đôi', ok: false },
    { t: 'Stearic là acid không no', ok: false },
  ]),
];
export const CHEM_QUESTIONS = CHEM;

// ── English bank (Unit 1) with passages ──────────────────────────
// cloze passage (6 blanks) + reading passage (2 blanks)
const EN_PASSAGE_CLOZE = 'eng-u1-cloze1';
const EN_PASSAGE_READING = 'eng-u1-reading1';

const EN: Question[] = [
  // 8 multiple_choice (Vocabulary 5, Grammar 3)
  mcq('eng1-mc-01', 'english', 1, 'Vocabulary', 'Vận dụng', 0),
  mcq('eng1-mc-02', 'english', 1, 'Vocabulary', 'Vận dụng', 1),
  mcq('eng1-mc-03', 'english', 1, 'Vocabulary', 'Thông hiểu', 2),
  mcq('eng1-mc-04', 'english', 1, 'Vocabulary', 'Vận dụng', 3),
  mcq('eng1-mc-05', 'english', 1, 'Vocabulary', 'Thông hiểu', 0),
  mcq('eng1-mc-06', 'english', 1, 'Grammar', 'Vận dụng', 1),
  mcq('eng1-mc-07', 'english', 1, 'Grammar', 'Thông hiểu', 2),
  mcq('eng1-mc-08', 'english', 1, 'Grammar', 'Vận dụng', 3),
  // 3 word_usage_error
  { ...mcq('eng1-wue-01', 'english', 1, 'Word usage', 'Vận dụng', 2), type: 'word_usage_error', wrongWord: 'about', correctWord: 'for' },
  { ...mcq('eng1-wue-02', 'english', 1, 'Word usage', 'Vận dụng', 3), type: 'word_usage_error', wrongWord: 'biology', correctWord: 'biography' },
  { ...mcq('eng1-wue-03', 'english', 1, 'Word usage', 'Vận dụng', 0), type: 'word_usage_error', wrongWord: 'for', correctWord: 'to' },
  // 2 closest_meaning
  { ...mcq('eng1-cm-01', 'english', 1, 'Closest meaning', 'Vận dụng', 3), type: 'closest_meaning' },
  { ...mcq('eng1-cm-02', 'english', 1, 'Closest meaning', 'Thông hiểu', 0), type: 'closest_meaning' },
  // 6 cloze (one full passage)
  ...Array.from({ length: 6 }, (_, i) => ({
    ...mcq(`eng1-cloze-${i + 1}`, 'english', 1, 'Cloze test', 'Vận dụng', i % 4),
    type: 'cloze' as const,
    passageId: EN_PASSAGE_CLOZE,
    question: `Chọn đáp án (đúng) cho chỗ trống (${i + 1}).`,
  })),
  // 2 reading_comprehension (one full passage)
  ...Array.from({ length: 2 }, (_, i) => ({
    ...mcq(`eng1-read-${i + 1}`, 'english', 1, 'Reading', 'Thông hiểu', i),
    type: 'reading_comprehension' as const,
    passageId: EN_PASSAGE_READING,
    question: `Câu đọc hiểu (${i + 1}).`,
  })),
];
export const EN_QUESTIONS = EN;

// A 5-question MCQ bank for scoring tests (correctAnswer = 0 for all).
export const MCQ_5: Question[] = Array.from({ length: 5 }, (_, i) =>
  mcq(`mc5-${i + 1}`, 'history', 1, 'Chính sách', 'Nhận biết', 0, [
    'Đúng',
    'Sai 1',
    'Sai 2',
    'Sai 3',
  ]),
);
