/**
 * tests/e2e/audit-flows.spec.ts — Task 2 functional-flows audit (deep flows).
 *
 * Exercises the 10 flows from .superpowers/sdd/2026-10-09-full-product-audit/
 * task-2-brief.md with real clicks + expect() assertions, anonymous fresh
 * contexts only (no Google sign-in; auth-dependent behavior is out of scope).
 *
 * Instrumentation (same as task 1): per-flow JSON with console errors,
 * pageerrors, failed requests, >=400 responses + pass/fail per assertion to
 * .superpowers/sdd/2026-10-09-full-product-audit/audit-data/flow-*.json.
 * Screenshots (visual defects / failed checks) go to .../screenshots/.
 *
 * Known/expected noise (documented, not findings):
 * - dev-mode pageerror `… cannot have a negative time stamp` (performance.measure
 *   on early-aborted renders: /quick redirect etc.)
 * - net::ERR_ABORTED on ?_rsc= fetches cancelled by client-side navigation
 * - 401 from /api/auth|/api/progress while signed out (none anticipated — the
 *   quiz flow is fully client-side)
 *
 * Flow 2 waits out a real 60s exam timer; the only bounded wait is the single
 * toHaveURL(/\/result/, {timeout: 90s}) for that auto-submit (per brief).
 * No arbitrary sleeps anywhere.
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

// ---------------------------------------------------------------- shared

const PRACTICE_URL =
  '/quiz?subject=history&lesson=all&count=5&time=10&level=all&qtype=all&practice=true&shQ=true&shA=true';
const TIMED_URL =
  '/quiz?subject=chemistry&lesson=all&count=10&time=1&level=all&qtype=all&practice=false&shQ=true&shA=true';

interface ConsoleErr { text: string; url: string }
interface ReqFail { url: string; error: string }
interface BadResp { url: string; status: number; expected: boolean }
interface Check { name: string; pass: boolean; detail?: string }

interface SessionEvents {
  consoleErrors: ConsoleErr[];
  pageErrors: string[];
  pageErrorsExpected: string[];
  requestFailed: ReqFail[];
  requestFailedExpected: ReqFail[];
  badResponses: BadResp[];
}

const DEV_NOISE_PAGEERROR = /cannot have a negative time stamp/;
const benignReqFail = (u: string, e: string) =>
  /net::ERR_ABORTED/.test(e) && u.includes('_rsc=');

/** Attach the task-1 instrumentation to a page; returns live event arrays. */
function session(page: Page): SessionEvents {
  const ev: SessionEvents = {
    consoleErrors: [],
    pageErrors: [],
    pageErrorsExpected: [],
    requestFailed: [],
    requestFailedExpected: [],
    badResponses: [],
  };
  page.on('console', (m) => {
    if (m.type() === 'error') {
      ev.consoleErrors.push({
        text: m.text().slice(0, 300),
        url: (m.location().url || '').slice(0, 200),
      });
    }
  });
  page.on('pageerror', (err) => {
    const s = String((err as Error)?.message ?? err).slice(0, 400);
    const where = `[at ${page.url().slice(0, 120)}] `;
    (DEV_NOISE_PAGEERROR.test(s) ? ev.pageErrorsExpected : ev.pageErrors).push(
      where + s,
    );
  });
  page.on('requestfailed', (r) => {
    const f = {
      url: r.url().slice(0, 300),
      error: r.failure()?.errorText ?? 'unknown',
    };
    (benignReqFail(f.url, f.error)
      ? ev.requestFailedExpected
      : ev.requestFailed
    ).push(f);
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      ev.badResponses.push({
        url: res.url().slice(0, 300),
        status: res.status(),
        expected: res.status() === 401 && /\/api\/(auth|progress)/.test(res.url()),
      });
    }
  });
  return ev;
}

interface FlowRec extends SessionEvents {
  flow: string;
  url: string;
  checks: Check[];
  notes: string[];
  screenshots: string[];
}

function flow(page: Page, id: string, ev?: SessionEvents) {
  const e = ev ?? session(page);
  const rec: FlowRec = {
    ...e,
    flow: id,
    url: '',
    checks: [],
    notes: [],
    screenshots: [],
  };
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
  return {
    rec,
    /** Run one audit assertion; record pass/fail and continue on failure. */
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
            .slice(0, 10)
            .join(' ⏎ ')
            .slice(0, 900),
        });
        const p = join(SHOT_DIR, `fail-${id}-${slug(name)}.png`);
        await page.screenshot({ path: p, fullPage: true }).catch(() => {});
        rec.screenshots.push(p);
      }
    },
    async save() {
      rec.url = page.url();
      writeFileSync(join(DATA_DIR, `flow-${id}.json`), JSON.stringify(rec, null, 2));
    },
  };
}

/** Fail the test if any recorded check failed (Playwright expectation gate). */
function gate(rec: FlowRec) {
  const failed = rec.checks.filter((c) => !c.pass);
  expect(
    failed.map((f) => `${f.name}${f.detail ? ` — ${f.detail.slice(0, 200)}` : ''}`),
    `flow ${rec.flow}: ${failed.length} failed check(s)`,
  ).toEqual([]);
}

/** Scan rendered text for `undefined` / `[object Object]` / `NaN`. */
async function scanUnexpected(page: Page) {
  return page.evaluate(() => {
    const rx = /\bundefined\b|\[object Object\]|\bNaN\b/;
    const skip = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA', 'NOSCRIPT']);
    const out: { text: string; snippet: string }[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const t = node.textContent ?? '';
      if (!rx.test(t)) continue;
      let p: HTMLElement | null = node.parentElement;
      let skipped = false;
      while (p && p !== document.body) {
        if (skip.has(p.tagName.toUpperCase())) { skipped = true; break; }
        p = p.parentElement;
      }
      if (!skipped) out.push({ text: t.trim().slice(0, 120), snippet: t.trim().slice(0, 120) });
    }
    return out.slice(0, 20);
  });
}

/** Per-flow hygiene gate: no unexpected console/page/network noise. */
async function cleanCheck(page: Page, f: ReturnType<typeof flow>) {
  await f.check('no unexpected text (undefined/[object Object]/NaN)', async () => {
    const hits = await scanUnexpected(page);
    expect(hits).toEqual([]);
  });
  await f.check('no unexpected console errors / pageerrors / failed requests', async () => {
    expect(
      f.rec.consoleErrors,
      `console errors: ${JSON.stringify(f.rec.consoleErrors)}`,
    ).toEqual([]);
    expect(
      f.rec.pageErrors,
      `pageerrors: ${JSON.stringify(f.rec.pageErrors)}`,
    ).toEqual([]);
    expect(
      f.rec.requestFailed,
      `failed requests: ${JSON.stringify(f.rec.requestFailed)}`,
    ).toEqual([]);
    const bad = f.rec.badResponses.filter((b) => !b.expected);
    expect(bad, `unexpected >=400: ${JSON.stringify(bad)}`).toEqual([]);
  });
}

