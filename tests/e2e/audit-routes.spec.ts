/**
 * tests/e2e/audit-routes.spec.ts — Task 1 baseline route sweep (audit).
 *
 * Read-only audit of every route: collects console errors, pageerrors,
 * failed requests, >=400 responses, and unexpected rendered text
 * (`undefined`, `[object Object]`, `NaN`). Writes one JSON per route to
 * .superpowers/sdd/2026-10-09-full-product-audit/audit-data/ for the report.
 * Screenshots (visual defects only) go to .../screenshots/.
 *
 * Expected/ignored findings (per task brief, documented not failed):
 * - 404 document response for the invalid-route tests (/xyz, /history/theory/99)
 * - 401 from /api/auth or /api/progress while signed out (whole sweep is signed out)
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

// qtype=multiple_choice keeps these history exams MCQ-only: the SA port put
// short_answer rows into every pool, and the /result flow hard-clicks `.opt`.
const QUIZ_URL =
  '/quiz?subject=history&lesson=all&count=10&time=10&level=all&qtype=multiple_choice&practice=false&shQ=true&shA=true&quick=true';

interface ConsoleErr {
  text: string;
  url: string;
  line?: number;
}
interface ReqFail {
  url: string;
  error: string;
}
interface BadResp {
  url: string;
  status: number;
  expected: boolean;
}
interface UnexpectedText {
  text: string;
  ctx: string;
  snippet: string;
}

interface AuditData {
  route: string;
  finalUrl: string;
  status: number | null;
  consoleErrors: ConsoleErr[];
  pageErrors: string[];
  requestFailed: ReqFail[];
  badResponses: BadResp[];
  unexpectedText: UnexpectedText[];
  overflow: { scrollWidth: number; clientWidth: number; failing: boolean } | null;
  screenshots: string[];
  notes: string[];
}

interface Collector {
  consoleErrors: ConsoleErr[];
  pageErrors: string[];
  requestFailed: ReqFail[];
  badResponses: { url: string; status: number }[];
}

function attach(page: Page): Collector {
  const c: Collector = {
    consoleErrors: [],
    pageErrors: [],
    requestFailed: [],
    badResponses: [],
  };
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const loc = msg.location();
      c.consoleErrors.push({
        text: msg.text().slice(0, 400),
        url: (loc.url || '').slice(0, 200),
        line: loc.lineNumber,
      });
    }
  });
  page.on('pageerror', (err) => {
    c.pageErrors.push(String((err as Error)?.message ?? err).slice(0, 400));
  });
  page.on('requestfailed', (req) => {
    c.requestFailed.push({
      url: req.url().slice(0, 300),
      error: req.failure()?.errorText ?? 'unknown',
    });
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      c.badResponses.push({ url: res.url().slice(0, 300), status: res.status() });
    }
  });
  return c;
}

/** Flag >=400 responses the brief says to expect (documented, not findings). */
function markExpected(
  bad: { url: string; status: number }[],
  opts: { routePath?: string; allow404Doc: boolean },
): BadResp[] {
  return bad.map((b) => {
    const is401AuthApi =
      b.status === 401 && /\/api\/(auth|progress)([/?#]|$)/.test(b.url);
    const is404Doc =
      opts.allow404Doc &&
      b.status === 404 &&
      new URL(b.url).pathname === opts.routePath;
    return { ...b, expected: is401AuthApi || is404Doc };
  });
}

/** Scan rendered text nodes for `undefined` / `[object Object]` / `NaN`. */
async function scanUnexpected(page: Page): Promise<UnexpectedText[]> {
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
    const out: { text: string; ctx: string; snippet: string }[] = [];
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
      // selector-ish context: up to 4 ancestor hops
      const parts: string[] = [];
      let e: HTMLElement | null = el;
      for (let d = 0; e && e !== document.body && d < 4; d++) {
        let s = e.tagName.toLowerCase();
        if (e.id) s += '#' + e.id;
        else if (
          typeof e.className === 'string' &&
          e.className.trim()
        ) {
          s += '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.');
        }
        parts.unshift(s);
        e = e.parentElement;
      }
      const ctx = parts.join(' > ');
      const key = m[0] + '@' + ctx;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ text: m[0], ctx, snippet: t.trim().slice(0, 120) });
    }
    return out.slice(0, 20);
  });
}

async function shot(page: Page, name: string, data: AuditData) {
  const p = join(SHOT_DIR, `${name}.png`);
  await page.screenshot({ path: p, fullPage: true }).catch(() => {});
  data.screenshots.push(p);
}

/** Save a text evidence file (raw response body excerpt, etc). */
async function evidence(name: string, text: string, data: AuditData) {
  const p = join(SHOT_DIR, `${name}.txt`);
  writeFileSync(p, text.slice(0, 20000));
  data.screenshots.push(p);
}

