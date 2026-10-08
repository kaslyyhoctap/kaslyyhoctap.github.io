/**
 * tests/e2e/responsive.spec.ts — responsive audit 320–1920px.
 *
 * For every route × width, asserts no UNINTENDED horizontal overflow.
 * Primary check is per-element (works despite `body{overflow-x:clip}`):
 * any element whose layout rect sticks out of the viewport is a real bug.
 *
 * Intentional exceptions (allowed to stick out / scroll internally):
 * - `.theory` subtree (long tables scroll inside, min-width:520px by design)
 * - admin table scroll wrapper + shadcn table container (overflow-x:auto)
 * - `.nav` mobile drawer + `.scrim` (off-canvas by design)
 * - `.skip` link (parked at left:-999px until focused)
 * - select popovers / dialogs (floating portals)
 * - any element inside an ancestor with computed overflow-x auto/scroll
 */
import { test, expect, type Page } from '@playwright/test';

const WIDTHS = [320, 360, 375, 390, 412, 768, 820, 1024, 1280, 1366, 1440, 1536, 1920];

const ROUTES = [
  '/',
  '/history',
  '/biology',
  '/chemistry',
  '/english',
  '/history/theory/1',
  '/quiz?subject=history&lesson=all&count=10&time=10',
  '/bank',
  '/vocab',
  '/progress',
  '/ai/generate',
];

interface Overflow {
  tag: string;
  cls: string;
  left: number;
  right: number;
}

async function overflows(page: Page): Promise<Overflow[]> {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const out: Overflow[] = [];
    const skipSel =
      '.theory, .nav, .scrim, .skip, [role="dialog"], [data-radix-popper], [data-slot="select-content"]';
    document.querySelectorAll('body *').forEach((el) => {
      const h = el as HTMLElement;
      if (h.closest(skipSel)) return;
      // Inside an intentional horizontal scroller → allowed.
      let p: HTMLElement | null = h.parentElement;
      for (let d = 0; d < 4 && p; d++, p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === 'auto' || ox === 'scroll') return;
      }
      const r = h.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      if (r.right > vw + 1 || r.left < -1) {
        out.push({
          tag: h.tagName.toLowerCase(),
          cls: (h.className?.toString?.() || '').slice(0, 80),
          left: Math.round(r.left),
          right: Math.round(r.right),
        });
      }
    });
    return out.slice(0, 20);
  });
}

for (const route of ROUTES) {
  test(`no overflow: ${route}`, async ({ page }) => {
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto(route, { waitUntil: 'networkidle' });
      // Let client hydration (quiz boot, vocab, theme) settle.
      await page.waitForTimeout(600);
      const bad = await overflows(page);
      expect(bad, `${route} @ ${w}px`).toEqual([]);
    }
  });
}

test('result renders empty + redirects home', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/result', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  // Empty sessionStorage → redirect to / (client replace).
  await expect(page).toHaveURL(/\/$|localhost:3000\/?(\?.*)?$/, { timeout: 10_000 });
  expect(await overflows(page)).toEqual([]);
});

test('admin redirects to / when not logged in', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/admin', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await expect(page).toHaveURL(/\/$|localhost:3000\/?(\?.*)?$/, { timeout: 10_000 });
  expect(await overflows(page)).toEqual([]);
});

for (const theme of ['light', 'dark'] as const) {
  test(`theme intact + no overflow (${theme})`, async ({ page }) => {
    for (const route of ['/', '/history', '/quiz?subject=history&lesson=all&count=10&time=10']) {
      await page.setViewportSize({ width: 375, height: 900 });
      await page.addInitScript((t) => {
        localStorage.setItem('ontap12-v1', JSON.stringify({ theme: t }));
      }, theme);
      await page.goto(route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
      const applied = await page.evaluate(() => document.documentElement.dataset.theme);
      expect(applied).toBe(theme);
      expect(await overflows(page), `${route} ${theme}`).toEqual([]);
    }
  });
}

// Header is a 3-col grid (menu/logo/actions) with nowrap items: at 320–412px
// the columns used to overlap (CTA painted over the logo) without causing
// page-level scroll — so the overflow check above can't see it. Assert the
// three visible header cells are pairwise disjoint instead.
test('header cells do not overlap @ small widths', async ({ page }) => {
  for (const w of [320, 360, 375, 390, 412]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const overlap = await page.evaluate(() => {
      const rect = (s: string) => {
        const el = document.querySelector(s) as HTMLElement | null;
        if (!el || getComputedStyle(el).display === 'none') return null;
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right };
      };
      const cells = ['.menu-btn', '.logo', '.header-act']
        .map(rect)
        .filter((r) => r !== null);
      const bad: string[] = [];
      for (let i = 0; i < cells.length; i++) {
        for (let j = i + 1; j < cells.length; j++) {
          const a = cells[i]!;
          const b = cells[j]!;
          if (a.left < b.right - 1 && b.left < a.right - 1) {
            bad.push(`${i}x${j}:[${Math.round(a.left)}-${Math.round(a.right)}]/[${Math.round(b.left)}-${Math.round(b.right)}]`);
          }
        }
      }
      return bad;
    });
    expect(overlap, `header overlap @ ${w}px`).toEqual([]);
  }
});
