/**
 * tests/e2e/audit-responsive.spec.ts — Task 3 responsive + theme + a11y audit.
 *
 * Implements .superpowers/sdd/2026-10-09-full-product-audit/task-3-brief.md:
 *   A. Responsive matrix (375x667, 390x844, 768x1024, 1280x800, 1440x900)
 *   B. Mobile navigation (<=900px) vs desktop
 *   C. Theme (toggle + persistence + contrast sanity in both themes)
 *   D. Accessibility / keyboard
 *   E. Error / empty states
 *
 * Read-only for app source; no arbitrary sleeps (expect() / polling only);
 * theme persistence is proven with reloads + navigation, never waits.
 *
 * Output: one JSON per area under audit-data/resp-*.json (machine-readable
 * measurements for the report) + failure screenshots under screenshots/.
 */
import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const AUDIT_DIR = join(
  process.cwd(),
  '.superpowers/sdd/2026-10-09-full-product-audit',
);
const DATA_DIR = join(AUDIT_DIR, 'audit-data');
const SHOT_DIR = join(AUDIT_DIR, 'screenshots');
mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(SHOT_DIR, { recursive: true });

/** The brief's exact viewport matrix. */
const VIEWPORTS = [
  { w: 375, h: 667, id: '375x667' },
  { w: 390, h: 844, id: '390x844' },
  { w: 768, h: 1024, id: '768x1024' },
  { w: 1280, h: 800, id: '1280x800' },
  { w: 1440, h: 900, id: '1440x900' },
] as const;

/** Brief A: "check a few key containers ... for scrollWidth <= clientWidth + 1". */
const CONTAINER_SELECTORS = [
  'main.wrap',
  '.header-act',
  '.filters',
  '.frow',
  '#qOpts',
  '.cfg-grid',
  '.chk-grid',
  '.pager',
  '.rev-head',
  '#qPal',
];

/** Brief A: text must not overflow its card. */
const TEXT_SELECTORS = ['.bank-item summary', '.opt'];

const QUIZ_MID_EXAM =
  '/quiz?subject=chemistry&lesson=all&count=10&time=10&level=all&qtype=all&practice=false&shQ=true&shA=true&quick=false';

/** Same exam shape, MCQ-only (history has no true/false) — deterministic keyboard target. */
const QUIZ_KEYBOARD_URL =
  '/quiz?subject=history&lesson=all&count=10&time=10&level=all&qtype=multiple_choice&practice=false&shQ=true&shA=true&quick=false';

// ------------------------------------------------------------------ helpers

interface Check {
  name: string;
  pass: boolean;
  detail?: string;
}

interface AreaRec {
  area: string;
  checks: Check[];
  notes: string[];
  screenshots: string[];
  data: Record<string, unknown>;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);

/** Recorder: run audit assertions, keep going after failure, gate at the end. */
function area(id: string, page: Page) {
  const rec: AreaRec = {
    area: id,
    checks: [],
    notes: [],
    screenshots: [],
    data: {},
  };
  return {
    rec,
    async check(name: string, fn: () => Promise<void>) {
      try {
        await fn();
        rec.checks.push({ name, pass: true });
      } catch (err) {
        rec.checks.push({
          name,
          pass: false,
          detail: String((err as Error)?.message ?? err)
            .split('\n')
            .slice(0, 8)
            .join(' | ')
            .slice(0, 800),
        });
        const p = join(SHOT_DIR, `fail-resp-${id}-${slug(name)}.png`);
        await page
          .screenshot({ path: p, fullPage: true })
          .catch(() => {});
        rec.screenshots.push(p);
      }
    },
    note(s: string) {
      rec.notes.push(s);
    },
    set(key: string, value: unknown) {
      rec.data[key] = value;
    },
    save() {
      writeFileSync(
        join(DATA_DIR, `resp-${id}.json`),
        JSON.stringify(rec, null, 2),
      );
    },
    gate() {
      const failed = rec.checks.filter((c) => !c.pass);
      expect(
        failed.map((f) => `${f.name}${f.detail ? ` — ${f.detail}` : ''}`),
        `area ${id}: ${failed.length} failed check(s)`,
      ).toEqual([]);
    },
  };
}

/** Scan rendered text for undefined / [object Object] / NaN. */
async function scanUnexpected(page: Page) {
  return page.evaluate(() => {
    const rx = /\bundefined\b|\[object Object\]|\bNaN\b/;
    const skip = new Set([
      'SCRIPT',
      'STYLE',
      'CODE',
      'PRE',
      'TEXTAREA',
      'NOSCRIPT',
    ]);
    const out: { text: string; ctx: string }[] = [];
    const seen = new Set<string>();
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const t = node.textContent ?? '';
      const m = t.match(rx);
      if (!m) continue;
      const el = node.parentElement;
      if (!el) continue;
      let p: HTMLElement | null = el;
      let skipped = false;
      while (p && p !== document.body) {
        if (skip.has(p.tagName.toUpperCase())) {
          skipped = true;
          break;
        }
        p = p.parentElement;
      }
      if (skipped) continue;
      const ctx = (el.closest('[class]') as HTMLElement | null)?.className
        ?.toString()
        .slice(0, 60);
      const key = m[0] + '@' + ctx;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ text: m[0], ctx: ctx ?? el.tagName });
    }
    return out.slice(0, 20);
  });
}

// ------------------------------------------------------- measurements (A)

interface ContainerOverflow {
  sel: string;
  index: number;
  sw: number;
  cw: number;
  over: number;
}

interface OutsideEl {
  tag: string;
  cls: string;
  left: number;
  right: number;
}

interface TextOverflow {
  sel: string;
  index: number;
  over: number;
  right: number;
  cardRight: number;
  text: string;
}

interface Measure {
  vp: string;
  doc: { sw: number; cw: number; over: number };
  containers: ContainerOverflow[];
  outside: OutsideEl[];
  texts: TextOverflow[];
}

/**
 * All brief-A measurements in one evaluate():
 *  - document-level horizontal overflow,
 *  - per-container scrollWidth overflow for the brief's selector list,
 *  - elements sticking out of the viewport (with the documented exceptions:
 *    off-canvas skip link / mobile drawer+scrim / intentional internal
 *    scrollers / portals),
 *  - text overflowing its card for `.bank-item summary` and `.opt`.
 */
async function measure(page: Page, vp: string): Promise<Measure> {
  return page.evaluate(
    ({ vpId, containerSels, textSels }) => {
      const de = document.documentElement;
      const out: Measure = {
        vp: vpId,
        doc: {
          sw: de.scrollWidth,
          cw: de.clientWidth,
          over: de.scrollWidth - de.clientWidth,
        },
        containers: [],
        outside: [],
        texts: [],
      };
      const visible = (el: HTMLElement) => {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        return el.getClientRects().length > 0;
      };

      for (const sel of containerSels) {
        document.querySelectorAll<HTMLElement>(sel).forEach((el, index) => {
          if (!visible(el)) return;
          out.containers.push({
            sel,
            index,
            sw: el.scrollWidth,
            cw: el.clientWidth,
            over: el.scrollWidth - el.clientWidth,
          });
        });
      }

      // Elements sticking out of the viewport. `.theory` has overflow-x:auto,
      // `.nav` is the off-canvas drawer / desktop scroller, `.scrim` and the
      // skip link are parked off-canvas by design.
      const skipSel =
        '.skip-link, .nav, .scrim, .theory, [data-slot="select-content"], [role="dialog"]';
      const vw = window.innerWidth;
      document.querySelectorAll<HTMLElement>('body *').forEach((h) => {
        if (h.closest(skipSel)) return;
        let p: HTMLElement | null = h.parentElement;
        for (let d = 0; d < 5 && p; d++, p = p.parentElement) {
          const ox = getComputedStyle(p).overflowX;
          if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return;
        }
        const r = h.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return;
        if (r.right > vw + 1 || r.left < -1) {
          out.outside.push({
            tag: h.tagName.toLowerCase(),
            cls: (h.className?.toString?.() || '').slice(0, 80),
            left: Math.round(r.left),
            right: Math.round(r.right),
          });
        }
      });
      out.outside = out.outside.slice(0, 15);

      for (const sel of textSels) {
        document.querySelectorAll<HTMLElement>(sel).forEach((el, index) => {
          if (!visible(el)) return;
          const card = el.closest(
            '.panel, .bank-item, .q-card, .rev, .r-box, .vcard',
          ) as HTMLElement | null;
          const r = el.getBoundingClientRect();
          out.texts.push({
            sel,
            index,
            over: el.scrollWidth - el.clientWidth,
            right: Math.round(r.right),
            cardRight: card ? Math.round(card.getBoundingClientRect().right) : -1,
            text: (el.textContent ?? '').trim().slice(0, 60),
          });
        });
      }
      return out;
    },
    { vpId: vp, containerSels: CONTAINER_SELECTORS, textSels: TEXT_SELECTORS },
  );
}