interface AuditOpts {
  /** Allow the main document itself to 404 (invalid-route tests). */
  allow404Doc?: boolean;
  /** Extra settle wait after goto (default 800ms). */
  settleMs?: number;
  /** Wait for a client-side redirect to finish before scanning. */
  waitForUrl?: RegExp;
  /** Extra checks run after scan; can push notes / take screenshots. */
  extra?: (page: Page, data: AuditData) => Promise<void>;
}

async function audit(
  page: Page,
  id: string,
  route: string,
  opts: AuditOpts = {},
): Promise<AuditData> {
  await page.setViewportSize({ width: 1280, height: 800 });
  const c = attach(page);
  const resp = await page.goto(route, {
    waitUntil: 'networkidle',
    timeout: 45_000,
  });
  await page.waitForTimeout(opts.settleMs ?? 800);
  if (opts.waitForUrl) {
    await expect(page).toHaveURL(opts.waitForUrl, { timeout: 15_000 });
    await page.waitForTimeout(800);
  }
  const unexpected = await scanUnexpected(page);
  const data: AuditData = {
    route,
    finalUrl: page.url(),
    status: resp?.status() ?? null,
    consoleErrors: c.consoleErrors,
    pageErrors: c.pageErrors,
    requestFailed: c.requestFailed,
    badResponses: markExpected(c.badResponses, {
      routePath: route.split('?')[0],
      allow404Doc: opts.allow404Doc ?? false,
    }),
    unexpectedText: unexpected,
    overflow: null,
    screenshots: [],
    notes: [],
  };
  if (opts.extra) {
    try {
      await opts.extra(page, data);
    } catch (e) {
      // data must survive a failing expectation so the report can cite it
      writeFileSync(join(DATA_DIR, `${id}.json`), JSON.stringify(data, null, 2));
      throw e;
    }
  }
  writeFileSync(join(DATA_DIR, `${id}.json`), JSON.stringify(data, null, 2));
  return data;
}

/** 1280x800 baseline: no document-level horizontal overflow. */
async function checkOverflow(page: Page, data: AuditData) {
  const dims = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  const failing = dims.sw > dims.cw + 1;
  data.overflow = { scrollWidth: dims.sw, clientWidth: dims.cw, failing };
  if (failing) {
    data.notes.push(
      `horizontal overflow @1280: scrollWidth=${dims.sw} clientWidth=${dims.cw}`,
    );
    await shot(page, `overflow-${data.route.replace(/[^a-z0-9]+/gi, '-')}`, data);
  }
}

// ---------------------------------------------------------------- sweep

const ROUTES: { id: string; route: string }[] = [
  { id: 'home', route: '/' },
  { id: 'history', route: '/history' },
  { id: 'biology', route: '/biology' },
  { id: 'chemistry', route: '/chemistry' },
  { id: 'english', route: '/english' },
  { id: 'theory-history-1', route: '/history/theory/1' },
  { id: 'theory-chemistry-2', route: '/chemistry/theory/2' },
  { id: 'theory-english-2', route: '/english/theory/2' },
  { id: 'bank', route: '/bank' },
  { id: 'notebook', route: '/notebook' },
  { id: 'vocab', route: '/vocab' },
  { id: 'progress', route: '/progress' },
  { id: 'ai-generate', route: '/ai/generate' },
  { id: 'login', route: '/login' },
];

for (const { id, route } of ROUTES) {
  test(`audit: ${route}`, async ({ page }) => {
    const overflow = route === '/' || route === '/bank';
    await audit(page, id, route, {
      extra: overflow
        ? async (p, data) => {
            await checkOverflow(p, data);
            expect(
              data.overflow?.failing,
              `overflow @1280 on ${route}: sw=${data.overflow?.scrollWidth} cw=${data.overflow?.clientWidth}`,
            ).toBe(false);
          }
        : undefined,
    });
  });
}

test('audit: /quiz (full param url)', async ({ page }) => {
  await audit(page, 'quiz', QUIZ_URL, {
    extra: async (p, data) => {
      const started = await p
        .locator('#qRoot')
        .or(p.locator('text=Không có câu hỏi nào'))
        .first()
        .isVisible({ timeout: 15_000 });
      if (!started) data.notes.push('quiz UI never rendered (#qRoot not visible)');
      expect(started).toBe(true);
    },
  });
});

test('audit: /quick (server redirect to quiz)', async ({ page }) => {
  const data = await audit(page, 'quick', '/quick');
  expect(data.finalUrl).toMatch(/\/quiz\?subject=/);
});