/** Pick an option in a Base UI <Select> by trigger aria-label + exact option text. */
async function pickSelect(page: Page, triggerLabel: string, option: string) {
  const trigger = page
    .locator(`[data-slot="select-trigger"][aria-label="${triggerLabel}"]`)
    .first();
  await trigger.click({ timeout: 10_000 });
  const item = page
    .locator('[data-slot="select-item"]')
    .filter({ has: page.getByText(option, { exact: true }) })
    .first();
  await item.click({ timeout: 10_000 });
}

/** Kind of the currently rendered question, probed from the DOM. */
async function currentKind(page: Page): Promise<'mcq' | 'tf' | 'sa'> {
  if (await page.locator('#qOpts #saIn').isVisible().catch(() => false)) return 'sa';
  if (await page.locator('#qOpts .tf-row').first().isVisible().catch(() => false)) return 'tf';
  return 'mcq';
}

/** Answer the current quiz question (MCQ → option A; TF → first statement Đúng; SA → typed text). */
async function answerCurrent(page: Page): Promise<'mcq' | 'tf' | 'sa'> {
  const kind = await currentKind(page);
  if (kind === 'mcq') {
    const mcq = page.locator('#qOpts .opt').first();
    await mcq.click();
    await expect(mcq).toHaveAttribute('aria-checked', 'true', { timeout: 5_000 });
    return 'mcq';
  }
  if (kind === 'sa') {
    const inp = page.locator('#qOpts #saIn');
    await inp.fill('1'); // maxLen can truncate longer strings; 1 char always fits
    await expect(inp).toHaveValue('1', { timeout: 5_000 });
    return 'sa';
  }
  const tf = page.locator('#qOpts .tf-row button[aria-label="Đúng"]').first();
  await tf.click();
  await expect(tf).toHaveClass(/btn-primary/, { timeout: 5_000 });
  return 'tf';
}

/** Assert the current palette cell is gold-flagged (waits out the .18s transition). */
async function expectPaletteGold(page: Page, index: number) {
  const btn = page.locator('#qPal button').nth(index);
  await expect(btn).toHaveClass(/flag/);
  await expect
    .poll(
      async () => btn.evaluate((el) => getComputedStyle(el).backgroundColor),
      { timeout: 3_000 },
    )
    .toBe('rgb(255, 215, 0)');
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------- flow 1

test('flow1: practice-mode mechanics → submit → result', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const f = flow(page, '1-practice');
  await page.goto(PRACTICE_URL, { waitUntil: 'networkidle', timeout: 45_000 });

  await f.check('quiz renders (Luyện tập · Lịch sử 12 · Tổng hợp, Câu 1/5, timer 10:00)', async () => {
    await expect(page.locator('#qRoot')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#qCount')).toHaveText('Câu 1/5');
    await expect(page.locator('#qTitle')).toContainText('Luyện tập · Lịch sử 12 · Tổng hợp');
    // 10-minute clock; the first tick may already have fired by assertion time
    await expect(page.locator('.timer time')).toHaveText(/^(10:00|09:5\d)$/);
  });

  await f.check('selecting highlights the picked option (click option A on Q1)', async () => {
    const kind = await answerCurrent(page);
    if (kind === 'mcq') {
      const optA = page.locator('#qOpts .opt').first();
      await expect(optA).toHaveClass(/(?:^|\s)sel(?:\s|$)/);
      await expect(optA).toHaveAttribute('aria-checked', 'true');
    } else {
      await expect(page.locator('#qOpts #saIn')).toHaveValue('1');
      await expect(page.locator('#qPal button').first()).toHaveClass(/done/);
    }
  });

  await f.check('practice feedback: ✓/✗ marks + "Giải thích" after answering', async () => {
    const kind = await currentKind(page);
    if (kind === 'mcq') {
      const opts = page.locator('#qOpts .opt');
      const checkCount = await opts.filter({ hasText: '✓' }).count();
      expect(checkCount, 'exactly one ✓ (the correct option) shown in practice').toBe(1);
      await expect(page.locator('#qOpts .rev.exp')).toBeVisible();
      await expect(page.locator('#qOpts .rev.exp')).toContainText('Giải thích:');
      const selText = await page.locator('#qOpts .opt.sel').first().innerText();
      f.rec.notes.push(
        `Q1 option A was ${selText.includes('✓') ? 'CORRECT (✓)' : 'wrong (✗ shown)'}`,
      );
    } else {
      // SA: post-answer ok/bad coloring + explanation, never the answer key.
      await expect(page.locator('#qOpts .rev.exp')).toBeVisible();
      await expect(page.locator('#qOpts .rev.exp')).toContainText('Giải thích:');
      const answered = await page.locator('#qOpts #saIn').inputValue();
      expect(answered.length, 'SA answered before feedback').toBeGreaterThan(0);
      await expect(page.locator('#qOpts #saIn')).toHaveClass(/practice-ok|practice-bad/);
      f.rec.notes.push('Q1 is a short_answer row — practice coloring shown post-answer');
    }
  });

  await f.check('next/prev buttons navigate (Câu 1↔2)', async () => {
    await page.locator('#qNext').click();
    await expect(page.locator('#qCount')).toHaveText('Câu 2/5');
    await page.locator('#qPrev').click();
    await expect(page.locator('#qCount')).toHaveText('Câu 1/5');
    await page.locator('#qNext').click();
    await expect(page.locator('#qCount')).toHaveText('Câu 2/5');
  });

  await f.check('keyboard 1-4 selects, ←/→ navigate', async () => {
    const kind = await currentKind(page);
    if (kind === 'mcq') {
      await page.locator('#qRoot').focus();
      await page.keyboard.press('1');
      await expect(page.locator('#qOpts .opt').first()).toHaveAttribute('aria-checked', 'true');
    } else {
      // While the SA input is focused, the 1-4 / arrow shortcuts must not fire
      // (useQuiz.onKeyDown bails on HTMLInputElement) — the user needs ←/→ to
      // move the text caret. Typing itself is the browser default and is fine.
      const inp = page.locator('#qOpts #saIn');
      await inp.focus();
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('#qCount')).toHaveText('Câu 2/5'); // suppressed
      await page.keyboard.press('ArrowLeft');
      await expect(page.locator('#qCount')).toHaveText('Câu 2/5'); // suppressed
      await expect(page.locator('#qOpts .opt')).toHaveCount(0); // no MCQ answers
    }
    await page.locator('#qRoot').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#qCount')).toHaveText('Câu 3/5');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#qCount')).toHaveText('Câu 2/5');
  });

  await f.check('flag button toggles + palette turns gold', async () => {
    const flagBtn = page.locator('#qFlag');
    await expect(flagBtn).toHaveAttribute('aria-pressed', 'false');
    await flagBtn.click();
    await expect(flagBtn).toHaveAttribute('aria-pressed', 'true');
    await expectPaletteGold(page, 1); // Q2 is current
    await flagBtn.click(); // toggle back off
    await expect(flagBtn).toHaveAttribute('aria-pressed', 'false');
    const palBtn = page.locator('#qPal button').nth(1);
    await expect(palBtn).not.toHaveClass(/flag/);
  });

  await f.check('star (sổ tay) saves to localStorage', async () => {
    const starBtn = page.locator('#qStar');
    await expect(starBtn).toHaveAttribute('aria-pressed', 'false');
    await starBtn.click();
    await expect(starBtn).toHaveAttribute('aria-pressed', 'true');
    const starred = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('ontap12-v1') || '{}');
      return Object.keys(s.starred || {});
    });
    expect(starred.length).toBe(1);
  });

  await f.check('submit → /result with score/verdict/stats', async () => {
    await page.locator('#qSubmit').click();
    await expect(page).toHaveURL(/\/result/, { timeout: 15_000 });
    await expect(page.locator('#rPoint')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#rPoint')).toHaveText(/^\d+\.\d$/);
    await expect(page.locator('#rVerdict')).toHaveText(/Cần cố gắng|Đạt|Khá|Tốt|Xuất sắc/);
    for (const id of ['#rOk', '#rBad', '#rSkip', '#rFrac']) {
      await expect(page.locator(id)).toBeVisible();
    }
  });

  await f.check('scoring cross-check (ok+bad+skip=5, %, /10 = scoring.ts MCQ rule)', async () => {
    const s = await page.evaluate(() => ({
      point: parseFloat(document.querySelector('#rPoint')?.textContent ?? ''),
      frac: (document.querySelector('#rFrac')?.textContent ?? '').trim(),
      ok: +(document.querySelector('#rOk')?.textContent ?? 0),
      bad: +(document.querySelector('#rBad')?.textContent ?? 0),
      skip: +(document.querySelector('#rSkip')?.textContent ?? 0),
    }));
    f.rec.notes.push(`flow1 result: ${JSON.stringify(s)}`);
    expect(s.ok + s.bad + s.skip).toBe(5);
    expect(s.frac).toBe(`${s.ok}/5 · ${Math.round((s.ok / 5) * 100)}%`);
    // MCQ and SA both score 1pt per correct question (scoring.ts), and TF is
    // absent from the history bank — so pts === ok here.
    const expPoint = Math.round((s.ok / 5) * 100) / 10; // scoring.ts line 129
    expect(s.point).toBeCloseTo(expPoint, 10);
  });

  await f.check('review lists all 5 with an answer (MCQ letter / TF per-statement / SA key)', async () => {
    const revs = page.locator('#reviewList > .rev');
    await expect(revs).toHaveCount(5);
    const n = await revs.count();
    for (let i = 0; i < n; i++) {
      const t = await revs.nth(i).innerText();
      // SA rows render "Bạn trả lời:" + "Đáp án: <key>" instead of an option letter.
      const hasSA = t.includes('Bạn trả lời:') && t.includes('Đáp án:');
      const hasMCQ = /Đáp án đúng: [A-D]/.test(t);
      const hasTF = t.includes('Đúng/Sai từng ý');
      expect(hasSA || hasMCQ || hasTF, `rev ${i + 1} has no MCQ/TF/SA answer: ${t.slice(0, 120)}`).toBe(true);
    }
  });

  await cleanCheck(page, f);
  await f.save();
  gate(f.rec);
});

