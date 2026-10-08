/**
 * lib/ai/prompts.ts — Vietnamese-teacher prompt templates for AI features.
 *
 * Both prompts are plain strings (no template literals in the AI output):
 * - PROMPT_GENERATE_TEST → expects a JSON array of question objects.
 * - PROMPT_EXPLAIN       → expects a short Vietnamese explanation string.
 */
import { META } from '@/lib/meta';
import type { Statement } from '@/lib/types';

/** Difficulty display labels (Vietnamese education framework). */
const DIFFICULTY_LABELS: Record<string, string> = {
  'all': 'mọi mức độ',
  'Nhận biết': 'Nhận biết',
  'Thông hiểu': 'Thông hiểu',
  'Vận dụng': 'Vận dụng',
  'Vận dụng cao': 'Vận dụng cao',
};

/**
 * Build the system+user prompt for generating multiple-choice questions.
 *
 * @param subject  subject key ('history' | 'biology' | 'chemistry' | 'english')
 * @param lesson   lesson/unit number (or 'all')
 * @param count    number of questions to generate
 * @param difficulty  difficulty level key (or 'all' / undefined)
 */
export function PROMPT_GENERATE_TEST(
  subject: string,
  lesson: number | string,
  count: number,
  difficulty?: string,
): string {
  const meta = META[subject] ?? { name: subject, units: 'Bài', book: '' };
  const diffLabel = !difficulty || difficulty === 'all'
    ? 'mọi mức độ'
    : (DIFFICULTY_LABELS[difficulty] ?? difficulty);

  const lessonStr = lesson === 'all' ? `toàn bộ các ${meta.units.toLowerCase()}` : `${meta.units} ${lesson}`;

  return `Bạn là một giáo viên dạy kỳ thi trắc nghiệm quốc gia lớp 12, giỏi môn ${meta.name} (${meta.book}).

Hãy tạo ${count} câu hỏi trắc nghiệm (chính xác 4 phương án A, B, C, D; đúng đúng một phương án) cho môn ${meta.name}, ${lessonStr}.

Tên miền kiến thức: ${meta.name}. Mỗi câu hỏi phù hợp với học sinh lớp 12 và phản ánh đúng nội dung lý thuyết của sách giáo khoa.`;
}

/**
 * Build the JSON schema instructions appended to the generate-test prompt.
 * This tells the model the exact output format.
 */
export function PROMPT_GENERATE_JSON_SCHEMA(): string {
  return `

TRỌNG TÂM: Chỉ trả về một JSON array hợp lệ, không kèm markdown, không kèm giải thích ngoài JSON.

Mỗi phần tử của mảng phải có đúng các trường sau:
- "question": string — nội dung câu hỏi
- "options": string[] — mảng đúng 4 phương án
- "correctAnswer": number (0-3) — chỉ số đáp án đúng trong options
- "explanation": string — giải thích ngắn gọn tại sao đáp án đúng
- "topic": string — tên chủ đề kiến thức
- "difficulty": string — một trong: Nhận biết, Thông hiểu, Vận dụng, Vận dụng cao
- "type": "multiple_choice" (luôn cố định)`;
}

/**
 * Full generate prompt — system instruction + JSON schema requirements.
 */
export function buildGeneratePrompt(
  subject: string,
  lesson: number | string,
  count: number,
  difficulty?: string,
): string {
  return PROMPT_GENERATE_TEST(subject, lesson, count, difficulty) + PROMPT_GENERATE_JSON_SCHEMA();
}

/**
 * Build the prompt for explaining a single question.
 *
 * @param question   the question text
 * @param options    the answer options (or TF statement texts)
 * @param correct    the index of the correct answer
 * @param userAnswer the user's answer (index for MCQ, or array of 0/1 for TF)
 * @param explanation  optional pre-existing explanation to enrich
 */
export function PROMPT_EXPLAIN(
  question: string,
  options: string[],
  correct: number,
  userAnswer: number | number[],
  explanation?: string,
): string {
  const correctText = options[correct] ?? '';

  let userText: string;
  if (Array.isArray(userAnswer)) {
    // True/false: describe each statement selection.
    userText = userAnswer
      .map((v, i) => (v >= 0 ? (v === 1 ? `Đúng` : `Sai`) : 'Bỏ qua'))
      .join(', ');
  } else {
    userText = userAnswer >= 0 ? (options[userAnswer] ?? '') : 'chưa trả lời';
  }

  const optsStr = options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join('\n');

  const extra = explanation
    ? `\n\nGiải thích gốc (tham khảo thêm): ${explanation}`
    : '';

  return `Bạn là giáo viên dạy trắc nghiệm lớp 12. Hãy giải thích ngắn gọn bằng tiếng Việt (khoảng 2-3 câu) tại sao đáp án đúng và tại sao lựa chọn của học sinh chưa đúng.

Câu hỏi: ${question}
Các phương án:
${optsStr}
Đáp án đúng: ${correctText} (phương án ${String.fromCharCode(65 + correct)})
Học sinh đã chọn: ${userText}
${extra}
Hãy giải thích rõ ràng, dễ hiểu, giúp học sinh nắm bắt kiến thức.`;
}

/**
 * Build a prompt explaining a true/false question with per-statement answers.
 *
 * @param question   the question text
 * @param statements the 4 TF statements with correctness flags
 * @param userTf     the user's per-statement answers (-1=skip, 0=false, 1=true)
 */
export function PROMPT_EXPLAIN_TF(
  question: string,
  statements: Statement[],
  userTf: number[],
): string {
  const stmtsStr = statements
    .map((s, i) => `${i + 1}. ${s.t} (đúng: ${s.ok ? 'Đúng' : 'Sai'})`)
    .join('\n');
  const userStr = userTf
    .map((v) => (v >= 0 ? (v === 1 ? 'Đúng' : 'Sai') : 'Bỏ qua'))
    .join(', ');

  return `Bạn là giáo viên dạy trắc nghiệm lớp 12. Hãy giải thích ngắn gọn bằng tiếng Việt (2-3 câu) tại sao từng kết quả Đúng/Sai là đúng.

Câu hỏi: ${question}
Các nhận đề:
${stmtsStr}
Học sinh chọn: ${userStr}
Giải thích rõ ràng, dễ hiểu.`;
}
