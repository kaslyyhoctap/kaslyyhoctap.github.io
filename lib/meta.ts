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
  book: string; // e.g. "Kết nốp tri thức"
}

export const META: Record<string, SubjectConfig> = {
  history: {
    name: 'Lịch sử 12',
    short: 'Sử',
    units: 'Bài',
    book: 'Kết nốp tri thức',
  },
  biology: {
    name: 'Sinh học 12',
    short: 'Sinh',
    units: 'Bài',
    book: 'Kết nốp tri thức',
  },
  chemistry: {
    name: 'Hóa học 12',
    short: 'Hóa',
    units: 'Chương',
    book: 'Kết nốp tri thức',
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

/** Question type labels (app.js line 15). */
export const TYPES: Record<string, string> = {
  multiple_choice: 'Multiple Choice',
  cloze: 'Cloze Test',
  word_usage_error: 'Word Usage Error',
  closest_meaning: 'Closest Meaning',
  reading_comprehension: 'Reading Comprehension',
  true_false: 'True/False',
};

/** Difficulty levels for the filter dropdown. */
export const LEVELS: string[] = ['all', 'Nhận biết', 'Thông hiểu', 'Vận dụng', 'Vận dụng cao'];

/** Question count options for the test config. */
export const COUNT_OPTIONS: number[] = [10, 20, 30, 40, 50];

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