/** Assert one measurement: no doc overflow, no container clipping, no text overflow. */
function gateMeasure(m: Measure, label: string) {
  expect(m.doc.over, `${label} @${m.vp}: document overflow px`).toBeLessThanOrEqual(1);
  const badContainers = m.containers.filter((c) => c.over > 1);
  expect(
    badContainers.map((c) => `${c.sel}[${c.index}] +${c.over}px`),
    `${label} @${m.vp}: clipped containers`,
  ).toEqual([]);
  const badTexts = m.texts.filter((t) => t.over > 1 || (t.cardRight >= 0 && t.right > t.cardRight + 1));
  expect(
    badTexts.map((t) => `${t.sel}[${t.index}] +${t.over}px right=${t.right}>card=${t.cardRight} "${t.text}"`),
    `${label} @${m.vp}: text overflowing its card`,
  ).toEqual([]);
  const badOutside = m.outside.filter((o) => o.right > m.doc.cw + 1);
  expect(
    badOutside.map((o) => `${o.tag}.${o.cls} [${o.left},${o.right}]`),
    `${label} @${m.vp}: elements outside the viewport`,
  ).toEqual([]);
}

// ------------------------------------------------------------ theme (C)

const CONTRAST_SCRIPT = (sel: string) => {
  const parse = (
    c: string,
  ): [number, number, number, number] | null => {
    const m = /^rgba?\(([^)]+)\)$/.exec(c);
    if (m) {
      const p = m[1]
        .split(/[,\/\s]+/)
        .filter(Boolean)
        .map(Number);
      return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
    }
    const m2 =
      /^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/.exec(c);
    if (m2) {
      return [
        +m2[1] * 255,
        +m2[2] * 255,
        +m2[3] * 255,
        m2[4] ? +m2[4] : 1,
      ];
    }
    return null;
  };
  const lum = (rgb: number[]) => {
    const f = (v: number) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
  };
  const el = document.querySelector(sel);
  if (!el) return null;
  const cs = getComputedStyle(el);
  const fg = parse(cs.color);
  if (!fg) return null;
  // Effective background: composite every ancestor layer over white.
  const layers: [number, number, number, number][] = [];
  let node: Element | null = el;
  while (node) {
    const c = parse(getComputedStyle(node).backgroundColor);
    if (c && c[3] > 0) layers.push(c);
    node = node.parentElement;
  }
  let base: [number, number, number, number] = [255, 255, 255, 1];
  for (let i = layers.length - 1; i >= 0; i--) {
    const [r, g, b, a] = layers[i];
    base = [
      r * a + base[0] * (1 - a),
      g * a + base[1] * (1 - a),
      b * a + base[2] * (1 - a),
      1,
    ];
  }
  const l1 = lum(fg);
  const l2 = lum(base);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  return {
    sel,
    color: cs.color,
    bg: `rgb(${base.slice(0, 3).map(Math.round).join(', ')})`,
    fontSize: cs.fontSize,
    fontWeight: cs.fontWeight,
    ratio: Math.round(ratio * 100) / 100,
  };
};

interface Contrast {
  sel: string;
  color: string;
  bg: string;
  fontSize: string;
  fontWeight: string;
  ratio: number;
}

async function contrast(page: Page, sel: string): Promise<Contrast | null> {
  return page.evaluate(CONTRAST_SCRIPT as unknown as string, sel) as Promise<Contrast | null>;
}

/** Contrast sanity gate: WCAG-ish (no same-color-as-background, >= 3:1). */
function gateContrast(c: Contrast | null, sel: string) {
  expect(c, `${sel}: element not found`).not.toBeNull();
  const ratio = c!.ratio;
  expect(
    ratio,
    `${sel}: contrast ${ratio}:1 (color ${c!.color} on ${c!.bg})`,
  ).toBeGreaterThanOrEqual(3);
}

/** Is the point's top-most element the expected selector? (z-order proof) */
async function topElementAt(page: Page, sel: string) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return 'missing';
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return 'zero-size';
    const top = document.elementFromPoint(
      r.left + r.width / 2,
      r.top + r.height / 2,
    );
    if (!top) return 'none';
    return `${top.tagName.toLowerCase()}.${(top.className?.toString?.() || '').trim()}`.slice(0, 60);
  }, sel);
}

/** Answer the current quiz question whatever its type (MCQ click / TF Đúng). */
async function answerCurrent(page: Page) {
  const mcq = page.locator('#qOpts .opt').first();
  if (await mcq.isVisible().catch(() => false)) {
    await mcq.click();
    await expect(mcq).toHaveAttribute('aria-checked', 'true');
    return 'mcq';
  }
  const tf = page.locator('#qOpts .tf-row button[aria-label="Đúng"]').first();
  await expect(tf).toBeVisible();
  await tf.click();
  await expect(tf).toHaveClass(/btn-primary/);
  return 'tf';
}

/**
 * Move to a question that renders `.opt` rows (chemistry exams mix MCQ with
 * true/false), so the brief's `.opt` text-overflow check has real elements.
 */
async function gotoMcqQuestion(page: Page) {
  await page.locator('#qRoot').focus();
  for (let i = 0; i < 10; i++) {
    if (await page.locator('#qOpts .opt').first().isVisible().catch(() => false)) {
      return i;
    }
    await page.keyboard.press('ArrowRight');
  }
  throw new Error('no MCQ question found in this exam');
}

// ============================================================ A. matrix

/**
 * Detector self-check: prove the A matrix can actually see overflow/clipping
 * before trusting 45 green page×viewport results. Injects deliberately broken
 * markup into the live page (DOM only, no source change) and requires the
 * measurement to flag every one of the three defect classes.
 */
test('A0. detector self-check (the matrix is not vacuous)', async ({ page }) => {
  test.setTimeout(120_000);
  const a = area('matrix-selfcheck', page);
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/', { waitUntil: 'networkidle', timeout: 60_000 });
  await expect(page.locator('h1')).toBeVisible({ timeout: 30_000 });

  const baseline = await measure(page, '375x667');
  await a.check('clean page measures clean', async () => {
    gateMeasure(baseline, 'selfcheck-baseline');
  });

  await page.evaluate(() => {
    // 1. an element sticking out of the viewport
    const wide = document.createElement('div');
    wide.id = 'auditProbeWide';
    wide.style.cssText = 'width:900px;height:40px;background:red';
    document.querySelector('main.wrap')!.appendChild(wide);
    // 2. a container with clipped content
    const box = document.createElement('div');
    box.id = 'auditProbeBox';
    box.className = 'panel';
    box.style.cssText = 'width:120px;overflow:hidden';
    const inner = document.createElement('div');
    inner.style.cssText = 'width:600px;height:30px;background:blue';
    box.appendChild(inner);
    document.querySelector('main.wrap')!.appendChild(box);
    // 3. text overflowing its card
    const card = document.createElement('div');
    card.className = 'panel';
    const opt = document.createElement('div');
    opt.className = 'opt';
    opt.style.cssText = 'width:120px;overflow:hidden';
    opt.textContent = 'X'.repeat(400);
    card.appendChild(opt);
    document.querySelector('main.wrap')!.appendChild(card);
  });

  const broken = await measure(page, '375x667');
  await page.evaluate(() => {
    for (const id of ['auditProbeWide', 'auditProbeBox']) {
      document.getElementById(id)?.remove();
    }
    document.querySelectorAll('main.wrap > .panel').forEach((p) => {
      if (p.querySelector('.opt') && p.textContent?.startsWith('XXX')) p.remove();
    });
  });
  const restored = await measure(page, '375x667');

  a.set('broken', {
    doc: broken.doc,
    containers: broken.containers.filter((c) => c.over > 1),
    outside: broken.outside,
    texts: broken.texts.filter((t) => t.over > 1 || (t.cardRight >= 0 && t.right > t.cardRight + 1)),
  });
  await a.check('document overflow is detected (injected 900px element)', async () => {
    expect(broken.doc.over).toBeGreaterThan(1);
  });
  await a.check('clipped container is detected (injected overflow:hidden .panel)', async () => {
    expect(
      broken.containers.filter((c) => c.over > 1).map((c) => `${c.sel} +${c.over}px`),
    ).not.toEqual([]);
  });
  await a.check('out-of-viewport element is detected', async () => {
    expect(broken.outside.length, JSON.stringify(broken.outside)).toBeGreaterThan(0);
  });
  await a.check('text overflowing its card is detected', async () => {
    expect(
      broken.texts.filter((t) => t.over > 1 || (t.cardRight >= 0 && t.right > t.cardRight + 1)).length,
    ).toBeGreaterThan(0);
  });
  await a.check('removing the injected nodes restores a clean measurement', async () => {
    gateMeasure(restored, 'selfcheck-restored');
  });
  a.save();
  a.gate();
});

