/**
 * Minimal HTML sanitization for server-rendered theory content.
 *
 * Theory HTML is pre-seeded from trusted JSON (see scripts/seed.mts) and
 * authored with class names that the legacy stylesheet styles (`.key`,
 * `.fig`, `.fx`, etc.). This helper provides defense-in-depth by stripping
 * <script>/<style>/<iframe>/event-handlers before the HTML reaches the browser.
 *
 * It is intentionally regex-based (no extra dependency) and good enough for
 * trusted, curated content — not a general-purpose sanitizer.
 */

const SCRIPT_RE = /<\s*script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/\s*script\s*>/gi;
const STYLE_RE = /<\s*style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/\s*style\s*>/gi;
// Remove dangerous block-level/embed tags entirely (open tag).
const DANGEROUS_TAG_RE = /<\s*(?:iframe|object|embed|base|form|meta|link|basefont|frame|applet)\b[^>]*>/gi;
// Remove their closing tags.
const DANGEROUS_CLOSE_RE = /<\s*\/\s*(?:iframe|object|embed|form|frame|applet)\s*>/gi;
// Remove on* event-handler attributes.
const EVENT_HANDLER_RE = /\s+on(?:[a-z]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi;
// Neutralize javascript:/vbscript:/data: URL schemes.
const JS_PROTOCOL_RE = /\b(javascript|vbscript|data)\s*:/gi;

export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(SCRIPT_RE, '')
    .replace(STYLE_RE, '')
    .replace(DANGEROUS_TAG_RE, '')
    .replace(DANGEROUS_CLOSE_RE, '')
    .replace(EVENT_HANDLER_RE, '')
    .replace(JS_PROTOCOL_RE, '#:');
}