test('audit: /result (fresh context, empty state)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const c = attach(page);
  const resp = await page.goto('/result', {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });
  // The empty-state message is SSR'd; read it before the client redirect fires.
  let transientSeen = false;
  for (let i = 0; i < 10; i++) {
    const t = await page
      .evaluate(() => document.body?.innerText ?? '')
      .catch(() => '');
    if (t.includes('Không có kết quả')) {
      transientSeen = true;
      break;
    }
    if (!page.url().endsWith('/result')) break; // redirect already happened
    await page.waitForTimeout(200);
  }
  await expect(page).toHaveURL(/localhost:3000\/?(\?.*)?$/, { timeout: 15_000 });
  await page.waitForTimeout(800);
  const unexpected = await scanUnexpected(page);
  const data: AuditData = {
    route: '/result',
    finalUrl: page.url(),
    status: resp?.status() ?? null,
    consoleErrors: c.consoleErrors,
    pageErrors: c.pageErrors,
    requestFailed: c.requestFailed,
    badResponses: markExpected(c.badResponses, { allow404Doc: false }),
    unexpectedText: unexpected,
    overflow: null,
    screenshots: [],
    notes: [
      `transient empty-state message "Không có kết quả. Đang chuyển hướng…" observed: ${transientSeen}`,
      'empty state client-redirects to / (expected behavior)',
    ],
  };
  writeFileSync(
    join(DATA_DIR, 'result-fresh.json'),
    JSON.stringify(data, null, 2),
  );
});

test('audit: /result after completing a quiz', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const c = attach(page);
  const resp = await page.goto(QUIZ_URL, {
    waitUntil: 'networkidle',
    timeout: 45_000,
  });
  const opt = page.locator('#qOpts .opt').first();
  await expect(opt).toBeVisible({ timeout: 20_000 });
  await opt.click();
  await page.locator('#qNext').click();
  await expect(page.locator('#qCount')).toContainText('Câu 2/');
  await page.locator('#qOpts .opt').first().click();
  await page.locator('#qSubmit').click();
  await expect(page).toHaveURL(/\/result/, { timeout: 15_000 });
  await expect(page.locator('#rPoint')).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1_200); // let result renderers/finishers settle
  const unexpected = await scanUnexpected(page);
  const data: AuditData = {
    route: '/result (after quiz)',
    finalUrl: page.url(),
    status: resp?.status() ?? null,
    consoleErrors: c.consoleErrors,
    pageErrors: c.pageErrors,
    requestFailed: c.requestFailed,
    badResponses: markExpected(c.badResponses, { allow404Doc: false }),
    unexpectedText: unexpected,
    overflow: null,
    screenshots: [],
    notes: [],
  };
  writeFileSync(
    join(DATA_DIR, 'result-after-quiz.json'),
    JSON.stringify(data, null, 2),
  );
});

// ------------------------------------------------------- invalid / edge

/**
 * RESOLVED (was a parked P3): unknown single-segment routes now return a REAL
 * 404 status. The old root `app/loading.tsx` streamed its shell for every
 * route and committed HTTP 200 before `notFound()` could act; the boundary is
 * gone (the home page keeps its skeleton via an in-page <Suspense> instead),
 * so /xyz renders the 404 UI with the 404 status. This test pins BOTH.
 */
test('audit: /xyz renders the 404 page with a real 404 status', async ({ page }) => {
  const data = await audit(page, 'invalid-xyz', '/xyz', {
    allow404Doc: true,
    extra: async (p, d) => {
      d.notes.push(
        `404 page text visible: ${await p
          .locator('body')
          .innerText()
          .then((t) => t.slice(0, 200))
          .catch(() => '<unreadable>')}`,
      );
    },
  });
  // Content contract: the real Next 404 UI, not a crash or a silent render.
  const body = await page.locator('body').innerText();
  expect(
    body.includes('404') ||
      body.includes('could not be found') ||
      body.includes('Không tìm thấy'),
    `/xyz should render the 404 page; body: ${body.slice(0, 160)}`,
  ).toBe(true);
  expect(data.status, 'soft-404 fixed: status must be 404 now').toBe(404);
  // No answer/question data leaks through the 404 body.
  expect(body).not.toMatch(/correctAnswer|correct_answer/);
});

test('audit: /history/theory/99 — 404 UI + 404 status (F-B8a + soft-404 fix)', async ({ page }) => {
  const data = await audit(page, 'theory-99', '/history/theory/99', {
    allow404Doc: true,
  });
  expect(data.status, 'soft-404 fixed: status must be 404 now').toBe(404);
  // F-B8a replaced the "Chưa có lý thuyết" soft-200 panel with notFound(),
  // and the boundary removal lets the status commit as a real 404.
  const body = await page
    .locator('body')
    .innerText({ timeout: 5_000 })
    .catch(() => '');
  const safe =
    data.status === 404 ||
    body.includes('404') ||
    body.includes('could not be found') ||
    body.includes('Không tìm thấy');
  if (!safe) data.notes.push(`theory/99 rendered unexpected body: ${body.slice(0, 200)}`);
  expect(safe).toBe(true);
});