const STATIC_PAGES: { id: string; url: string; ready: string; label: string }[] =
  [
    { id: 'home', url: '/', ready: 'h1', label: '/' },
    { id: 'history', url: '/history', ready: '#subjectHead h2', label: '/history' },
    { id: 'bank', url: '/bank', ready: '#bankList .bank-item', label: '/bank' },
    { id: 'vocab', url: '/vocab', ready: '#fcMain', label: '/vocab' },
    {
      id: 'progress',
      url: '/progress',
      ready: '#view-progress h2, main.wrap h2',
      label: '/progress',
    },
    {
      id: 'notebook',
      url: '/notebook',
      ready: 'main.wrap h2',
      label: '/notebook',
    },
    {
      id: 'theory',
      url: '/biology/theory/4',
      ready: 'article.theory h2',
      label: '/biology/theory/4',
    },
  ];

test('A. responsive matrix — 7 static pages x 5 viewports', async ({ page }) => {
  test.setTimeout(900_000);
  const a = area('matrix-static', page);
  const matrix: Record<string, Record<string, Measure>> = {};

  for (const p of STATIC_PAGES) {
    matrix[p.id] = {};
    for (const vp of VIEWPORTS) {
      const label = `${p.label} @${vp.id}`;
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.goto(p.url, { waitUntil: 'networkidle', timeout: 60_000 });
      await expect(page.locator(p.ready).first()).toBeVisible({ timeout: 30_000 });
      // Bank: expand the first item so its summary + body render (brief A).
      if (p.id === 'bank') {
        await page.locator('.bank-item summary').first().click();
        await expect(page.locator('.bank-item[open]').first()).toBeVisible();
      }
      const m = await measure(page, vp.id);
      matrix[p.id][vp.id] = m;
      await a.check(`no overflow/clipping: ${label}`, async () => {
        gateMeasure(m, p.label);
      });
      if (m.doc.over > 1 || m.containers.some((c) => c.over > 1)) {
        const shot = join(
          SHOT_DIR,
          `overflow-${p.id}-${vp.id.replace('x', '-')}.png`,
        );
        await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
        a.rec.screenshots.push(shot);
      }
    }
  }
  a.set('matrix', matrix);
  // Summary numbers for the report.
  a.set(
    'summary',
    Object.fromEntries(
      Object.entries(matrix).map(([pid, vps]) => [
        pid,
        Object.fromEntries(
          Object.entries(vps).map(([v, m]) => [
            v,
            {
              docOver: m.doc.over,
              clippedContainers: m.containers.filter((c) => c.over > 1).length,
              overflowingTexts: m.texts.filter(
                (t) => t.over > 1 || (t.cardRight >= 0 && t.right > t.cardRight + 1),
              ).length,
              outsideViewport: m.outside.length,
            },
          ]),
        ),
      ]),
    ),
  );
  a.save();
  a.gate();
});

test('A. responsive matrix — quiz mid-exam x 5 viewports', async ({ page }) => {
  test.setTimeout(600_000);
  const a = area('matrix-quiz', page);
  const matrix: Record<string, Measure> = {};

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.goto(QUIZ_MID_EXAM, { waitUntil: 'networkidle', timeout: 60_000 });
    await expect(page.locator('#qRoot')).toBeVisible({ timeout: 30_000 });
    // Answer the question so `.opt` renders its selected/text state (brief A).
    // Chemistry exams mix MCQ with true/false — walk to an MCQ question.
    await gotoMcqQuestion(page);
    await answerCurrent(page);
    const m = await measure(page, vp.id);
    matrix[vp.id] = m;
    await a.check(`no overflow/clipping: quiz mid-exam @${vp.id}`, async () => {
      gateMeasure(m, 'quiz');
    });
    if (m.doc.over > 1 || m.containers.some((c) => c.over > 1)) {
      const shot = join(SHOT_DIR, `overflow-quiz-${vp.id.replace('x', '-')}.png`);
      await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
      a.rec.screenshots.push(shot);
    }
  }
  a.set('matrix', matrix);
  a.save();
  a.gate();
});

test('A. responsive matrix — /result after a completed quiz x 5 viewports', async ({
  page,
}) => {
  test.setTimeout(600_000);
  const a = area('matrix-result', page);
  const matrix: Record<string, Measure> = {};

  // Complete a short quiz (the task-2 flow) so /result has real content.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(
    '/quiz?subject=history&lesson=all&count=5&time=10&level=all&qtype=all&practice=true&shQ=true&shA=true',
    { waitUntil: 'networkidle', timeout: 60_000 },
  );
  await expect(page.locator('#qRoot')).toBeVisible({ timeout: 30_000 });
  for (let i = 0; i < 5; i++) {
    await page.locator('#qOpts .opt').first().click();
    if (i < 4) {
      await page.locator('#qNext').click();
      await expect(page.locator('#qCount')).toHaveText(`Câu ${i + 2}/5`);
    }
  }
  await page.locator('#qSubmit').click();
  await expect(page).toHaveURL(/\/result/, { timeout: 30_000 });
  await expect(page.locator('#rPoint')).toBeVisible({ timeout: 30_000 });

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    // B19: /result is read-once, so a reload lands on '/' instead of replaying
    // the exam. Measure each viewport by re-running the quiz fresh at that
    // width (one navigation per viewport, no reload).
    await page.goto(
      '/quiz?subject=history&lesson=all&count=5&time=10&level=all&qtype=all&practice=true&shQ=true&shA=true',
      { waitUntil: 'networkidle', timeout: 60_000 },
    );
    await expect(page.locator('#qRoot')).toBeVisible({ timeout: 30_000 });
    for (let i = 0; i < 5; i++) {
      await page.locator('#qOpts .opt').first().click();
      if (i < 4) {
        await page.locator('#qNext').click();
        await expect(page.locator('#qCount')).toHaveText(`Câu ${i + 2}/5`);
      }
    }
    await page.locator('#qSubmit').click();
    await expect(page).toHaveURL(/\/result/, { timeout: 30_000 });
    await expect(page.locator('#rPoint')).toBeVisible({ timeout: 30_000 });
    const m = await measure(page, vp.id);
    matrix[vp.id] = m;
    await a.check(`no overflow/clipping: /result @${vp.id}`, async () => {
      gateMeasure(m, 'result');
    });
    if (m.doc.over > 1 || m.containers.some((c) => c.over > 1)) {
      const shot = join(SHOT_DIR, `overflow-result-${vp.id.replace('x', '-')}.png`);
      await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
      a.rec.screenshots.push(shot);
    }
  }
  a.set('matrix', matrix);
  a.save();
  a.gate();
});

// ============================================================ B. mobile nav

const MOBILE_VPS = [
  { w: 390, h: 844, id: '390x844' },
  { w: 375, h: 667, id: '375x667' },
];

interface NavState {
  navOpen: boolean;
  menuBtn: { display: string; visibility: string; box: number[] } | null;
  nav: { box: number[]; transform: string; visibility: string; zIndex: string } | null;
  scrim: { display: string; opacity: string; visibility: string; box: number[] } | null;
  header: { box: number[]; zIndex: string } | null;
  firstLink: { top: number; visibility: string } | null;
  headerInLeft: number;
  menuBtnLeft: number;
  logoLeft: number;
}

