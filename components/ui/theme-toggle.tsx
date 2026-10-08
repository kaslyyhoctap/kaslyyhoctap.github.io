/**
 * Theme toggle button — ports `<button id="themeBtn">` from index.html.
 *
 * Client component: reads theme from ThemeContext (provided by ThemeProvider
 * in the root layout) and persists the preference to localStorage key
 * `ontap12-v1` via the provider.
 */
'use client';

import { useTheme } from '@/lib/theme';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className="icon-btn"
      aria-label="Chuyển sáng / tối"
      title="Sáng / tối"
      onClick={toggleTheme}
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      <span id="themeLbl">{theme === 'light' ? 'Sáng' : 'Tối'}</span>
    </button>
  );
}
