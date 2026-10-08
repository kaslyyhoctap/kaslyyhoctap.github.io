/**
 * Static subject metadata ported from app.js `META` (lines 9–14).
 *
 * The DB (`getSubjects`) provides question counts and lesson numbers at runtime;
 * this file provides the human-readable display info (name, short label, unit
 * word, textbook name) and CSS helper classes that have no DB equivalent.
 */

export interface SubjectConfig {
  name: string; // e.g. "Lịch sử 12"
  short: string; // e.g. "Sử"
  units: string; // e.g. "Bài" | "Chương" | "Unit"
  book: string; // e.g. "Kết nối tri thức"
}

export const META: Record<string, SubjectConfig> = {
  history: {
    name: 'Lịch sử 12',
    short: 'Sử',
    units: 'Bài',
    book: 'Kết nối tri thức',
  },
  biology: {
    name: 'Sinh học 12',
    short: 'Sinh',
    units: 'Bài',
    book: 'Kết nối tri thức',
  },
  chemistry: {
    name: 'Hóa học 12',
    short: 'Hóa',
    units: 'Chương',
    book: 'Kết nối tri thức',
  },
  english: {
    name: 'Tiếng Anh 12',
    short: 'Anh',
    units: 'Unit',
    book: 'Global Success',
  },
};

/** Canonical subject order. */
export const SUBJECTS: string[] = ['history', 'biology', 'chemistry', 'english'];

/** Same as Object.keys(META).sort() in the old app. */
export function lessonsOf(sub: string, dbLessons: number[]): number[] {
  // Prefer DB-provided lessons; fall back to META keys.
  if (dbLessons && dbLessons.length) {
    return dbLessons.slice().sort((a, b) => a - b);
  }
  return [];
}

/** CSS badge class per subject (matches app.js `badgeCls`). */
export function badgeCls(sub: string): string {
  return sub === 'history' ? 'h' : sub === 'biology' ? 'b' : sub === 'chemistry' ? 'c' : 'e';
}

/** CSS button class per subject (matches app.js `btnCls`). */
export function btnCls(sub: string): string {
  return sub === 'history'
    ? 'btn-primary'
    : sub === 'biology'
      ? 'btn-bio'
      : sub === 'chemistry'
        ? 'btn-chem'
        : 'btn-eng';
}

/** Question type labels — Vietnamese (app.js line 15, translated). */
export const TYPES: Record<string, string> = {
  multiple_choice: 'Trắc nghiệm',
  cloze: 'Điền từ',
  word_usage_error: 'Lỗi dùng từ',
  closest_meaning: 'Từ đồng nghĩa',
  reading_comprehension: 'Đọc hiểu',
  true_false: 'Đúng/Sai',
  short_answer: 'Trả lời ngắn',
};

/**
 * Type key as a plain phrase — used to detect when a question's `topic`
 * already names its type (e.g. topic "Cloze test" ↔ type `cloze`), so the
 * chip can skip the redundant type label. Keys never change with display
 * translations; the data topics are English.
 */
const TYPE_NAMES: Record<string, string> = {
  multiple_choice: 'multiple choice',
  cloze: 'cloze test',
  word_usage_error: 'word usage error',
  closest_meaning: 'closest meaning',
  reading_comprehension: 'reading comprehension',
  true_false: 'true/false',
  short_answer: 'short answer',
};

/** True when the question's topic already names its type (app.js chipFor). */
export function topicNamesType(
  topic: string | null | undefined,
  typeKey: string,
): boolean {
  const name = TYPE_NAMES[typeKey];
  // Data topics may use either the English name ("Cloze test") or the
  // translated label ("Trả lời ngắn") — match either.
  const label = TYPES[typeKey]?.toLowerCase();
  const t = topic?.toLowerCase();
  return !!topic && (name === t || label === t);
}

/** English skill categories for the result breakdown. Keys match data topics. */
export const SKILLS: Record<string, string> = {
  Vocabulary: 'Từ vựng',
  Grammar: 'Ngữ pháp',
  'Cloze test': 'Điền từ',
  'Word usage': 'Cách dùng từ',
  'Closest meaning': 'Từ đồng nghĩa',
  Reading: 'Đọc hiểu',
};

/** Difficulty levels for the filter dropdown. */
export const LEVELS: string[] = ['all', 'Nhận biết', 'Thông hiểu', 'Vận dụng', 'Vận dụng cao'];

/** Question count options for the test config. */
export const COUNT_OPTIONS: number[] = [10, 20, 30, 40, 50, 70, 100];

/** Time limit options (minutes). */
export const TIME_OPTIONS: number[] = [10, 20, 30, 45, 60];

export function subjectName(sub: string): string {
  return META[sub]?.name ?? sub;
}

export function subjectShort(sub: string): string {
  return META[sub]?.short ?? sub;
}

export function subjectUnits(sub: string): string {
  return META[sub]?.units ?? 'Bài';
}

export function subjectBook(sub: string): string {
  return META[sub]?.book ?? '';
}