async function navState(page: Page): Promise<NavState> {
  return page.evaluate(() => {
    const box = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return [
        Math.round(r.left),
        Math.round(r.top),
        Math.round(r.right),
        Math.round(r.bottom),
      ];
    };
    const menu = document.querySelector('.menu-btn');
    const nav = document.querySelector('#mainNav');
    const scrim = document.querySelector('.scrim');
    const header = document.querySelector('.header');
    const firstLink = document.querySelector('#mainNav a');
    const cs = (el: Element | null) => (el ? getComputedStyle(el) : null);
    return {
      navOpen: document.body.classList.contains('nav-open'),
      menuBtn: menu
        ? {
            display: cs(menu)!.display,
            visibility: cs(menu)!.visibility,
            box: box(menu)!,
          }
        : null,
      nav: nav
        ? {
            box: box(nav)!,
            transform: cs(nav)!.transform,
            visibility: cs(nav)!.visibility,
            zIndex: cs(nav)!.zIndex,
          }
        : null,
      scrim: scrim
        ? {
            display: cs(scrim)!.display,
            opacity: cs(scrim)!.opacity,
            visibility: cs(scrim)!.visibility,
            box: box(scrim)!,
          }
        : null,
      header: header
        ? { box: box(header)!, zIndex: cs(header)!.zIndex }
        : null,
      firstLink: firstLink
        ? {
            top: Math.round(firstLink.getBoundingClientRect().top),
            visibility: cs(firstLink)!.visibility,
          }
        : null,
      headerInLeft: Math.round(
        document.querySelector('.header-in')!.getBoundingClientRect().left,
      ),
      menuBtnLeft: Math.round(
        document.querySelector('.menu-btn')!.getBoundingClientRect().left,
      ),
      logoLeft: Math.round(
        document.querySelector('.logo')!.getBoundingClientRect().left,
      ),
    };
  });
}

test('B. mobile navigation (<=900px) + desktop behaviour', async ({ page }) => {
  test.setTimeout(300_000);
  const a = area('mobile-nav', page);

  for (const vp of MOBILE_VPS) {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.goto('/', { waitUntil: 'networkidle', timeout: 60_000 });
    await expect(page.locator('h1')).toBeVisible({ timeout: 30_000 });

    const closed = await navState(page);
    a.note(`${vp.id}: header-in left=${closed.headerInLeft} logo left=${closed.logoLeft} menu-btn left=${closed.menuBtnLeft}`);
    await a.check(`${vp.id}: menu button visible, drawer + scrim hidden when closed`, async () => {
      expect(closed.menuBtn?.display).not.toBe('none');
      expect(closed.navOpen).toBe(false);
      expect(closed.nav!.visibility).toBe('hidden');
      expect(closed.scrim!.visibility).toBe('hidden');
      expect(Number(closed.scrim!.opacity)).toBe(0);
      expect(
        closed.menuBtnLeft,
        `menu button left edge ${closed.menuBtnLeft} (header-in left ${closed.headerInLeft})`,
      ).toBeGreaterThanOrEqual(10);
      expect(
        closed.logoLeft,
        `logo left edge ${closed.logoLeft} — content touches the screen edge`,
      ).toBeGreaterThanOrEqual(10);
    });

    await page.locator('.menu-btn').click();
    await expect(page.locator('body')).toHaveClass(/nav-open/);
    // The drawer/scrim animate over .25s — poll the settled geometry instead
    // of sleeping, so the measurements below describe the open state.
    await expect
      .poll(async () => (await navState(page)).nav!.box[0], { timeout: 5_000 })
      .toBeGreaterThanOrEqual(0);
    await expect
      .poll(async () => Number((await navState(page)).scrim!.opacity), { timeout: 5_000 })
      .toBe(1);
    const open = await navState(page);
    a.note(
      `${vp.id} open: nav box=[${open.nav!.box}] transform=${open.nav!.transform} ` +
        `scrim opacity=${open.scrim!.opacity} header z=${open.header!.zIndex} nav z=${open.nav!.zIndex}`,
    );

    await a.check(`${vp.id}: drawer slides in (body.nav-open, nav on-canvas, scrim opacity 1)`, async () => {
      expect(open.navOpen).toBe(true);
      expect(open.nav!.visibility).toBe('visible');
      expect(
        open.nav!.box[0],
        `drawer left edge ${open.nav!.box[0]} while transform=${open.nav!.transform}`,
      ).toBeGreaterThanOrEqual(0);
      expect(open.nav!.transform).toMatch(/matrix\(1, 0, 0, 1, 0, 0\)|none/);
      expect(Number(open.scrim!.opacity), 'scrim opacity').toBe(1);
      expect(open.scrim!.visibility).toBe('visible');
    });

    await a.check(`${vp.id}: drawer content starts at/under the header`, async () => {
      expect(open.firstLink!.visibility).toBe('visible');
      // 64px padding clears the 64px header bar exactly; the 1px border can
      // put the link's top 1px above the header box bottom (cosmetic, P3).
      expect(
        open.firstLink!.top,
        `first link top ${open.firstLink!.top} vs header bottom ${open.header!.box[3]}`,
      ).toBeGreaterThanOrEqual(open.header!.box[3] - 1);
    });

    // The header is raised to z-index 310 while the drawer is open, so the
    // menu button must stay the top-most element at its own centre.
    const hit = await topElementAt(page, '.menu-btn');
    a.note(`${vp.id}: element at menu-button centre while drawer open = ${hit}`);
    await a.check(`${vp.id}: menu button stays visible/clickable above the drawer`, async () => {
      expect(
        hit,
        `top element at .menu-btn centre is "${hit}" (header z=${open.header!.zIndex}, nav z=${open.nav!.zIndex})`,
      ).toMatch(/menu-btn|svg|path/);
    });

    // Raw pointer tap (bypasses actionability) — a real user's tap on the button.
    const mb = open.menuBtn!.box;
    await page.mouse.click(mb[0] + (mb[2] - mb[0]) / 2, mb[1] + (mb[3] - mb[1]) / 2);
    const afterTap = await navState(page);
    await a.check(`${vp.id}: tapping the menu button closes the drawer`, async () => {
      expect(
        afterTap.navOpen,
        `body still has nav-open after tapping .menu-btn (hit="${hit}")`,
      ).toBe(false);
    });

    // F-B5 fixed the one-way toggle: the raw tap above already closed the
    // drawer (asserted). Escape is pressed here only to guarantee a closed
    // drawer before the scrim check below reopens it — a no-op after the tap.
    await page.keyboard.press('Escape');
    await expect(page.locator('body')).not.toHaveClass(/nav-open/);

    // Reopen, then dismiss via the scrim.
    await page.locator('.menu-btn').click();
    await expect(page.locator('body')).toHaveClass(/nav-open/);
    await page.mouse.click(vp.w - 16, Math.round(vp.h * 0.8));
    await expect(page.locator('body')).not.toHaveClass(/nav-open/);
    await a.check(`${vp.id}: scrim tap closes the drawer`, async () => {
      expect((await navState(page)).navOpen).toBe(false);
    });

    // Reopen, then Escape.
    await page.locator('.menu-btn').click();
    await expect(page.locator('body')).toHaveClass(/nav-open/);
    await page.keyboard.press('Escape');
    await expect(page.locator('body')).not.toHaveClass(/nav-open/);
    await a.check(`${vp.id}: Escape closes the drawer`, async () => {
      expect((await navState(page)).navOpen).toBe(false);
    });
  }

  // ---- desktop ----------------------------------------------------------
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/', { waitUntil: 'networkidle', timeout: 60_000 });
  await expect(page.locator('h1')).toBeVisible({ timeout: 30_000 });
  const desk = await navState(page);
  await a.check('1280: drawer not open, nav inline, menu button + scrim display:none', async () => {
    expect(desk.navOpen, 'body must not have nav-open on desktop').toBe(false);
    expect(desk.menuBtn?.display, 'menu button hidden on desktop').toBe('none');
    expect(desk.scrim?.display, 'scrim display:none on desktop').toBe('none');
    expect(desk.nav!.visibility).toBe('visible');
    expect(desk.nav!.box[0]).toBeGreaterThan(desk.header!.box[0]);
    expect(desk.nav!.box[2]).toBeLessThan(desk.header!.box[2]);
    expect(desk.nav!.box[1]).toBeGreaterThanOrEqual(0);
    expect(desk.nav!.transform).toMatch(/none|matrix\(1, 0, 0, 1, 0, 0\)/);
  });
  a.save();
  a.gate();
});

// ============================================================ C. theme

const THEME_BTN = 'button[aria-label="Chuyển sáng / tối"]';

interface ApiQuestion {
  id: string;
  question: string;
  options?: string[];
  correctAnswer: number;
  type?: string;
}

/**
 * Build a /result page with a fully known answer pattern (4 correct, 4 wrong,
 * 4 skipped) so the review renders `.tag.ok`, `.tag.bad` and `.tag.skip`.
 *
 * The correct answers come from the app's own public bank API (see the
 * incidental finding in the report); `shQ=false&shA=false` keeps both question
 * and option order identical to the bank, so clicking `.opt` #correctAnswer is
 * deterministic.
 */
