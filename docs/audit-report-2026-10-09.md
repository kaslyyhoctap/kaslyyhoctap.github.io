# ontap12 — Full Product Audit Report (2026-10-09)

Branch `next16-fullstack` · Next.js 16 (Turbopack) · bun · Drizzle/Neon · Playwright
Plan: `docs/superpowers/plans/2026-10-09-full-product-audit.md` · SDD ledger + reports: `.superpowers/sdd/2026-10-09-full-product-audit/`

All work is **uncommitted by design** (audit spec §31) — the branch state is this working tree.
Review package: `.superpowers/sdd/2026-10-09-full-product-audit/review-6/` (`branch.diff` + `untracked/` + `REVIEW.md`).

## 1. Scope

Every route (`/`, `/[subject]`, `/[subject]/theory/[lesson]`, `/bank`, `/notebook`, `/vocab`,
`/quiz`, `/quick`, `/result`, `/progress`, `/ai/generate`, `/login`, `/admin` + children,
`/api/*`) audited with real Playwright navigation + interaction, and the data/API layer probed
with unauthenticated and forged requests. Four audit tasks produced findings (routes sweep,
functional flows, responsive/theme/a11y, data integrity + security); three fix waves closed
them; a final whole-branch review + scoped re-review gated the result.

Verification targets: the prior static QA findings B01–B20 (`.superpowers/sdd/qa-audit.md`),
re-verified against today's code rather than rediscovered.

**Tooling**: Playwright (real navigation/interactions, `getByRole`/`getByLabel`, no arbitrary
sleeps in the assertions) · vitest for unit/API/component regression · curl-style unauthenticated
probes · live Neon DB count checks.

## 2. Bugs found and fixed (root cause)

| # | Sev | Bug | Root cause | Fix | Regression test |
|---|-----|-----|-----------|-----|-----------------|
| 1 | **P0** | `/admin/questions/[id]/edit` served every question **with `correctAnswer`** to signed-out visitors (raw RSC body, not just DOM) | RSC streams the shell before `notFound()` could act; no auth gate on the page | `requireAdmin()` → `notFound()` **before any DB fetch** on all 4 admin pages; all 4 admin API verbs 401 first | `tests/admin/page-gates.test.ts`, `tests/api/admin-auth.test.ts`, e2e raw-RSC-body probe (`audit-routes.spec.ts`) |
| 2 | **P1** | Stored XSS: model output piped through `dangerouslySetInnerHTML` (non-chem subjects) | `ExplainButton` rendered raw text as HTML | Non-chem renders React text children (escaped); chem keeps escape-first `chemFormat` | `tests/components/explain-button.test.tsx` (`<img onerror>` stays literal) |
| 3 | **P1** | Forged `/api/exam/submit` flags → arbitrary score (live-reproduced: 10/10 with all `ok:true`) | Route scored **client-supplied** flags | `serverRuntime` re-derives every correctness flag from the DB row (matched by option/statement text); unknown id → 400; `lesson` NaN → 0; `timeSeconds` guarded | `tests/api/exam.test.ts` (forged MCQ/TF → 0) |
| 4 | **P1** | `ai_explain_logs` table missing in the live DB → every authenticated explain 500'd; 50/day quota uncountable | DDL gap: declared in `db/schema.ts`, never created | `drizzle/0002_quiet_explain_logs.sql` + one-off apply script + drift-guard test | `tests/db/migrations.test.ts` |
| 5 | **P1** | Progress sync destroyed local data (B03: cloud-wins on `hist`/`best`/`starred`/…; B08: local `ok` regressed to cloud `bad`) | Merge was cloud-wins for every key except `answered` | `answered`: union, local `ok` never regresses; `hist`: union, cap 20; `starred`/`vocabKnown`: shallow union; `marked`: dedupe union; `prog`: per-lesson `Math.max`; `best`/`exams`/`correct`: `Math.max`; catch-all local-wins (matches post-login steady state) | `tests/api/progress.test.ts` (20 cases incl. fresh-device guard) |
| 6 | **P1** | Mobile drawer covered the header's menu button (un-toggleable on some widths) | `#mainNav` (z-300) sits in the z-310 `.header` stacking context, above the non-positioned button | `.menu-btn { position: relative; z-index: 320 }` inside `<=900px` | `audit-responsive.spec.ts` B section |
| 7 | **P2** | `?limit=abc` → 1524-row dump; `lesson=abc` → 500; `offset=-5` | `Number(x) \|\| default` passes negatives/NaN | Clamp `limit` 1–200, `lesson` ≤ 400 chars, `offset` ≥ 0 | `tests/api/questions.test.ts` |
| 8 | **P2** | Admin writes accepted raw bodies (unhandled 500, PUT reassigned `id`) | No body validation layer | `lib/admin-questions.ts` validates; `id`/`createdAt` stripped on PUT; error JSON not thrown | `tests/api/admin-questions.test.ts` |
| 9 | **P2** | `/quiz?count=-5` selected 85 questions; `time=-5` instant-submitted a 0-point exam | Same NaN/negative passthrough | Pure `clampInt` in `lib/quiz/pool.ts`, used for `count` (1–100) and `time` (1–180) | `tests/quiz/clamp.test.ts` (8 value assertions) |
| 10 | **P2** | `/api/ai/generate`: NaN lesson, float `correctAnswer`, malformed TF shape | Same class | Validation + 4-statement TF shape; `lesson` ≤ 400 | `tests/api/ai.test.ts` |
| 11 | **P2** | Hydration mismatch → pageerror on `/progress`, `/notebook`, `/vocab` | `useState(readAppState())` read localStorage on the first client render; SSR emitted empty | `useAppState` renders the default on first render, re-reads after mount; `BankView`/`VocabView` re-sync `starred` after mount (also fixed `/notebook` showing 0 items) | component tests + audit e2e |
| 12 | **P2** | 369 `short_answer` questions excluded from every pool → `/progress` denominators capped attainable progress at 50%/75.8% (N7) | Denominator counted questions no pool can return | `buildProgressCounts` counts pool-eligible questions only (consistent with `pool()`) | `tests/components/progress-view.test.ts` |
| 13 | **P2** | Unresolvable theory lesson rendered a "no content" panel with 200 | No `notFound()` on the dynamic route | `notFound()` | e2e 404 assertions |
| 14 | **P2** | `scoreExam([])` → NaN score; ResultView showed `NaN%`/`/0` (B09/B10); stale `ontap12-result` re-posted (B19) | Empty-pool arithmetic + no read-once | Guards + sessionStorage removal on first render; duplicate "Đề mới"/"Làm lại đề" buttons removed | `tests/quiz/scoring.test.ts`, `tests/components/result.test.tsx` |
| 15 | **P3** | `aria-controls` absent on the closed drawer trigger, drawer chip 1px high | base-ui library behavior + spacing | Verified library behavior / 1px tolerance, both documented with comments | in the B-section test |