// -------------------------------------------------- flows 2 + 3 + 4

test('flows 2-4: timed exam (timeout) → result review → drill/retry → progress persistence', async ({ page }) => {
  test.setTimeout(360_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  // Leave-started-exam navigations (goBack from drill, goto /progress) hit the
  // beforeunload guard — accept them.
  page.on('dialog', (d) => { void d.accept().catch(() => {}); });
  const ev = session(page);
  const f2 = flow(page, '2-timed-exam', ev);
  const f3 = flow(page, '3-result-review', ev);
  const f4 = flow(page, '4-progress', ev);

  // In-page timer sampler: records every rendered timer tick while the quiz is
  // mounted (soft navigation to /result keeps the same document/interval).
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).__timerSamples = [] as string[];
    setInterval(() => {
      const t = document.querySelector('.timer time');
      if (t && location.pathname === '/quiz') {
        ((window as unknown as Record<string, unknown>).__timerSamples as string[]).push(
          t.textContent ?? '',
        );
      }
    }, 400);
  });

  await page.goto(TIMED_URL, { waitUntil: 'networkidle', timeout: 45_000 });

  await f2.check('exam renders (Kiểm tra · Hóa học 12, Câu 1/10, timer 01:00)', async () => {
    await expect(page.locator('#qRoot')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#qCount')).toHaveText('Câu 1/10');
    await expect(page.locator('#qTitle')).toContainText('Kiểm tra · Hóa học 12 · Tổng hợp');
    // 1-minute clock; the first tick may already have fired by assertion time
    await expect(page.locator('.timer time')).toHaveText(/^0[01]:[0-5]\d$/);
  });

  const answered: string[] = [];
  await f2.check('answer 3 questions (option A / Đúng)', async () => {
    for (let q = 0; q < 3; q++) {
      answered.push(await answerCurrent(page));
      if (q < 2) {
        await page.locator('#qNext').click();
        await expect(page.locator('#qCount')).toHaveText(`Câu ${q + 2}/10`, { timeout: 5_000 });
      }
    }
    f2.rec.notes.push(`answered question types: ${answered.join(',')}`);
    await expect(page.locator('#qDone')).toHaveText('Đã làm: 3');
    const progStyle = await page.locator('#qProg').getAttribute('style');
    expect(progStyle ?? '').toContain('30%');
  });

  await f2.check('flag 1 question → palette turns gold', async () => {
    await page.locator('#qPal button').first().click(); // back to Q1
    await expect(page.locator('#qCount')).toHaveText('Câu 1/10');
    await expect(page.locator('#qFlag')).toHaveAttribute('aria-pressed', 'false');
    await page.locator('#qFlag').click();
    await expect(page.locator('#qFlag')).toHaveAttribute('aria-pressed', 'true');
    await expectPaletteGold(page, 0);
  });

  await f2.check('timeout auto-submits once → /result (Hết giờ), hist persisted exactly once', async () => {
    // The one bounded wait for the 60-second exam (per brief).
    await expect(page).toHaveURL(/\/result/, { timeout: 90_000 });
    await expect(page.locator('#rPoint')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#rSub')).toContainText('Hết giờ ·');
    const ls = await page.evaluate(() => JSON.parse(localStorage.getItem('ontap12-v1') || '{}'));
    expect((ls.hist || []).length, `hist: ${JSON.stringify(ls.hist)}`).toBe(1);
    expect(ls.exams).toBe(1);
  });

  const stats = { point: 0, frac: '', ok: 0, bad: 0, skip: 0 };
  await f2.check('timer never displayed negative (sampled every 400ms)', async () => {
    const samples = await page.evaluate(
      () => ((window as unknown as Record<string, unknown>).__timerSamples as string[]) ?? [],
    );
    f2.rec.notes.push(
      `timer samples: ${samples.length} (first=${samples[0]} last=${samples[samples.length - 1]})`,
    );
    expect(samples.length).toBeGreaterThan(50);
    for (const s of samples) {
      expect(String(s), `timer sample "${s}"`).toMatch(/^\d{2}:\d{2}$/);
    }
  });

  Object.assign(
    stats,
    await page.evaluate(() => ({
      point: parseFloat(document.querySelector('#rPoint')?.textContent ?? '0'),
      frac: (document.querySelector('#rFrac')?.textContent ?? '').trim(),
      ok: +(document.querySelector('#rOk')?.textContent ?? 0),
      bad: +(document.querySelector('#rBad')?.textContent ?? 0),
      skip: +(document.querySelector('#rSkip')?.textContent ?? 0),
    })),
  );
  f2.rec.notes.push(`flow2 result stats: ${JSON.stringify(stats)}`);

  await f2.check('totals add up: ok+bad+skip = 10; only the 3 answered counted (7 skipped)', async () => {
    expect(stats.ok + stats.bad + stats.skip).toBe(10);
    expect(stats.ok + stats.bad).toBe(3);
    expect(stats.skip).toBe(7);
    await expect(page.locator('#rTime')).toHaveText(/^[01]:\d{2}$/);
  });

  // ---- flow 3: result review ------------------------------------------

  await f3.check('scoring cross-check vs lib/quiz/scoring.ts (incl. TF partial credit)', async () => {
    const revs = await page.evaluate(() =>
      [...document.querySelectorAll('#reviewList > .rev')].map((rev) => {
        const cls = rev.querySelector('.tag')?.className ?? '';
        const st = /bad/.test(cls) ? 'bad' : /skip/.test(cls) ? 'skip' : /ok/.test(cls) ? 'ok' : '';
        // TF revs: each statement row has <b>… Đáp án: Đúng/Sai … ✓/✗</b>.
        // SA revs use a <span> (not <b>) so they stay on the 1pt-per-question path.
        const marks = [...rev.querySelectorAll('.result-opts .opt b')].map(
          (b) => ((b.textContent ?? '').includes('✓') ? 1 : 0),
        );
        const isSA = !!rev.querySelector('.result-opts .opt .sa-cand');
        return { st, isTF: marks.length > 0, isSA, gd: marks.reduce<number>((a, b) => a + b, 0) };
      }),
    );
    expect(revs.length).toBe(10);
    let pts = 0, ok = 0, bad = 0, skip = 0, tfSeen = 0, saSeen = 0;
    for (const r of revs) {
      if (r.st === 'ok') ok++; else if (r.st === 'bad') bad++; else skip++;
      if (r.isTF) {
        tfSeen++;
        pts += r.gd === 4 ? 1 : r.gd === 3 ? 0.5 : r.gd === 2 ? 0.25 : 0; // scoring.ts lines 97-99
      } else {
        pts += r.st === 'ok' ? 1 : 0; // scoring.ts line 102 (MCQ + SA)
      }
      if (r.isSA) saSeen++;
    }
    f3.rec.notes.push(`review-derived: ok=${ok} bad=${bad} skip=${skip} tfQuestions=${tfSeen} saQuestions=${saSeen} pts=${pts}`);
    expect([ok, bad, skip]).toEqual([stats.ok, stats.bad, stats.skip]);
    const expPoint = Math.round((pts / 10) * 100) / 10; // scoring.ts line 129
    expect(stats.point, `UI rPoint ${stats.point} vs recomputed ${expPoint}`).toBeCloseTo(expPoint, 10);
    const expPct = Math.round((ok / 10) * 100); // ResultView line 176
    expect(stats.frac).toBe(`${ok}/10 · ${expPct}%`);
  });

  await f3.check('review lists all 10 questions', async () => {
    await expect(page.locator('#reviewList > .rev')).toHaveCount(10);
  });

  await f3.check('"Đáp án đúng" letters (MCQ) / per-statement answers (TF) / SA answer shown', async () => {
    const info = await page.evaluate(() =>
      [...document.querySelectorAll('#reviewList > .rev')].map((rev, i) => {
        const t = (rev as HTMLElement).innerText;
        return {
          i,
          mcqLetter: /Đáp án đúng: ([A-D])/.exec(t)?.[1] ?? null,
          tfAns: (t.match(/Đáp án: (Đúng|Sai)/g) ?? []).length,
          isSA: !!rev.querySelector('.result-opts .opt .sa-cand'),
        };
      }),
    );
    expect(info.length).toBe(10);
    let mcq = 0, tf = 0, sa = 0;
    for (const r of info) {
      if (r.isSA) {
        sa++;
        // SA: no option letter — the typed candidate + the DB key are shown.
        expect(r.mcqLetter, `rev ${r.i + 1} SA row must not show an MCQ letter`).toBeNull();
      } else if (r.tfAns > 0) {
        tf++;
        expect(r.tfAns, `rev ${r.i + 1} TF statement answers`).toBe(4);
      } else {
        mcq++;
        expect(r.mcqLetter, `rev ${r.i + 1} "Đáp án đúng" letter`).toMatch(/^[A-D]$/);
      }
    }
    f3.rec.notes.push(`review: ${mcq} MCQ (letters shown), ${tf} TF (4 statement answers each), ${sa} SA (key shown)`);
  });

  const wrongTexts: string[] = [];
  await f3.check('drill button ("Luyện câu sai") builds a quiz URL with ids= of exactly the wrong/skipped', async () => {
    wrongTexts.push(
      ...(await page.evaluate(() =>
        [...document.querySelectorAll('#reviewList > .rev')]
          .filter((rev) => /bad|skip/.test(rev.querySelector('.tag')?.className ?? ''))
          .map((rev) => (rev.querySelector('p')?.textContent ?? '').trim()),
      )),
    );
    expect(wrongTexts.length, `wrong/skipped: ${wrongTexts.length}`).toBe(stats.bad + stats.skip);
    await expect(page.locator('#rDrill')).toBeEnabled();
    await page.locator('#rDrill').click();
    await expect(page).toHaveURL(/\/quiz\?.*ids=/, { timeout: 15_000 });
    const ids = (new URL(page.url()).searchParams.get('ids') ?? '').split(',').filter(Boolean);
    expect(ids.length).toBe(stats.bad + stats.skip);
    await expect(page.locator('#qCount')).toHaveText(`Câu 1/${ids.length}`, { timeout: 20_000 });
    await expect(page.locator('#qTitle')).toContainText('Luyện tập · Hóa học 12');
  });

  await f3.check('drill quiz starts with exactly those questions', async () => {
    const total = parseInt(
      (await page.locator('#qCount').innerText()).split('/')[1] ?? '0',
      10,
    );
    const texts: string[] = [];
    for (let i = 0; i < total; i++) {
      const t = await page.locator('#qText').innerText();
      texts.push(t.replace(/^Câu \d+:\s*/, '').trim());
      if (i < total - 1) {
        await page.locator('#qNext').click();
        await expect(page.locator('#qCount')).toHaveText(`Câu ${i + 2}/${total}`, { timeout: 5_000 });
      }
    }
    const a = texts.map(norm).sort();
    const b = wrongTexts.map(norm).sort();
    expect(a.length).toBe(b.length);
    expect(a, 'drill question set vs review wrong/skipped set').toEqual(b);
  });

  await f3.check('goBack → /result now redirects home (B19: result is read-once)', async () => {
    // B19 fix: the result is consumed on read — revisiting /result (or going
    // back to it) no longer replays a stale exam; it redirects to '/'.
    await page.goBack();
    await expect(page).toHaveURL(/\/(result)?$/, { timeout: 15_000 });
    await expect(page).toHaveURL(/localhost:3000\/?$/, { timeout: 15_000 });
    // "Làm lại đề" is unavailable on the empty state; start a fresh exam from
    // the quiz page directly and verify it is playable.
    await page.goto(
      '/quiz?subject=chemistry&lesson=all&count=10&time=1&level=all&qtype=all&practice=false&shQ=true&shA=true',
      { waitUntil: 'networkidle', timeout: 45_000 },
    );
    await expect(page.locator('#qRoot')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#qCount')).toHaveText('Câu 1/10');
    // Timer is running by now: assert the mm:ss shape, not an exact start.
    await expect(page.locator('.timer time')).toHaveText(/^0[01]:\d{2}$/);
    await answerCurrent(page); // playable
  });

  // ---- flow 4: progress persistence ------------------------------------

  await f4.check('/progress: 1 đề done, chemistry card + 1 history entry with date & score', async () => {
    await page.goto('/progress', { waitUntil: 'networkidle', timeout: 45_000 });
    const h2 = page.locator('h2', { hasText: 'Tiến độ học tập' });
    await expect(h2).toBeVisible({ timeout: 20_000 });
    const h2Text = await h2.innerText();
    f4.rec.notes.push(`progress h2: ${norm(h2Text)}`);
    expect(norm(h2Text)).toContain('1 đề');
    const chemPanel = page.locator('#progCards .panel', { hasText: 'Hóa học 12' });
    await expect(chemPanel).toBeVisible();
    const rows = await chemPanel.locator('.prog-row').allInnerTexts();
    f4.rec.notes.push(`chemistry prog rows: ${JSON.stringify(rows.map(norm))}`);
    expect(rows.length).toBeGreaterThan(0);
    const items = page.locator('#histList .hist-item');
    await expect(items).toHaveCount(1);
    const histText = await items.first().innerText();
    f4.rec.notes.push(`hist entry: ${norm(histText)}`);
    expect(histText).toMatch(/\/10/); // score out of 10
    expect(histText).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/); // vi-VN date
    expect(histText).toContain('Hóa học 12');
    expect(histText).toContain('Tổng hợp');
  });

  await f4.check('progress state persists after reload (localStorage)', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('#histList .hist-item')).toHaveCount(1, { timeout: 20_000 });
    const h2Text = await page.locator('h2', { hasText: 'Tiến độ học tập' }).innerText();
    expect(norm(h2Text)).toContain('1 đề');
    const rows = await page.locator('#progCards .panel', { hasText: 'Hóa học 12' })
      .locator('.prog-row').allInnerTexts();
    expect(rows.length).toBeGreaterThan(0);
  });

  await cleanCheck(page, f4);
  await f2.save();
  await f3.save();
  await f4.save();
  gate(f2.rec);
  gate(f3.rec);
  gate(f4.rec);
});