async function seedResult(page: Page, a: ReturnType<typeof area>) {
  const res = await page.request.get('/api/questions?subject=history&limit=200');
  expect(res.status(), '/api/questions status').toBe(200);
  const data = (await res.json()) as { questions: ApiQuestion[] };
  const mcq = data.questions.filter(
    (q) =>
      (q.type ?? 'multiple_choice') === 'multiple_choice' &&
      Array.isArray(q.options) &&
      q.options.length >= 3 &&
      q.correctAnswer >= 0,
  );
  expect(mcq.length, 'history MCQ questions available').toBeGreaterThanOrEqual(12);
  const picked = mcq.slice(0, 12);
  const ids = picked.map((q) => q.id).join(',');
  await page.goto(
    `/quiz?subject=history&lesson=all&count=12&time=15&level=all&qtype=all&practice=false&shQ=false&shA=false&ids=${ids}`,
    { waitUntil: 'networkidle', timeout: 60_000 },
  );
  await expect(page.locator('#qRoot')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#qCount')).toHaveText('Câu 1/12');
  const norm = (s: string) => s.replace(/^Câu \d+:\s*/, '').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 8; i++) {
    const text = norm(await page.locator('#qText').innerText());
    const q = picked[i]!;
    expect(text, `question ${i + 1} order vs API`).toBe(norm(q.question));
    const pick =
      i < 4 ? q.correctAnswer : (q.correctAnswer + 1) % q.options!.length;
    await page.locator('#qOpts .opt').nth(pick).click();
    if (i < 7) {
      await page.locator('#qNext').click();
      await expect(page.locator('#qCount')).toHaveText(`Câu ${i + 2}/12`);
    }
  }
  await page.locator('#qSubmit').click();
  await expect(page).toHaveURL(/\/result/, { timeout: 30_000 });
  await expect(page.locator('#rPoint')).toBeVisible({ timeout: 30_000 });
  const tags = await page.evaluate(() => ({
    ok: document.querySelectorAll('#reviewList .tag.ok').length,
    bad: document.querySelectorAll('#reviewList .tag.bad').length,
    skip: document.querySelectorAll('#reviewList .tag.skip').length,
  }));
  a.note(`seeded /result review tags: ${JSON.stringify(tags)}`);
  await a.check('seeded /result shows ok + bad + skip review tags', async () => {
    expect(tags).toEqual({ ok: 4, bad: 4, skip: 4 });
  });
}

/** Contrast + visibility sanity for every selector the brief lists.
 *
 * `alreadyOnResult`: /result consumes its sessionStorage key on first render
 * (B19 read-once), so navigating to it a second time lands home. Pass true
 * when the caller has just seeded it (i.e. the page is on /result now).
 */
async function contrastSuite(
  page: Page,
  a: ReturnType<typeof area>,
  theme: string,
  alreadyOnResult = false,
) {
  // /result review: chip, tag.ok / tag.bad / tag.skip, btn-ghost, muted.
  if (!alreadyOnResult) {
    await page.goto('/result', { waitUntil: 'networkidle', timeout: 60_000 });
  }
  await expect(page.locator('#rPoint')).toBeVisible({ timeout: 30_000 });
  const onResult: [string, string][] = [
    ['.chip', '.chip'],
    ['#reviewList .tag.ok', '.tag.ok'],
    ['#reviewList .tag.bad', '.tag.bad'],
    ['#reviewList .tag.skip', '.tag.skip'],
    ['.rev-tools .btn-ghost', '.btn-ghost'],
    ['.muted', '.muted'],
  ];
  for (const [sel, label] of onResult) {
    const c = await contrast(page, sel);
    await a.check(`${theme}: ${label} contrast on /result (${c?.ratio ?? 'n/a'}:1)`, async () => {
      gateContrast(c, sel);
    });
  }

  // /: badge variants (primary tint) + muted.
  await page.goto('/', { waitUntil: 'networkidle', timeout: 60_000 });
  await expect(page.locator('h1')).toBeVisible({ timeout: 30_000 });
  for (const [sel, label] of [
    ['.badge.h', '.badge.h (history)'],
    ['.badge.b', '.badge.b (biology)'],
    ['.badge.e', '.badge.e (english)'],
    ['.badge.c', '.badge.c (chemistry)'],
    ['.badge', '.badge (neutral)'],
    ['.muted', '.muted'],
  ] as [string, string][]) {
    const c = await contrast(page, sel);
    await a.check(`${theme}: ${label} contrast on / (${c?.ratio ?? 'n/a'}:1)`, async () => {
      gateContrast(c, sel);
    });
  }

  // /bank: the ghost reset button only exists with an active filter.
  await page.goto('/bank', { waitUntil: 'networkidle', timeout: 60_000 });
  await expect(page.locator('#bankList .bank-item').first()).toBeVisible({ timeout: 30_000 });
  await page.locator('input[aria-label="Tìm câu hỏi"]').fill('a');
  const ghost = page.locator('.filters button.btn-ghost');
  await expect(ghost).toBeVisible();
  const cGhost = await contrast(page, '.filters button.btn-ghost');
  await a.check(`${theme}: .btn-ghost visible + readable on /bank (${cGhost?.ratio ?? 'n/a'}:1)`, async () => {
    gateContrast(cGhost, '.filters button.btn-ghost');
  });
  const cSum = await contrast(page, '.bank-item summary');
  await a.check(`${theme}: .bank-item summary readable on /bank (${cSum?.ratio ?? 'n/a'}:1)`, async () => {
    gateContrast(cSum, '.bank-item summary');
  });

  // quiz: #qTopic chip + gold flagged palette cell.
  await page.goto(QUIZ_MID_EXAM, { waitUntil: 'networkidle', timeout: 60_000 });
  await expect(page.locator('#qRoot')).toBeVisible({ timeout: 30_000 });
  await page.locator('#qFlag').click();
  await expect(page.locator('#qFlag')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#qPal button.flag').first()).toBeVisible();
  const cChip = await contrast(page, '#qTopic');
  await a.check(`${theme}: .chip (primary tint) contrast on quiz (${cChip?.ratio ?? 'n/a'}:1)`, async () => {
    gateContrast(cChip, '#qTopic');
  });
  const cFlag = await contrast(page, '#qPal button.flag');
  await a.check(`${theme}: .pal button.flag (gold) text contrast (${cFlag?.ratio ?? 'n/a'}:1)`, async () => {
    gateContrast(cFlag, '#qPal button.flag');
  });
  const cMutedQ = await contrast(page, '.quiz-sub .muted, .muted');
  await a.check(`${theme}: .muted readable on quiz (${cMutedQ?.ratio ?? 'n/a'}:1)`, async () => {
    gateContrast(cMutedQ, '.muted');
  });
}

test('C. theme toggle + persistence + contrast on both themes', async ({ page }) => {
  test.setTimeout(600_000);
  const a = area('theme', page);
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.goto('/', { waitUntil: 'networkidle', timeout: 60_000 });
  await expect(page.locator('h1')).toBeVisible({ timeout: 30_000 });
  const initial = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme ?? '',
    stored: (JSON.parse(localStorage.getItem('ontap12-v1') || '{}') as { theme?: string }).theme,
  }));
  a.note(`initial theme: html=${initial.theme} stored=${initial.stored}`);

  // Build the deterministic /result page before toggling anything.
  await seedResult(page, a);

  // ---- toggle ----------------------------------------------------------
  await page.locator(THEME_BTN).click();
  const dark = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme ?? '',
    stored: (JSON.parse(localStorage.getItem('ontap12-v1') || '{}') as { theme?: string }).theme,
  }));
  await a.check('theme button flips html[data-theme] + writes ontap12-v1.theme', async () => {
    expect(dark.theme, `html data-theme after toggle (was "${initial.theme}")`).not.toBe(initial.theme);
    expect(dark.stored).toBe(dark.theme);
  });

  // A reload of /result would re-post the (already consumed) pending result and
  // land home — B19 read-once consume. Persistence is a theme-storage concern,
  // so the reload checks a non-consuming route (/). #rPoint would only be
  // visible on a fresh seed, which this test does not need for persistence.
  await page.goto('/', { waitUntil: 'networkidle', timeout: 60_000 });
  await page.reload({ waitUntil: 'networkidle', timeout: 60_000 });
  await expect(page.locator('h1')).toBeVisible({ timeout: 30_000 });
  const afterReload = await page.evaluate(
    () => document.documentElement.dataset.theme ?? '',
  );
  await a.check('theme persists across reload', async () => {
    expect(afterReload, `data-theme after reload`).toBe(dark.theme);
  });

  for (const route of ['/history', '/bank', '/vocab']) {
    await page.goto(route, { waitUntil: 'networkidle', timeout: 60_000 });
    const t = await page.evaluate(
      () => document.documentElement.dataset.theme ?? '',
    );
    await a.check(`theme persists across navigation to ${route}`, async () => {
      expect(t, `data-theme on ${route}`).toBe(dark.theme);
    });
  }

  // ---- dark contrast ----------------------------------------------------
  // /result consumes its sessionStorage key on first render (B19 read-once),
  // so each contrast pass needs a freshly seeded one. Theme is re-applied from
  // localStorage on every mount, so the store — not an imperative data-theme
  // write that the next navigation would clobber — is the control surface.
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('ontap12-v1') || '{}') as { theme?: string };
    s.theme = 'dark';
    localStorage.setItem('ontap12-v1', JSON.stringify(s));
  });
  await seedResult(page, a);
  await a.check('fresh seed mounts with the stored dark theme', async () => {
    expect(
      await page.evaluate(() => document.documentElement.dataset.theme ?? ''),
      'data-theme on freshly seeded /result',
    ).toBe('dark');
  });
  await contrastSuite(page, a, `dark[${dark.theme}]`, true);

  // ---- back to light ----------------------------------------------------
  await page.goto('/', { waitUntil: 'networkidle', timeout: 60_000 });
  await expect(page.locator('h1')).toBeVisible({ timeout: 30_000 });
  const lightStored = await page.evaluate(
    () => (JSON.parse(localStorage.getItem('ontap12-v1') || '{}') as { theme?: string }).theme,
  );
  if (lightStored !== 'light') {
    await page.locator(THEME_BTN).click();
  }
  const light = await page.evaluate(() => document.documentElement.dataset.theme ?? '');
  await a.check('theme toggles back to light', async () => {
    expect(light).toBe('light');
  });
  await page.reload({ waitUntil: 'networkidle', timeout: 60_000 });
  await a.check('light theme persists across reload', async () => {
    expect(
      await page.evaluate(() => document.documentElement.dataset.theme ?? ''),
      'data-theme after reload',
    ).toBe('light');
  });
  await seedResult(page, a);
  await contrastSuite(page, a, 'light', true);
  a.save();
  a.gate();
});

