/**
 * lib/quiz/render.ts — text-escaping helpers ported from app.js.
 *
 * - `escapeHtml` (app.js `esc`, line 30): minimal HTML-escaping for safe
 *   text interpolation.
 * - `chemFormat` (app.js `chem`, line 33): escape + subscriptify chemistry
 *   formulas (e.g. `C2H5` → `C<sub>2</sub>H<sub>5</sub>`).
 *
 * These are pure string transforms used by the quiz question/option rendering.
 */

/** Escape `& < > " '` for safe HTML/text insertion (app.js `esc`). */
export function escapeHtml(s: unknown): string {
  return String(s).replace(/[&<>"']/g, (c) => {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[c] as string;
  });
}

/**
 * Escape + format a chemistry/math string (app.js `chem`, extended).
 * - Chemistry: letters/brackets followed by digits become subscripts
 *   (e.g. `C2H5` → `C<sub>2</sub>H<sub>5</sub>`).
 * - Math: `^x` / `**x` / `^{...}` exponents become superscripts
 *   (e.g. `2^k` → `2<sup>k</sup>`), so legacy plain-text formulas
 *   render correctly project-wide (quiz, bank, result, theory).
 */
export function chemFormat(s: unknown): string {
  const PLACEHOLDER = '\u0001';
  return (
    escapeHtml(
      String(s)
        .replace(/\bE5\b/g, `E${PLACEHOLDER}5${PLACEHOLDER}`)
        .replace(/\bB(\d+)\b/g, `B${PLACEHOLDER}$1${PLACEHOLDER}`),
    )
      .replace(/\*\*\{([^}]+)\}|\^\{([^}]+)\}/g, '<sup>$1$2</sup>')
      .replace(/(\*\*|\^)([A-Za-z0-9]+)/g, '<sup>$2</sup>')
      .replace(/([A-Za-z)\]])(\d+)/g, `$1<sub>$2</sub>`)
      .replace(/\u0001/g, '')
  );
}

/** Option / statement label letters, in display order (app.js `"abcd"[i]`). */
export const LETTERS = ['A', 'B', 'C', 'D'] as const;

/**
 * Render a reading passage with cloze blanks highlighted (app.js
 * `passageHtml`, lines 154–159). `blank` is the current question's blank
 * number (from `blankNo`); that slot gets the `.cur` highlight.
 */
export function passageHtml(
  passage: { title?: string | null; text?: string | null } | undefined,
  blank: string | null = null,
): string {
  if (!passage || !passage.text) return '';
  const txt = escapeHtml(passage.text).replace(/\((\d+)\)/g, (_m, n) => {
    return n === blank
      ? `<span class="blank cur">(${n})</span>`
      : `<span class="blank">(${n})</span>`;
  });
  return `<div class="passage"><b>${escapeHtml(passage.title || '')}</b><p>${txt}</p></div>`;
}