// ---------------------------------------------------------------- flow 5

test('flow5: notebook star round-trip (/bank → /notebook)', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const f = flow(page, '5-notebook');
  await page.goto('/bank', { waitUntil: 'networkidle', timeout: 45_000 });

  let total = 0;
  await f.check('bank loads with full total (h2 · N/N câu)', async () => {
    await expect(page.locator('#bankList .bank-item').first()).toBeVisible({ timeout: 20_000 });
    const h2 = norm(await page.locator('h2', { hasText: 'Ngân hàng câu hỏi' }).innerText());
    const m = /· (\d+)\/(\d+) câu/.exec(h2);
    expect(m, `bank h2: "${h2}"`).toBeTruthy();
    total = +(m?.[2] ?? 0);
    expect(total).toBeGreaterThan(1000);
    f.rec.notes.push(`bank total: ${total}`);
  });

  const starredTexts: string[] = [];
  await f.check('star 2 questions on /bank (aria-label "Lưu vào sổ tay")', async () => {
    const items = page.locator('#bankList .bank-item');
    for (const i of [0, 1]) {
      starredTexts.push(
        norm(await items.nth(i).locator('.bank-head span').nth(1).innerText()),
      );
    }
    for (const i of [0, 1]) {
      const star = page.locator('.bank-item .bank-star').nth(i);
      await expect(star).toHaveAttribute('aria-label', 'Lưu vào sổ tay');
      await star.click();
      await expect(star).toHaveAttribute('aria-label', 'Bỏ sao chép');
      await expect(star).toHaveAttribute('aria-pressed', 'true');
    }
  });

  await f.check('notebook shows exactly those 2 (h2 "Sổ tay · 2/N câu")', async () => {
    await page.goto('/notebook', { waitUntil: 'networkidle', timeout: 45_000 });
    const h2 = page.locator('h2', { hasText: 'Sổ tay' });
    await expect(h2).toHaveText(`Sổ tay · 2/${total} câu`, { timeout: 20_000 });
    const items = page.locator('#bankList .bank-item');
    await expect(items).toHaveCount(2);
    const texts: string[] = [];
    for (let i = 0; i < 2; i++) {
      texts.push(norm(await items.nth(i).locator('.bank-head span').nth(1).innerText()));
    }
    expect(texts.sort()).toEqual([...starredTexts].sort());
  });

  await f.check('unstar one → list drops to 1', async () => {
    await page.locator('.bank-item .bank-star').first().click();
    // the unstarred item no longer matches the star filter → it is removed;
    // the single remaining item's star is still "Bỏ sao chép"
    await expect(page.locator('.bank-item .bank-star')).toHaveCount(1);
    await expect(page.locator('.bank-item .bank-star')).toHaveAttribute('aria-label', 'Bỏ sao chép');
    await expect(page.locator('h2', { hasText: 'Sổ tay' })).toHaveText(`Sổ tay · 1/${total} câu`);
    await expect(page.locator('#bankList .bank-item')).toHaveCount(1);
    const starred = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('ontap12-v1') || '{}');
      return Object.keys(s.starred || {});
    });
    expect(starred.length, 'localStorage starred after unstar').toBe(1);
  });

  await f.check('"Xóa bộ lọc" keeps star-only (stays 1/N, not N)', async () => {
    await page.locator('button', { hasText: 'Xóa bộ lọc' }).click();
    await expect(page.locator('h2', { hasText: 'Sổ tay' })).toHaveText(`Sổ tay · 1/${total} câu`);
    await expect(page.locator('#bankList .bank-item')).toHaveCount(1);
  });

  await cleanCheck(page, f);
  await f.save();
  gate(f.rec);
});