/**
 * Ruling (ledger, Task 4/5): the public /api/questions answer data is
 * BY DESIGN. The legacy static site shipped every question with its answer
 * key in static JS, and the bank UI itself publishes answers+explanations
 * publicly ("không cần đăng nhập" footer). Gating it would break the
 * offline-first, no-login product. This test pins that decision.
 */
test('ruled: public /api/questions answer data is by-design', async ({ page }) => {
  const a = area('api-questions-leak', page);
  const res = await page.request.get('/api/questions?subject=history&limit=5');
  const parsed = (await res.json()) as { questions?: Record<string, unknown>[] };
  a.set('status', res.status());
  a.set('rows', (parsed.questions ?? []).length);
  await a.check('answer data is intentionally public (documented ruling)', async () => {
    expect(res.status()).toBe(200);
    const rows = parsed.questions ?? [];
    const withAnswer = rows.filter(
      (q) => 'correctAnswer' in q || 'answer' in q || 'statements' in q,
    );
    // The ruling is that answers STAY public, so assert it: every question
    // in the public payload carries its answer field, and the payload is
    // non-empty (an empty response must not pass vacuously). If someone
    // later gates the answers, this fails and forces a conscious decision —
    // that is the point of a pin. (Was `toBeGreaterThanOrEqual(0)` — a
    // tautology that passed before and after any change.)
    a.set('questionsWithAnswers', withAnswer.length);
    expect(rows.length).toBeGreaterThan(0);
    expect(withAnswer.length).toBe(rows.length);
  });
  a.save();
  a.gate();
});

// ============================================================ D. a11y

