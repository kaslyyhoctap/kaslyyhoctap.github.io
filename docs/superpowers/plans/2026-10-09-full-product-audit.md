# Full Product Audit — Playwright E2E + Bug Fixes (2026-10-09)

Spec: user's audit directive (in-session, 2026-10-09) — "Review all functions + UI with Playwright, find and fix bugs."
Reference: `.superpowers/sdd/qa-audit.md` (prior static QA, bugs B01–B20) — verify, don't rediscover.

## Global Constraints

- Bun only (bun run dev / bunx). Dev server already on :3000; Playwright `reuseExistingServer: true`.
- Playwright is the primary tool: real navigation, interactions, assertions (`getByRole`/`getByLabel`); no arbitrary sleeps.
- Capture console.error / pageerror / failed requests / 4xx-5xx per route; every unexpected one is a finding.
- Fix root causes; add regression tests for fixed bugs; never weaken tests or hide errors.
- Severity: P0 unusable/data-loss/security, P1 major broken, P2 normal broken/major UX, P3 minor visual.
- Fix P0–P2; P3 only when low-risk. Preserve existing design direction.
- **Git: NO commits during the audit (audit spec §31) — keep a reviewable working-tree diff; offer commit at the end.** Review packages use working-tree diffs against HEAD.
- Working in-place on branch `next16-fullstack` (not main) — the dev server + DB + browser session under audit run from this tree. Ruling recorded in ledger.

## Routes (actual, from app/)

`/` `/[subject]` `/[subject]/theory/[lesson]` `/bank` `/notebook` `/vocab` `/quiz` `/quick` `/result` `/progress` `/ai/generate` `/login` `/admin`(+children) `/api/*` (questions, exam/start, exam/submit, progress, progress/sync, ai/generate, ai/explain, admin/questions, auth/[...nextauth], manifest)

## Tasks

- **Task 1 — Route matrix + console/network baseline.** Playwright sweep of every route above (+ invalid: /xyz, /history/theory/99, /quiz?subject=bogus, /cau-hoi/123). Verify render, title/heading, nav links resolve, zero console/pageerror, zero failed requests, no `undefined/NaN/[object Object]` text. Runs the existing `tests/e2e/responsive.spec.ts` too. Report file: findings with severity + repro.
- **Task 2 — Functional flows.** Practice mode (answer right/wrong/skip, explanation, star, flag), timed exam (timer, palette, flag, submit, score/verdict, timeout auto-submit — short config), result review (per-question ✓/✗, AI explain button presence, drill-wrong builder, retry), progress updates + reload persistence, notebook star→/notebook round-trip + reset keeps st:'star', bank filters (subject/lesson/type/state/search + pagination + empty state), theory page (content, back, "Luyện trắc nghiệm" link), vocab (filter, flip, known/star, toast), quick quiz redirect. Verify scoring numbers against lib/quiz/scoring.ts logic.
- **Task 3 — Responsive + theme + a11y.** Viewports 375×667, 390×844, 768×1024, 1280×800, 1440×900 on /, /[subject], /bank, /quiz (mid-exam), /result, /vocab, /progress, /notebook. `scrollWidth <= clientWidth` (no horizontal overflow). Mobile drawer open/close, scrim, header actions. Dark/light toggle persists across reload + navigation; contrast of chips/badges/tags in both themes. Keyboard: Tab through home + quiz answer select (1-4, ←/→), Escape closes drawer/dropdowns, focus visible. Buttons are <button>, links are <a>, inputs labeled.
- **Task 4 — Data integrity + API robustness + security re-verify.** Re-verify prior QA findings B01–B20 against today's code (B01 ExplainButton XSS for non-chem, B02 forged exam/submit flags, B03 sync hist loss, B04 questions limit NaN/unbounded, B05 admin write validation, B06 quiz negative count/time, B07 ai/generate lesson NaN + float correctAnswer, B08 answered merge cloud-wins, B09 scoreExam empty NaN, B10 ResultView /0, B11 sync fan-out, B19 stale ontap12-result, B20 dead quick/flags fields). Probe APIs with curl-style fetches: bad limit/lesson/subject, unauthorized PUT /api/progress, POST exam/submit with forged all-ok flags, ai/generate missing fields. DB counts vs UI counts (1524 questions, bank 1524/1524). Classify each as still-present / fixed / not-reproducible.
- **Task 5 — Fix wave.** One or more implementer dispatches fixing all confirmed P0–P2 (+ low-risk P3) from Tasks 1–4 findings, each with a regression test where practical. Re-run affected tests per fix.
- **Task 6 — Final verification + smoke suite + report.** Update/extend tests/e2e smoke coverage for the audited flows; run `bunx tsc --noEmit`, `bunx vitest run`, `bunx playwright test`, `bun run build`; final whole-branch review; produce the audit report (scope, bugs+fixes, UI issues, test results, remaining issues, changed files).

## Interfaces between tasks

- Tasks 1–4 are read-only audits; they produce findings files consumed by Task 5.
- Task 5 consumes the merged findings list; Task 6 consumes Task 5's fix report.
- All tasks share the dev server on :3000 and the Neon DB (read-only for audits; Task 5 must not write junk rows — use the existing test questions only).