// ---------------------------------------------------------------- flow 6

test('flow6: bank filters (subject/lesson/type), search, pagination, empty state', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const f = flow(page, '6-bank-filters');
  await page.goto('/bank', { waitUntil: 'networkidle', timeout: 45_000 });
  await expect(page.locator('#bankList .bank-item').first()).toBeVisible({ timeout: 20_000 });

  await f.check('Hóa học + Chương 2 + Đúng/Sai → every rendered item is chemistry TF', async () => {
    await pickSelect(page, 'Môn', 'Hóa học 12');
    await pickSelect(page, 'Bài/Unit', 'Chương 2');
    await pickSelect(page, 'Dạng câu hỏi', 'Đúng/Sai');
    // 58 valid chemistry-L2 TF questions in the bank (data/questions.json)
    await expect(page.locator('h2', { hasText: 'Ngân hàng câu hỏi' }))
      .toContainText(`58/1524 câu`, { timeout: 10_000 });
    const headers = await page.evaluate(() =>
      [...document.querySelectorAll('#bankList .bank-item .bank-head > span:nth-child(2)')].map(
        (el) => (el.textContent ?? '').trim(),
      ),
    );
    expect(headers.length).toBe(20); // page size
    for (const [i, h] of headers.entries()) {
      expect(h.startsWith('[Hóa C2 · Đúng/Sai]'), `item ${i + 1}: ${h.slice(0, 70)}`).toBe(true);
    }
  });

  await f.check('search "ester" → every rendered item matches', async () => {
    await page.locator('button', { hasText: 'Xóa bộ lọc' }).click();
    await expect(page.locator('h2', { hasText: 'Ngân hàng câu hỏi' }))
      .toContainText('1524/1524 câu', { timeout: 10_000 });
    await page.locator('input[aria-label="Tìm câu hỏi"]').fill('ester');
    // 29 valid bank questions contain "ester" (question text) in the data
    await expect(page.locator('h2', { hasText: 'Ngân hàng câu hỏi' }))
      .toContainText('29/1524 câu', { timeout: 10_000 });
    const items = page.locator('#bankList .bank-item');
    const n = await items.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const t = (await items.nth(i).locator('summary').innerText()).toLowerCase();
      expect(t, `ester item ${i + 1}`).toContain('ester');
    }
  });

  await f.check('pagination: next page works, page numbers render, current marked', async () => {
    await page.locator('input[aria-label="Tìm câu hỏi"]').fill('');
    await expect(page.locator('.pg-info')).toHaveText(/Trang 1\/77 · 1524 câu/, { timeout: 10_000 });
    await page.locator('button[aria-label="Trang sau"]').click();
    await expect(page.locator('.pg-info')).toHaveText('Trang 2/77 · 1524 câu');
    const pageNums = await page.evaluate(() =>
      [...document.querySelectorAll('nav.pager button')]
        .map((b) => b.getAttribute('aria-label') ?? '')
        .filter((l) => /^Trang \d+$/.test(l)),
    );
    f.rec.notes.push(`pager buttons on page 2: ${JSON.stringify(pageNums)}`);
    expect(pageNums.length).toBeGreaterThanOrEqual(5);
    expect(pageNums).toContain('Trang 2');
    const cur = await page.locator('nav.pager button[aria-current="page"]').innerText();
    expect(cur.trim()).toBe('2');
  });

  await f.check('empty search "zzzzz" → empty-state panel', async () => {
    await page.locator('input[aria-label="Tìm câu hỏi"]').fill('zzzzz');
    await expect(page.locator('h2', { hasText: 'Ngân hàng câu hỏi' }))
      .toContainText('0/1524 câu', { timeout: 10_000 });
    await expect(
      page.locator('.panel', { hasText: 'Không tìm thấy câu hỏi nào. Hãy thử nới lỏng bộ lọc.' }),
    ).toBeVisible();
    await expect(page.locator('#bankList')).toHaveCount(0);
    await expect(page.locator('nav.pager')).toHaveCount(0);
  });

  await cleanCheck(page, f);
  await f.save();
  gate(f.rec);
});