test('D. accessibility + keyboard', async ({ page }) => {
  test.setTimeout(600_000);
  const a = area('a11y', page);
  await page.setViewportSize({ width: 1280, height: 800 });

  // ---- D1: tab order + focus outline on / ------------------------------
  await page.goto('/', { waitUntil: 'networkidle', timeout: 60_000 });
  await expect(page.locator('h1')).toBeVisible({ timeout: 30_000 });

  // The skip link must be the first tab stop and must become visible on focus.
  await page.keyboard.press('Tab');
  const skip = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      cls: el.className,
      text: (el.textContent ?? '').trim(),
      left: Math.round(r.left),
      outline: `${cs.outlineStyle} ${cs.outlineWidth}`,
    };
  });
  await a.check('skip link is the first tab stop and becomes visible on focus', async () => {
    expect(skip?.cls).toContain('skip-link');
    expect(skip?.left, `skip-link left after focus (${skip?.left})`).toBeGreaterThanOrEqual(0);
  });

  const stops: string[] = [];
  const outlines: { el: string; outline: string }[] = [];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      return {
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || '').split(/\s+/).slice(0, 2).join('.'),
        text: (el.textContent ?? '').trim().slice(0, 20),
        outline: `${cs.outlineStyle} ${cs.outlineWidth}`,
        focusVisible: el.matches(':focus-visible'),
      };
    });
    if (!info) break;
    stops.push(`${info.tag}.${info.cls}|${info.text}`);
    outlines.push({ el: `${info.tag}.${info.cls}|${info.text}`, outline: info.outline });
  }
  a.note(`tab order after skip link: ${JSON.stringify(stops, null, 1)}`);
  await a.check('tab order: skip link, logo, nav links, auth, theme toggle, CTA', async () => {
    expect(stops[0], 'first stop after skip link').toMatch(/a\.logo/);
    expect(stops[1]).toMatch(/Trang chủ/);
    expect(stops[2]).toMatch(/Môn học/);
    expect(stops[3]).toMatch(/Khám phá/);
    expect(stops[4]).toMatch(/Tạo đề AI/);
    expect(stops[5]).toMatch(/Đăng nhập/);
    expect(stops[6]).toMatch(/Sáng|Tối/); // theme toggle
    expect(stops[7]).toMatch(/Kiểm tra nhanh/); // CTA
  });

  const badOutlines = outlines.filter(
    (o) => !/solid\s+3px/.test(o.outline) && !/solid\s+2px/.test(o.outline),
  );
  await a.check('focus outline visible on every tab stop (:focus-visible)', async () => {
    expect(badOutlines, `computed outlines: ${JSON.stringify(outlines)}`).toEqual([]);
  });

  // The CSS rule itself must exist (not only the UA default).
  const rules = await page.evaluate(() => {
    const out: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let list: CSSRuleList;
      try {
        list = sheet.cssRules;
      } catch {
        continue;
      }
      for (const r of Array.from(list)) {
        if (r.cssText && /focus-visible/.test(r.cssText)) {
          out.push(r.cssText.slice(0, 160));
        }
      }
    }
    return out;
  });
  a.note(`:focus-visible CSS rules: ${JSON.stringify(rules.slice(0, 5))}`);
  await a.check('a :focus-visible CSS rule with an outline is present', async () => {
    const ok = rules.some((r) => /outline/.test(r));
    expect(ok, `no :focus-visible outline rule found in ${rules.length} rules`).toBe(true);
  });

  // Programmatic focus() sample (brief asks for focus() + getComputedStyle too).
  const focusSample = await page.evaluate(() => {
    const els = Array.from(
      document.querySelectorAll<HTMLElement>('button, a[href], input'),
    ).slice(0, 30);
    return els.map((el) => {
      el.focus();
      const cs = getComputedStyle(el);
      return {
        name: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 20),
        focusVisible: el.matches(':focus-visible'),
        outline: `${cs.outlineStyle} ${cs.outlineWidth}`,
      };
    });
  });
  const focusVisibleOnes = focusSample.filter((f) => f.focusVisible);
  const badFocus = focusVisibleOnes.filter((f) => f.outline === 'none' || /^none/.test(f.outline));
  await a.check('focus() + getComputedStyle: outline not "none" where :focus-visible matches', async () => {
    expect(
      badFocus,
      `of ${focusSample.length} sampled elements, ${focusVisibleOnes.length} matched :focus-visible`,
    ).toEqual([]);
  });

  // ---- D2: accessible names on / and /bank ------------------------------
  for (const route of ['/', '/bank']) {
    await page.goto(route, { waitUntil: 'networkidle', timeout: 60_000 });
    await expect(page.locator(route === '/' ? 'h1' : '#bankList .bank-item').first()).toBeVisible({
      timeout: 30_000,
    });
    const names = await page.evaluate(() => {
      const bad: string[] = [];
      const all = Array.from(document.querySelectorAll('button, a'));
      for (const el of all) {
        const labelledBy = el.getAttribute('aria-labelledby');
        const name =
          el.getAttribute('aria-label') ||
          (labelledBy
            ? (document.getElementById(labelledBy)?.textContent ?? '')
            : '') ||
          el.getAttribute('title') ||
          (el.textContent ?? '').trim();
        if (!name.trim()) {
          bad.push(
            `${el.tagName.toLowerCase()}.${String(el.className || '').slice(0, 50)}`,
          );
        }
      }
      return { total: all.length, bad: bad.slice(0, 15), nBad: bad.length };
    });
    a.note(`accessible names on ${route}: ${names.total} interactive elements`);
    await a.check(`every button/a on ${route} has an accessible name (${names.total} checked)`, async () => {
      expect(names.nBad, `unnamed: ${JSON.stringify(names.bad)}`).toBe(0);
    });
  }

  // ---- D3: select / dialog native semantics on /bank --------------------
  await page.goto('/bank', { waitUntil: 'networkidle', timeout: 60_000 });
  await expect(page.locator('#bankList .bank-item').first()).toBeVisible({ timeout: 30_000 });
  const triggers = page.locator('.filters [data-slot="select-trigger"]');
  const nTriggers = await triggers.count();
  expect(nTriggers).toBeGreaterThanOrEqual(5);
  const before = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.filters [data-slot="select-trigger"]')).map((el) => ({
      label: el.getAttribute('aria-label'),
      expanded: el.getAttribute('aria-expanded'),
      controls: el.getAttribute('aria-controls'),
      role: el.getAttribute('role'),
    })),
  );
  a.note(`bank filter selects (closed): ${JSON.stringify(before)}`);
  await a.check('every .filters select trigger exposes role + aria-expanded', async () => {
    for (const t of before) {
      expect(t.role, `role for ${t.label}`).toBe('combobox');
      expect(t.expanded, `aria-expanded for ${t.label}`).toBe('false');
      expect(t.label, `accessible name for the trigger`).toBeTruthy();
    }
  });
  await triggers.first().click();
  await expect(triggers.first()).toHaveAttribute('aria-expanded', 'true');
  const opened = await page.evaluate(() => {
    const t = document.querySelector('.filters [data-slot="select-trigger"]')!;
    const controls = t.getAttribute('aria-controls');
    const target = controls ? document.getElementById(controls) : null;
    return {
      expanded: t.getAttribute('aria-expanded'),
      controls,
      targetRole: target?.getAttribute('role') ?? null,
      targetExists: !!target,
      popup: !!document.querySelector('[data-slot="select-content"]'),
    };
  });
  a.note(`bank filter select (open): ${JSON.stringify(opened)}`);
  await a.check('open select: aria-expanded=true + aria-controls resolves to the listbox', async () => {
    expect(opened.expanded).toBe('true');
    expect(opened.controls, 'aria-controls while open').toBeTruthy();
    expect(opened.targetExists, `aria-controls target #${opened.controls}`).toBe(true);
    expect(opened.popup).toBe(true);
  });
  // Base-UI sets aria-controls only while the popup is mounted (closed
  // triggers have none). Task-3 P3, out of scope (library behavior).
  await a.check('closed triggers: role + aria-expanded present (aria-controls is popup-only, library behavior)', async () => {
    const bad = before.filter((t) => t.role !== 'combobox' || t.expanded !== 'false');
    expect(bad.map((t) => t.label), 'closed triggers missing role/aria-expanded').toEqual([]);
    a.set('closedWithControls', before.filter((t) => t.controls).length);
    a.set('closedTotal', before.length);
  });
  await page.keyboard.press('Escape');
  await expect(triggers.first()).toHaveAttribute('aria-expanded', 'false');

  // ---- D4: desktop dropdowns close on Escape ----------------------------
  await page.goto('/', { waitUntil: 'networkidle', timeout: 60_000 });
  await expect(page.locator('h1')).toBeVisible({ timeout: 30_000 });
  for (const [btn, menu, label] of [
    ['#subjBtn', '#subjMenu', 'Môn học'],
    ['#explBtn', '#explMenu', 'Khám phá'],
  ] as const) {
    await page.locator(btn).click();
    await expect(page.locator(menu)).toBeVisible();
    await expect(page.locator(btn)).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(page.locator(menu)).toBeHidden();
    await expect(page.locator(btn)).toHaveAttribute('aria-expanded', 'false');
    await a.check(`Escape closes the desktop "${label}" dropdown`, async () => {
      const st = await page.evaluate(
        ([b, m]) => ({
          expanded: document.querySelector(b)?.getAttribute('aria-expanded'),
          hidden: document.querySelector(m)?.hasAttribute('hidden'),
        }),
        [btn, menu] as const,
      );
      expect(st.expanded).toBe('false');
      expect(st.hidden).toBe(true);
    });
  }

  // ---- D5: keyboard on the quiz -----------------------------------------
  // History exams are all-MCQ (short_answer is filtered out of the pool), so
  // the "1 selects option 1" assertion is deterministic here.
  await page.goto(QUIZ_KEYBOARD_URL, { waitUntil: 'networkidle', timeout: 60_000 });
  await expect(page.locator('#qRoot')).toBeVisible({ timeout: 30_000 });
  await page.locator('#qRoot').focus();
  await page.keyboard.press('1');
  await expect(page.locator('#qOpts .opt').first()).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#qCount')).toHaveText('Câu 2/10');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#qCount')).toHaveText('Câu 1/10');
  await a.check('keyboard: "1" selects option 1, ArrowRight/ArrowLeft navigate', async () => {
    expect(await page.locator('#qOpts .opt').first().getAttribute('aria-checked')).toBe('true');
  });

  // Palette reachable by Tab; Tab moves inside the grid; Enter navigates.
  // Start from the first option: the palette sits between the question card
  // and the nav buttons in DOM order.
  await page.locator('#qOpts .opt').first().focus();
  let tabs = 0;
  let reached = false;
  let palLabel = '';
  let palIndex = -1;
  for (let i = 0; i < 20 && !reached; i++) {
    await page.keyboard.press('Tab');
    tabs++;
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el?.closest('#qPal')) return null;
      const cells = Array.from(document.querySelectorAll('#qPal button'));
      return {
        label: el.getAttribute('aria-label') ?? '',
        index: cells.indexOf(el as HTMLElement),
      };
    });
    if (info) {
      reached = true;
      palIndex = info.index;
      palLabel = info.label;
    }
  }
  a.note(`palette reached after ${tabs} Tab press(es); focused cell #${palIndex} "${palLabel}"`);
  await a.check('palette buttons are reachable by Tab', async () => {
    expect(reached, `#qPal not reached within 20 Tab presses`).toBe(true);
    expect(palLabel).toMatch(/^Câu \d+/);
  });
  // Move two cells further, then Enter.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const target = await page.evaluate(() => {
    const el = document.activeElement;
    const cells = Array.from(document.querySelectorAll('#qPal button'));
    return {
      index: cells.indexOf(el as HTMLElement),
      label: el?.getAttribute('aria-label') ?? '',
      inPalette: !!el?.closest('#qPal'),
    };
  });
  await page.keyboard.press('Enter');
  const countText = await page.locator('#qCount').innerText();
  const expected = `Câu ${target.index + 1}/10`;
  a.note(`Enter on palette cell #${target.index} ("${target.label}") → ${countText}`);
  await a.check('Enter on a palette button navigates to that question', async () => {
    expect(target.inPalette, 'focus moved inside #qPal').toBe(true);
    expect(target.index, 'target palette cell').toBeGreaterThanOrEqual(0);
    expect(countText, `#qCount after Enter on cell #${target.index}`).toBe(expected);
  });
  a.save();
  a.gate();
});

// ============================================================ E. empty states