Every fix was verified by the final whole-branch review (`task-6-review.md`) and the scoped
re-review of its fix wave (`task-6-rereview.md`): all findings ADDRESSED, no new breakage,
no assertion weakened.

## 3. UI / design-system findings

- **Design direction preserved**: the drawer fix is 2 lines of CSS, the duplicate-button fix is
  a removal, `notFound()` renders the existing 404 UI. No redesign anywhere.
- **Responsive**: 45 page × viewport combinations × 5 widths — zero horizontal overflow or
  clipping (the detector was self-checked against an injected defect to prove it is not vacuous).
- **Theme**: dark/light toggle persists across reload + navigation (3 navigations); 26 chip /
  badge / tag contrast measurements ≥ 3:1 in both themes.
- **A11y**: tab order + visible focus, keyboard quiz (1–4, ←/→), Escape closes drawer and
  dropdowns, 100% accessible names on icon buttons, real `<button>`/`<a>` semantics, labeled inputs.
- **Empty states**: all 4 (notebook, vocab, progress, bank search) render cleanly in both themes.
- Minor: drawer first link sits 1px above the header edge (tolerated, commented).

## 4. Test results (final run on the finished tree)

| Suite | Result |
|---|---|
| `bunx tsc --noEmit` | **exit 0**, no errors |
| `bunx vitest run` | **19 files, 155/155 passed** (baseline 140; +15 from this audit's fix-wave regressions) |
| `bunx playwright test` | **56/56 passed** (audit-flows 7/7, audit-routes 24/24, audit-responsive 9/9, responsive 16/16) |
| `bun run build` | **exit 0** — "✓ Compiled successfully" |

Smoke coverage added as `tests/e2e/audit-{routes,flows,responsive}.spec.ts`: 24 route sweeps
with console/pageerror/failed-request collection, 7 functional flow tests (practice, timed exam,
result review, progress persistence, notebook round-trip, bank filters, theory→quiz, vocab,
quick redirect), 9 responsive/theme/a11y suites. Dev-noise (`RSC` aborts, `performance.measure`)
is routed to separate *expected* arrays that are still persisted — nothing is silenced.

One flake, diagnosed and recorded: `responsive.spec.ts:72` (5 sequential `networkidle` gotos
under a 60s budget) timed out twice under load; it passes standalone in 43.9s and the route
serves in 0.37s, so it is a harness budget, not a product or test regression. The assertion is
untouched.

## 5. Remaining issues (status after the 2026-10-10 follow-up wave)

| Item | Status |
|---|---|
| Public `/api/questions` returns `correctAnswer`/`answer`/`statements` for all 1524 questions | **By design** (unchanged ruling). The legacy static site shipped the same answers in public JS and the bank UI publishes answers + explanations without login; gating breaks the offline-first, no-login product. Pinned by a real assertion: gating the answers fails the test by design (`audit-responsive.spec.ts`, `ruled: public …`). |
| 369 `short_answer` questions had no quiz UI (N7 root cause) | **RESOLVED 2026-10-10** — SA ported as a first-class type: pool includes SA, `TestConfig` checkbox unlocked, `#saIn` text input (accent-insensitive exact-match scoring, empty = skip), `serverRuntime` re-derives from the DB row, palette/review surfaces handle SA. +13 unit/API cases, +1 e2e flow. |
| Soft-404: `/xyz`, `/history/theory/99` returned 200 with 404 content | **RESOLVED 2026-10-10** — root/`[subject]`/`[lesson]` loading boundaries removed (they streamed a shell that committed 200 before `notFound()`); the home page keeps its skeleton via an in-page `<Suspense>`. Both paths now return a real **404** status + UI; the e2e pins assert 404. Cost: subject/theory/login pages render without a skeleton (header paints instantly, content pops in <1s). |
| `drizzle/meta/0002_snapshot.json` missing | **RESOLVED 2026-10-10** — snapshot created (identical table set to 0001; `prevId` chained) + a journal-chain drift-guard test. |
| Admin PUT with `{}` body → 500 instead of 400 | **RESOLVED 2026-10-10** — rejected as 400 ("Không có nội dung nào để cập nhật") with a regression test. |
| `/api/exam/submit` unbounded submitted-id array | **RESOLVED 2026-10-10** — capped at 100 (the quiz page's own max) with a regression test; the cap fires before the DB read. |
| `serverRuntime` matches options/statements by exact text | **Documented** — the assumption (unique option text per row, fail-open only on data the bank never contains) is now a written comment on `serverRuntime`. |
| Detector findings (`border-left:3px` accent, bounce easing, 2× `transition: width`, staggered vocab card delays) | **RESOLVED 2026-10-10** — callout border de-accented, flip easing is a clean ease-out quart, width transitions dropped (progress fills snap), vocabulary stagger removed. `impeccable detect` over the touched UI files: **0 findings**. |

## 6. Changed files

**Modified (30)**: `app/[subject]/theory/[lesson]/page.tsx` · `app/admin/page.tsx` ·
`app/admin/questions/[id]/edit/page.tsx` · `app/admin/questions/new/page.tsx` ·
`app/admin/questions/page.tsx` · `app/api/admin/questions/[id]/route.ts` ·
`app/api/admin/questions/route.ts` · `app/api/ai/generate/route.ts` ·
`app/api/exam/submit/route.ts` · `app/api/progress/sync/route.ts` · `app/api/questions/route.ts` ·
`app/quiz/page.tsx` · `app/result/page.tsx` · `components/ai/ExplainButton.tsx` ·
`components/bank/BankView.tsx` · `components/progress/ProgressView.tsx` ·
`components/result/ResultView.tsx` · `components/vocab/VocabView.tsx` ·
`drizzle/meta/_journal.json` · `lib/db/queries.ts` · `lib/quiz/pool.ts` · `lib/quiz/scoring.ts` ·
`lib/storage.ts` · `styles.css` · `vitest.config.ts` · `tests/api/ai.test.ts` ·
`tests/api/exam.test.ts` · `tests/api/progress.test.ts` · `tests/e2e/responsive.spec.ts` ·
`tests/quiz/scoring.test.ts`

**Added (16)**: `lib/admin-questions.ts` · `drizzle/0002_quiet_explain_logs.sql` ·
`scripts/apply-0002.mts` · `tests/admin/page-gates.test.ts` · `tests/api/admin-auth.test.ts` ·
`tests/api/admin-questions.test.ts` · `tests/api/questions.test.ts` ·
`tests/components/explain-button.test.tsx` · `tests/components/progress-view.test.ts` ·
`tests/components/result.test.tsx` · `tests/db/migrations.test.ts` · `tests/quiz/clamp.test.ts` ·
`tests/e2e/audit-flows.spec.ts` · `tests/e2e/audit-responsive.spec.ts` ·
`tests/e2e/audit-routes.spec.ts` · `docs/superpowers/plans/2026-10-09-full-product-audit.md`