// ---------------------------------------------------------------- flow 7

test('flow7: theory /biology/theory/4 → practice quiz; /history/theory/99 safe', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const f = flow(page, '7-theory');

  await f.check('/biology/theory/4 renders theory content', async () => {
    await page.goto('/biology/theory/4', { waitUntil: 'networkidle', timeout: 45_000 });
    const h2 = await page.locator('article.theory > h2').innerText();
    f.rec.notes.push(`bio4 theory title: ${h2}`);
    expect(h2).toContain('Bài 4');
    await expect(page.locator('article.theory .eyebrow')).toContainText('Sinh học 12');
    const bytes = await page.evaluate(
      () => document.querySelector('article.theory')?.innerHTML.length ?? 0,
    );
    expect(bytes).toBeGreaterThan(500);
    const subsup = await page.evaluate(() => ({
      sub: document.querySelectorAll('article.theory sub').length,
      sup: document.querySelectorAll('article.theory sup').length,
    }));
    f.rec.notes.push(
      `bio4 sub/sup tag counts: ${JSON.stringify(subsup)} (this lesson's data has none — n/a here)`,
    );
  });

  await f.check('back link returns to /biology', async () => {
    await page.locator('a.theory-back').click();
    await expect(page).toHaveURL(/localhost:3000\/biology\/?$/, { timeout: 15_000 });
  });

  await f.check('"Luyện trắc nghiệm phần này" → practice quiz for biology lesson 4', async () => {
    await page.goto('/biology/theory/4', { waitUntil: 'networkidle', timeout: 45_000 });
    const link = page.locator('a.btn-primary', { hasText: 'Luyện trắc nghiệm phần này' });
    await expect(link).toHaveAttribute(
      'href',
      /\/quiz\?subject=biology&lesson=4&count=10&time=10&level=all&qtype=all&practice=true/,
    );
    await link.click();
    await expect(page).toHaveURL(/\/quiz\?subject=biology&lesson=4/, { timeout: 15_000 });
    await expect(page.locator('#qRoot')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#qTitle')).toContainText('Luyện tập · Sinh học 12 · Bài 4');
    await expect(page.locator('#qCount')).toHaveText('Câu 1/10');
  });

  await f.check('/history/theory/99 → 404 (F-B8a: no soft-200 panel)', async () => {
    // Wave B replaced the "Chưa có lý thuyết" soft-200 panel with notFound();
    // the status stays 200 while the loading shell streams (parked ruling,
    // re-asserted by the user 2026-10-10 — skeleton UX over status).
    await page.goto('/history/theory/99', { waitUntil: 'networkidle', timeout: 45_000 });
    const body = await page.locator('body').innerText();
    const is404ish =
      body.includes('404') ||
      body.includes('Không tìm thấy') ||
      body.includes('This page could not be found');
    expect(is404ish, `theory/99 body: ${body.slice(0, 200)}`).toBe(true);
    // A 404 renders without a back link; navigate back explicitly.
    await page.goto('/history', { waitUntil: 'networkidle', timeout: 45_000 });
    await expect(page).toHaveURL(/localhost:3000\/history\/?$/, { timeout: 15_000 });
  });

  await cleanCheck(page, f);
  await f.save();
  gate(f.rec);
});