test('E. error / empty states', async ({ page }) => {
  test.setTimeout(300_000);
  const a = area('empty-states', page);
  await page.setViewportSize({ width: 1280, height: 800 });

  // ---- E1: /result cold -------------------------------------------------
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto('/result', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  let friendly = '';
  for (let i = 0; i < 25; i++) {
    friendly = await page.evaluate(() => document.body?.innerText ?? '');
    if (friendly.includes('Không có kết quả')) break;
    if (!page.url().endsWith('/result')) break;
    await page.waitForTimeout(100);
  }
  a.note(`cold /result body (first 160 chars): ${friendly.replace(/\s+/g, ' ').slice(0, 160)}`);
  await a.check('cold /result shows the friendly empty state (not a raw error)', async () => {
    expect(friendly).toContain('Không có kết quả');
    expect(friendly).not.toMatch(/Application error|Unhandled|Error:/);
  });
  const hits1 = await scanUnexpected(page);
  await a.check('cold /result renders no undefined/[object Object]/NaN', async () => {
    expect(hits1, JSON.stringify(hits1)).toEqual([]);
  });
  await expect(page).toHaveURL(/localhost:3000\/?(\?.*)?$/, { timeout: 20_000 });
  await a.check('cold /result redirects home instead of hanging', async () => {
    expect(page.url()).toMatch(/localhost:3000\/?(\?.*)?$/);
  });

  // ---- E2: /bank empty search ------------------------------------------
  await page.goto('/bank', { waitUntil: 'networkidle', timeout: 60_000 });
  await expect(page.locator('#bankList .bank-item').first()).toBeVisible({ timeout: 30_000 });
  await page.locator('input[aria-label="Tìm câu hỏi"]').fill('zzzzz');
  const emptyPanel = page.locator('.panel', {
    hasText: 'Không tìm thấy câu hỏi nào. Hãy thử nới lỏng bộ lọc.',
  });
  await expect(emptyPanel).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#bankList')).toHaveCount(0);
  await expect(page.locator('nav.pager')).toHaveCount(0);
  const bankText = await page.locator('body').innerText();
  await a.check('empty search "zzzzz" shows the unfiltered-state panel', async () => {
    expect(bankText).toContain('Không tìm thấy câu hỏi nào. Hãy thử nới lỏng bộ lọc.');
  });
  const hits2 = await scanUnexpected(page);
  await a.check('/bank empty state renders no undefined/[object Object]/NaN', async () => {
    expect(hits2, JSON.stringify(hits2)).toEqual([]);
  });

  // ---- E3: /history/theory/99 ------------------------------------------
  await page.goto('/history/theory/99', { waitUntil: 'networkidle', timeout: 60_000 });
  const theoryText = await page.locator('body').innerText();
  await a.check('/history/theory/99 renders the 404 page (F-B8a: no soft-200 panel)', async () => {
    // F-B8a replaced the "Chưa có lý thuyết" soft-200 panel with notFound(),
    // so the route now renders the standard 404 UI.
    expect(
      theoryText.includes('404') ||
        theoryText.includes('could not be found') ||
        theoryText.includes('Không tìm thấy'),
      `theory/99 body: ${theoryText.slice(0, 160)}`,
    ).toBe(true);
    expect(theoryText).not.toMatch(/Application error|Unhandled Runtime|Error:/);
  });
  const hits3 = await scanUnexpected(page);
  await a.check('/history/theory/99 renders no undefined/[object Object]/NaN', async () => {
    expect(hits3, JSON.stringify(hits3)).toEqual([]);
  });

  // ---- E4: unknown route is a safe 404 page -----------------------------
  await page.goto('/xyz', { waitUntil: 'networkidle', timeout: 60_000 });
  const notFoundText = await page.locator('body').innerText();
  await a.check('/xyz renders the 404 page, not a raw error', async () => {
    expect(notFoundText).toMatch(/404|Không tìm thấy/);
    expect(notFoundText).not.toMatch(/Application error|Unhandled Runtime/);
  });
  a.save();
  a.gate();
});


// ============================================================ F. home cards

/**
 * F. Home-page card chrome (regression for the 2026-10-09 UI pass):
 *   - the subject card's progress bar must render at real width (it used to
 *     collapse to 0px inside the `justify-items:start` grid, so "Tiến độ X%"
 *     had no bar above it),
 *   - the lesson card must print the same "Tiến độ X%" caption below its bar,
 *   - the lesson card's subject badge must fit its text instead of stretching
 *     to the card width (flex column `align-items: stretch`).
 */
test('F. home cards: progress bars render, captions match the fill, badges fit', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const a = area('home-cards', page);
  await page.setViewportSize({ width: 1280, height: 800 });

  // One lesson's progress (5%) so the fill and the caption carry real values.
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'ontap12-v1',
      JSON.stringify({ prog: { history: { 1: 5 } } }),
    );
  });
  await page.goto('/', { waitUntil: 'networkidle', timeout: 60_000 });
  await expect(page.locator('#subjectCards .pbar').first()).toBeVisible();
  await expect(page.locator('#lessonCards .pbar').first()).toBeVisible();

  // ---- F1: subject-card bar is actually painted -------------------------
  await a.check('subject-card progress bar renders at real width', async () => {
    const w = await page
      .locator('#subjectCards .pbar')
      .first()
      .evaluate((el) => (el as HTMLElement).offsetWidth);
    expect(w, 'subject card .pbar width').toBeGreaterThan(100);
  });

  // ---- F2: lesson card caption + fill agree -----------------------------
  const historyCard = page
    .locator('#lessonCards > div')
    .filter({ has: page.locator('a[href="/history/theory/1"]') })
    .first();
  await expect(historyCard).toBeVisible();
  await a.check('lesson card prints "Tiến độ 5%" below its bar', async () => {
    await expect(historyCard.locator('p.small.muted')).toHaveText('Tiến độ 5%');
  });
  await a.check('lesson-card bar fill matches the seeded 5%', async () => {
    const { barW, fillW } = await historyCard
      .locator('.pbar')
      .evaluate((el) => {
        const i = el.querySelector('i') as HTMLElement | null;
        return { barW: (el as HTMLElement).offsetWidth, fillW: i?.offsetWidth ?? -1 };
      });
    expect(barW).toBeGreaterThan(100);
    expect(fillW / barW).toBeCloseTo(0.05, 1);
  });

  // ---- F3: lesson-card badge fits its text ------------------------------
  await a.check('lesson-card subject badge fits its content', async () => {
    const { badgeW, cardW } = await historyCard.evaluate((el) => {
      const b = el.querySelector('span.badge') as HTMLElement;
      return { badgeW: b.offsetWidth, cardW: (el as HTMLElement).offsetWidth };
    });
    expect(badgeW, 'badge width').toBeLessThan(cardW / 2);
    a.set('lessonBadgeWidth', badgeW);
    a.set('lessonCardWidth', cardW);
  });

  a.save();
  a.gate();
});

// ============================================================ G. subject cfg

/**
 * G. Subject page config panel (regression for the 2026-10-09 UI pass):
 * the `.cfg-grid` used to squeeze each "chọn nhiều" group into ONE narrow
 * column, because `label:nth-child(5)` matched the nested .chk-grid labels
 * (flex items) instead of the group itself — so the intended `span 2` never
 * applied, chips laid out ragged, and the two shuffle toggles landed in
 * different rows. Fix: `.cfg-grid>.cfg-group{grid-column:1/-1}` (direct
 * child) + `.cfg-group{margin:0}` + the three selects moved into one row.
 *
 * Invariants pinned here: one aligned row of three selects, both checkbox
 * groups full-width on their own rows, the two toggles sharing a row.
 */
test('G. subject config panel: one select row, full-width checkbox groups', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const a = area('subject-cfg', page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/english', { waitUntil: 'networkidle', timeout: 60_000 });
  await expect(page.locator('.cfg-grid')).toBeVisible();

  const grid = page.locator('.cfg-grid');
  const selects = grid
    .locator('> label')
    .filter({ has: page.locator('[data-slot=select-trigger]') });

  await a.check('three selects share one row, same size', async () => {
    expect(await selects.count()).toBe(3);
    const boxes = await selects.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
      }),
    );
    expect(new Set(boxes.map((b) => b.top)).size).toBe(1);
    expect(new Set(boxes.map((b) => b.w)).size).toBe(1);
    expect(new Set(boxes.map((b) => b.h)).size).toBe(1);
  });

  await a.check('both checkbox groups are full width, one per row', async () => {
    const groups = grid.locator('> .cfg-group');
    expect(await groups.count()).toBe(2);
    const rows = await groups.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top), w: Math.round(r.width) };
      }),
    );
    expect(new Set(rows.map((r) => r.top)).size).toBe(2);
    const gridW = await grid.evaluate((el) => (el as HTMLElement).offsetWidth);
    for (const r of rows) expect(Math.abs(r.w - gridW)).toBeLessThanOrEqual(1);
    a.set('groupWidths', rows.map((r) => r.w));
    a.set('gridWidth', gridW);
  });

  await a.check('the two shuffle toggles share one row', async () => {
    const toggles = grid.locator('> label.chk');
    expect(await toggles.count()).toBe(2);
    const tops = await toggles.evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().top)),
    );
    expect(tops[0]).toBe(tops[1]);
  });

  await a.check('no horizontal overflow on the subject page', async () => {
    const over = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(over).toBeLessThanOrEqual(0);
  });

  a.save();
  a.gate();
});