test('audit: /quiz?subject=bogus must not crash', async ({ page }) => {
  const data = await audit(page, 'quiz-bogus-subject', '/quiz?subject=bogus');
  expect(data.status).toBe(200);
  expect(
    data.pageErrors.length,
    `pageerrors on bogus subject: ${JSON.stringify(data.pageErrors)}`,
  ).toBe(0);
  const body = await page
    .locator('body')
    .innerText({ timeout: 5_000 })
    .catch(() => '');
  expect(body.includes('Không có câu hỏi') || body.includes('#') || body.length > 10).toBe(true);
});

test('audit: /quiz negative count/time must not crash', async ({ page }) => {
  const data = await audit(
    page,
    'quiz-negative-params',
    '/quiz?subject=history&count=-5&time=-5',
    {
      extra: async (p, d) => {
        // Brief: must not crash. Record what actually happens for the report.
        if (p.url().includes('/result')) {
          // F-B3 regression recorder: the quiz page clamps count (1–100)
          // and time (1–180) via lib/quiz/pool clampInt, so a negative
          // param now just starts a minimum-size quiz — it can no longer
          // auto-submit to /result. Landing here means the clamp regressed.
          d.notes.push(
            'REGRESSION: negative params reached /result — the count/time clamp (F-B3) no longer holds',
          );
          const bodyText = await p
            .locator('body')
            .innerText({ timeout: 5_000 })
            .catch(() => '');
          d.notes.push(
            `/result body: ${bodyText.replace(/\s+/g, ' ').slice(0, 250)}`,
          );
          await shot(p, 'quiz-negative-params-result', d);
        }
      },
    },
  );
  expect(data.status).toBe(200);
  expect(
    data.pageErrors.length,
    `pageerrors on negative params: ${JSON.stringify(data.pageErrors)}`,
  ).toBe(0);
});

test('audit: /admin signed out — no admin UI leak', async ({ page }) => {
  const data = await audit(page, 'admin-signedout', '/admin', {
    waitForUrl: /localhost:3000\/?(\?.*)?$/,
    extra: async (p, d) => {
      // The browser DOM check is not enough: the RSC flight payload can carry
      // the admin tree even though a meta-refresh redirects before paint.
      // Probe the raw unauthenticated response body.
      const raw = await p.request.get('/admin');
      const body = await raw.text();
      d.notes.push(`raw /admin status: ${raw.status()}, body bytes: ${body.length}`);
      const leaked =
        body.includes('Admin Panel') ||
        body.includes('Total questions') ||
        body.includes('/admin/questions');
      if (leaked) {
        d.notes.push('admin dashboard RSC tree present in raw response body');
        await evidence('admin-raw-body', body, d);
        await shot(p, 'admin-leak', d);
      }
      expect(
        leaked,
        'signed-out /admin raw body must not contain admin UI data',
      ).toBe(false);
    },
  });
  // safe outcome: redirected home (or to a login page)
  const safeRedirect =
    /localhost:3000\/?(\?.*)?$/.test(data.finalUrl) || /\/login/.test(data.finalUrl);
  if (!safeRedirect) data.notes.push(`unexpected final url: ${data.finalUrl}`);
  expect(safeRedirect).toBe(true);
});

test('audit: /admin/questions/[id]/edit signed out — no answer-key leak', async ({ page }) => {
  // Same guard (admin/layout.tsx) protects the edit page. The page fetches the
  // full question incl. correctAnswer — if the layout redirect loses the race
  // against the streaming shell, the answer key ships to anonymous users.
  const raw = await page.request.get('/admin/questions/bio1-01/edit');
  const body = await raw.text();
  const data: AuditData = {
    route: '/admin/questions/bio1-01/edit',
    finalUrl: 'raw request (no navigation)',
    status: raw.status(),
    consoleErrors: [],
    pageErrors: [],
    requestFailed: [],
    badResponses: [],
    unexpectedText: [],
    overflow: null,
    screenshots: [],
    notes: [`raw body bytes: ${body.length}`],
  };
  const leaked =
    body.includes('correctAnswer') || body.includes('Sửa câu hỏi') || body.includes('options');
  if (leaked) {
    data.notes.push('FULL QUESTION + ANSWER KEY present in unauthenticated raw body');
    await evidence('admin-edit-raw-body', body, data);
  }
  writeFileSync(
    join(DATA_DIR, 'admin-edit-signedout.json'),
    JSON.stringify(data, null, 2),
  );
  expect(
    leaked,
    'signed-out edit page raw body must not contain the question/answer key',
  ).toBe(false);
});