// ---------------------------------------------------------------- flow 8

test('flow8: vocab — unit select, kind filter, shuffle toast, flip, Đã thuộc, star persists', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const f = flow(page, '8-vocab');
  await page.goto('/vocab', { waitUntil: 'networkidle', timeout: 45_000 });

  let firstCard = '';
  await f.check('/vocab renders Unit 1 flashcard', async () => {
    await expect(page.locator('#fcMain')).toBeVisible({ timeout: 20_000 });
    const h2 = norm(await page.locator('h2', { hasText: 'Flashcard từ vựng' }).innerText());
    f.rec.notes.push(`vocab h2: ${h2}`);
    expect(h2).toMatch(/Flashcard từ vựng · Unit 1 · \d+\/\d+ thẻ/);
    firstCard = (await page.locator('#fcMain .fc-front .en').innerText()).trim();
    expect(firstCard.length).toBeGreaterThan(0);
  });

  await f.check('"Đã thuộc" marks the card; count/progress update', async () => {
    await expect(page.locator('#fcKnow')).toHaveText('Đã thuộc ✓'); // action label while unknown
    await page.locator('#fcKnow').click();
    await expect(page.locator('#fcKnow')).toHaveText('Chưa thuộc'); // now known → unmark action
    const hint = await page.locator('#fcMain .fc-front .hint').first().innerText();
    expect(hint).toContain('Đã thuộc ✓');
    const width = await page.locator('#fcProg').evaluate((el) => (el as HTMLElement).style.width);
    f.rec.notes.push(`fcProg width after 1 known: ${width}`);
    expect(width).not.toBe('0%');
  });

  await f.check('star persists after reload (localStorage)', async () => {
    await page.locator('#fcStar').click();
    await expect(page.locator('#fcStar')).toHaveAttribute('aria-label', 'Bỏ sao chép');
    await expect(page.locator('#fcStar')).toHaveText(/★ Sổ tay/);
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('#fcMain')).toBeVisible({ timeout: 20_000 });
    const card2 = (await page.locator('#fcMain .fc-front .en').innerText()).trim();
    expect(card2, 'same first card after reload (unshuffled)').toBe(firstCard);
    await expect(page.locator('#fcStar')).toHaveAttribute('aria-label', 'Bỏ sao chép');
    await expect(page.locator('#fcKnow')).toHaveText('Chưa thuộc'); // known persisted too
  });

  await f.check('flashcard flips on click', async () => {
    const before = await page.locator('#fcMain').getAttribute('aria-label');
    await page.locator('#fcMain').click();
    await expect(page.locator('#fcMain')).toHaveClass(/flipped/);
    const after = await page.locator('#fcMain').getAttribute('aria-label');
    expect(after ?? '').not.toBe(before ?? '');
    await page.locator('#fcMain').click();
    await expect(page.locator('#fcMain')).not.toHaveClass(/flipped/);
  });

  await f.check('unit select navigates to Unit 2', async () => {
    await pickSelect(page, 'Unit', 'Unit 2');
    await expect(page).toHaveURL(/\/vocab\?unit=2/, { timeout: 15_000 });
    const h2 = norm(await page.locator('h2', { hasText: 'Flashcard từ vựng' }).innerText());
    f.rec.notes.push(`vocab h2 (unit 2): ${h2}`);
    expect(h2).toMatch(/Flashcard từ vựng · Unit 2 · \d+\/\d+ thẻ/);
  });

  await f.check('kind filter (Cụm từ) narrows the list', async () => {
    const before = norm(await page.locator('h2', { hasText: 'Flashcard từ vựng' }).innerText());
    await pickSelect(page, 'Loại', 'Cụm từ');
    const after = norm(await page.locator('h2', { hasText: 'Flashcard từ vựng' }).innerText());
    f.rec.notes.push(`kind filter: "${before}" → "${after}"`);
    const m = /· (\d+)\/(\d+) thẻ/.exec(after);
    expect(m, `h2 after kind filter: "${after}"`).toBeTruthy();
    expect(+(m?.[1] ?? 0)).toBeGreaterThan(0);
    expect(+(m?.[1] ?? 0)).toBeLessThan(+(m?.[2] ?? 0));
  });

  await f.check('shuffle shows a toast in the top-right', async () => {
    const n = parseInt(
      /· (\d+)\/(\d+) thẻ/.exec(
        norm(await page.locator('h2', { hasText: 'Flashcard từ vựng' }).innerText()),
      )?.[1] ?? '0',
      10,
    );
    await page.locator('#vShuffle').click();
    const toast = page.locator('[data-slot="toast"]').first();
    await expect(toast).toBeVisible({ timeout: 5_000 });
    await expect(toast).toContainText(`Đã trộn ${n} thẻ`);
    // the toast slides in from above (500ms enter animation) — wait for it to
    // settle inside the viewport before asserting its position
    await expect
      .poll(async () => (await toast.boundingBox())?.y ?? -999, { timeout: 4_000 })
      .toBeGreaterThanOrEqual(0);
    const box = await toast.boundingBox();
    f.rec.notes.push(`toast box (settled): ${JSON.stringify(box)}`);
    expect(box).toBeTruthy();
    expect((box?.x ?? 0) + (box?.width ?? 0) / 2).toBeGreaterThan(640); // right half @1280
    expect(box?.y ?? 999).toBeLessThan(160); // top area
  });

  await cleanCheck(page, f);
  await f.save();
  gate(f.rec);
});

// ---------------------------------------------------------------- flow 9

test('flow9: /quick redirects to a playable timed quiz', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const f = flow(page, '9-quick');
  await page.goto('/quick', { waitUntil: 'domcontentloaded', timeout: 30_000 });

  await f.check('redirects to /quiz?…quick=true within 5s', async () => {
    await expect(page).toHaveURL(/\/quiz\?.*quick=true/, { timeout: 5_000 });
  });

  await f.check('exam renders (Kiểm tra nhanh ·, 10 questions, timer runs)', async () => {
    await expect(page.locator('#qRoot')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#qTitle')).toContainText('Kiểm tra nhanh ·');
    await expect(page.locator('#qCount')).toHaveText('Câu 1/10');
    const timer = page.locator('.timer time');
    const t0 = await timer.innerText();
    await expect
      .poll(async () => await timer.innerText(), { timeout: 10_000 })
      .not.toBe(t0); // countdown ticking
  });

  await f.check('exam is playable (answer + palette marks done)', async () => {
    await answerCurrent(page);
    await expect(page.locator('#qPal button').first()).toHaveClass(/done/);
    await expect(page.locator('#qDone')).toHaveText('Đã làm: 1');
  });

  await cleanCheck(page, f);
  await f.save();
  gate(f.rec);
});

// ---------------------------------------------------------------- flow 10

test('flow10: short_answer is a first-class question type (input → scoring → review)', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const f = flow(page, '10-short-answer');

  // Seeded from the app's own public bank API (ruled public by design), so the
  // answer keys are real and the scoring assertions are ground truth.
  const res = await page.request.get('/api/questions?subject=history&type=short_answer&limit=200');
  expect(res.status(), '/api/questions?type=short_answer status').toBe(200);
  const data = (await res.json()) as { questions: Record<string, any>[] };
  const pool = data.questions.filter(
    (q) => typeof q.answer === 'string' && !(q.question ?? '').includes(q.answer),
  );
  expect(pool.length, 'history short_answer rows available').toBeGreaterThan(1);
  f.rec.notes.push(`SA bank rows available: ${pool.length}`);

  // Row A: accented key → typed without accents AND lowercased (case- and
  // accent-insensitive match). Row B: any key → typed wrong.
  const stripAccents = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
  const accented = pool.find(
    (q) => stripAccents(q.answer) !== q.answer && stripAccents(q.answer).length <= (q.maxLen ?? 99),
  );
  expect(accented, 'at least one accented SA answer key').toBeTruthy();
  const rowA = accented!;
  const rowB = pool.find((q) => q.id !== rowA.id)!;
  const typedA = stripAccents(rowA.answer).toLowerCase();
  const wrongB = 'zzzz';

  const ids = [rowA.id, rowB.id].join(',');
  // shQ=false keeps the quiz order identical to the requested ids.
  await page.goto(
    `/quiz?subject=history&lesson=all&count=2&time=10&level=all&qtype=all&practice=false&shQ=false&shA=false&ids=${ids}`,
    { waitUntil: 'networkidle', timeout: 60_000 },
  );
  await expect(page.locator('#qRoot')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#qCount')).toHaveText('Câu 1/2');

  await f.check('SA question renders a text input, not MCQ options', async () => {
    await expect(page.locator('#qOpts #saIn')).toBeVisible();
    await expect(page.locator('#qOpts #saIn')).toHaveAttribute('maxlength', String(rowA.maxLen));
    await expect(page.locator('#qOpts .opt')).toHaveCount(0);
    await expect(page.locator('#qOpts .tf-row')).toHaveCount(0);
  });

  await f.check('the answer key is never rendered before answering', async () => {
    // Method: live-DOM probe of the rendered answer surface only. The server
    // component ships the whole subject bank in the RSC payload (dev + prod
    // both include every MCQ/TF answer key), so a page-source scan would "leak"
    // for every type equally; what matters is what the UI renders pre-answer.
    const key = rowA.answer as string;
    const live = await page.evaluate(() => {
      const opts = document.querySelector('#qOpts') as HTMLElement | null;
      const qText = document.querySelector('#qText') as HTMLElement | null;
      const chip = document.querySelector('#qTopic') as HTMLElement | null;
      return {
        opts: opts?.innerText ?? '',
        optsHtml: opts?.innerHTML ?? '',
        qText: qText?.innerText ?? '',
        chip: chip?.innerText ?? '',
      };
    });
    for (const [where, text] of Object.entries(live)) {
      expect(text, `answer key "${key}" rendered in #${where} pre-answer`).not.toContain(key);
    }
    // No ok/bad coloring, no explanation block before answering.
    await expect(page.locator('#qOpts .rev.exp')).toHaveCount(0);
    await expect(page.locator('#qOpts #saIn')).not.toHaveClass(/practice-ok|practice-bad/);
    f.rec.notes.push(`key "${key}" absent from #qOpts text+HTML, #qText, #qTopic, pre-answer`);
  });

  await f.check('typing the accent- and case-stripped answer scores ok', async () => {
    const inp = page.locator('#qOpts #saIn');
    await inp.fill(typedA);
    await expect(inp).toHaveValue(typedA);
    await expect(page.locator('#qDone')).toHaveText('Đã làm: 1');
    await expect(page.locator('#qPal button').first()).toHaveClass(/done/);
    f.rec.notes.push(`typed "${typedA}" for key "${rowA.answer}"`);
    await page.locator('#qNext').click();
    await expect(page.locator('#qCount')).toHaveText('Câu 2/2');
  });

  await f.check('typing a wrong answer scores bad, maxLen caps the input', async () => {
    const inp = page.locator('#qOpts #saIn');
    await inp.fill(wrongB);
    await expect(inp).toHaveValue(wrongB.slice(0, rowB.maxLen ?? wrongB.length));
    await expect(page.locator('#qDone')).toHaveText('Đã làm: 2');
  });

  await f.check('submit → /result shows the SA rows with the right tags', async () => {
    await page.locator('#qSubmit').click();
    await expect(page).toHaveURL(/\/result/, { timeout: 20_000 });
    await expect(page.locator('#rPoint')).toBeVisible({ timeout: 15_000 });
    const revs = page.locator('#reviewList > .rev');
    await expect(revs).toHaveCount(2);
    // Row A: ok tag + typed candidate + the DB key.
    const a = revs.nth(0);
    await expect(a.locator('.tag')).toHaveClass(/ok/);
    await expect(a.locator('.result-opts .opt .sa-cand')).toContainText(`Bạn trả lời: ${typedA}`);
    await expect(a.locator('.result-opts .opt')).toContainText(`Đáp án: ${rowA.answer}`);
    await expect(a.locator('.result-opts .opt')).toContainText('✓');
    await expect(a).toContainText(`Đáp án đúng: ${rowA.answer}`);
    // Row B: bad tag + its DB key.
    const b = revs.nth(1);
    await expect(b.locator('.tag')).toHaveClass(/bad/);
    await expect(b.locator('.result-opts .opt')).toContainText(`Đáp án: ${rowB.answer}`);
    await expect(b.locator('.result-opts .opt')).toContainText('✗');
    // 1 correct of 2 → 5.0 (scoring.ts: 1 SA pt per correct question).
    await expect(page.locator('#rPoint')).toHaveText('5.0');
    await expect(page.locator('#rOk')).toHaveText('1');
    await expect(page.locator('#rBad')).toHaveText('1');
    await expect(page.locator('#rSkip')).toHaveText('0');
    const drill = page.locator('#rDrill');
    await expect(drill).toBeEnabled();
    f.rec.notes.push(`SA review: A ok ("${typedA}" vs "${rowA.answer}"), B bad ("${wrongB}" vs "${rowB.answer}")`);
  });

  await f.check('"Luyện câu sai" drills the wrong SA row back into a practice quiz', async () => {
    await page.locator('#rDrill').click();
    await expect(page).toHaveURL(new RegExp(`ids=${rowB.id}`), { timeout: 20_000 });
    await expect(page.locator('#qRoot')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#qCount')).toHaveText('Câu 1/1');
    await expect(page.locator('#qOpts #saIn')).toBeVisible();
    await expect(page.locator('#qTitle')).toContainText('Luyện tập · Lịch sử 12');
  });

  await cleanCheck(page, f);
  await f.save();
  gate(f.rec);
});
