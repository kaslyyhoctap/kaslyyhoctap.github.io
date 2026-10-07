# ÔnTập12 Fullstack Modernization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Goal:** Transform the static vanilla SPA into a fullstack Next.js 16 app with offline-first sync, AI test generation, AI answer explanation, analytics, and admin panel — at $0 cost.
>
> **Architecture:** Single monorepo Next.js 16 App Router. Frontend in React 19 Server Components + Client Components. Backend in Route Handlers + Server Actions. Neon Postgres as source of truth, localStorage as offline cache. Google AI Studio free tier for AI features.
>
> **Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui, Neon Postgres + Drizzle ORM, NextAuth.js v5, Google AI Studio, Vitest.
>
> **Spec:** `docs/superpowers/specs/2026-10-08-ontap12-fullstack-ai-design.md`
>
> **Executor note:** The existing `app.js` (700 lines vanilla) is the source of truth for current logic. Port incrementally, keeping old files as backup until React version is verified. Do NOT delete `index.html`/`app.js`/`styles.css`/`data/` until Phase 7 deploy succeeds.

## Global Constraints

- Next.js 16 (latest stable), React 19, TypeScript strict, Tailwind CSS 3.x
- Database: PostgreSQL on Neon (free tier connection string in `DATABASE_URL`)
- Auth: NextAuth.js v5, Google OAuth (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
- AI: Google AI Studio via `@google/generative-ai` (free tier: 1000 req/day), API key in `GOOGLE_AI_API_KEY`
- Deploy: Vercel Hobby (free), env vars via Vercel project settings
- $0 monthly cost: all services on free tiers
- Keep `data/*.js` files as-is until data is verified in Postgres
- shadcn/ui for UI primitives; Tailwind for styling (port existing `styles.css` values as CSS variables where needed)
- Tests: Vitest + @testing-library/react for components; pure-function unit tests for logic

## Review Focus

The five input classes or failure modes most likely to bite:

1. **Quiz pool logic edge cases** — `pool()`, `pickFresh()`, chemistry true_false mixing: wrong selection returns fewer questions than requested or duplicates. Test: `pool({subject:'chemistry', lesson:1, count:20})` returns unique IDs.
2. **localStorage ↔ cloud sync conflicts** — user answered on Device A (local only), logs in on Device B. Test: merge strategy preserves local answers not yet on cloud.
3. **AI prompt injection / malformed JSON** — Google AI returns non-JSON. Test: `/api/ai/generate` returns 400 with fallback message, never throws 500.
4. **Auth-required vs public routes** — exam start is public (anonymous can quiz), exam submit requires auth only if logged in. Test: anonymous POST `/api/exam/submit` succeeds (localStorage) but also stores in DB if session exists.
5. **Data migration completeness** — all 748+ questions survive JSON extraction and DB seed. Test: `SELECT COUNT(*) FROM questions` === questions parsed from `data/*.js`.

---

## Phase 0: Scaffolding & Toolchain

### Task 0.1: Initialize Next.js 16 project

**Files:**
- Create: `package.json`, `next.config.js`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`, `.env.example`
- Create: `app/layout.tsx`, `app/page.tsx`, `styles/globals.css`
- Create: `vitest.config.ts`, `vitest.setup.ts`
- Create: `.eslintrc.json`

**Interfaces:**
- Produces: Working Next.js 16 dev server (`npm run dev` → http://localhost:3000)

- [ ] **Step 1: Scaffold project**
  Run: `npm create next-app@latest . --ts --tailwind --eslint --src-dir --app --import-alias "@/*"` (answer prompts: yes to all, src dir yes)
  Delete generated `app/page.tsx` content (replace with placeholder).

- [ ] **Step 2: Add Vitest + RTL**
  `npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event happy-dom`

- [ ] **Step 3: Add shadcn/ui**
  `npx shadcn-ui@latest init` → select all UI primitives
  Verify: `components/ui/` directory created with button, card, etc.

- [ ] **Step 4: Add Drizzle + Neon + NextAuth + AI SDK**
  `npm install drizzle-orm @neondatabase/serverless better-auth @ai-sdk/react @ai-sdk/google`
  `npm install -D drizzle-kit`

- [ ] **Step 5: Verify dev server + tests**
  Run: `npm run dev` (expect server starts)
  Run: `npx vitest --version` (expect version output)

- [ ] **Commit: "chore: scaffold Next.js 16 toolchain"**

### Task 0.2: Configure environment + tooling

**Files:**
- Modify: `next.config.js` (add image domains, turbopack)
- Create: `.env.example` (copy: DATABASE_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_AI_API_KEY, NEXTAUTH_URL, NEXTAUTH_SECRET)
- Create: `.gitignore` (extend with `.env.local`, `.next/`, `node_modules/`)
- Modify: `tsconfig.json` (strict, path aliases `@/*`)

- [ ] **Step 1: Write `.env.example`** with all required vars from spec.
- [ ] **Step 2: Configure `drizzle.config.ts`** — Neon connection.
- [ ] **Step 3: Configure `next.config.js`** — `serverExternalPackages: ['@neondatabase/serverless', 'drizzle-orm']`.
- [ ] **Commit: "chore: configure env + tooling"**

---

## Phase 1: Data Layer (Extract → JSON → DB)

### Task 1.1: Extract existing data to JSON

**Files:**
- Create: `scripts/extract-data.mts`

**Interfaces:**
- Consumes: `data/*.js` files (global `window.QBANK`, `window.PASSAGES`, `window.THEORY`, `window.THEORY` keys, `window.VOCAB`)
- Produces: `data/questions.json`, `data/passages.json`, `data/theory.json`, `data/vocab.json`

**Approach:** These files are JS that set `globalThis.QBANK` etc. Use a script that loads each file in a sandbox, reads the globals, and writes JSON. Each data file looks like:
```js
window.QBANK = window.QBANK || [];
window.QBANK.push({id:"h1.1", subject:"history", lesson:1, ...})
```
So we need to exec the file in a fake `window` context.

- [ ] **Step 1: Write extract script**
  Use `vm` module to evaluate each `data/*.js` in a context with `window` stub. Collect `QBANK`, `PASSAGES`, `THEORY`, `ENGLISH_THEORY`, `VOCAB`. Write JSON files.
  ```
  // Extract all QBANK entries from data/*.js
  // Output: data/questions.json (array of question objects)
  ```

- [ ] **Step 2: Run + verify counts**
  Run: `npx tsx scripts/extract-data.mts`
  Verify: `questions.json` has ≥748 entries, `passages.json` has entries, `vocab.json` has entries.

- [ ] **Commit: "chore: extract data files to JSON"**

### Task 1.2: Drizzle schema + type definitions

**Files:**
- Create: `db/schema.ts` (Drizzle schema for all tables)
- Create: `lib/types.ts` (TypeScript types mirroring schema)
- Create: `db/index.ts` (Drizzle client + Neon connection)

**Interfaces:**
- Produces: `db` instance, typed `Schema` with `questions`, `passages`, `theory`, `vocabulary`, `user_progress`, `exam_results`, `ai_generated_tests`

**Approach:** Use Drizzle ORM with `@neondatabase/serverless`.

```ts
// db/schema.ts — exact column definitions
export const questions = pgTable('questions', {
  id: text('id').primaryKey(),
  subject: text('subject').notNull(),      // 'history'|'biology'|'chemistry'|'english'
  lesson: integer('lesson').notNull(),
  type: text('type'),
  topic: text('topic'),
  difficulty: text('difficulty'),
  band: real('band'),
  question: text('question').notNull(),
  options: text('options').array(),
  correctAnswer: integer('correct_answer'),
  statements: jsonb('statements'),
  explanation: text('explanation'),
  wrongWord: text('wrong_word'),
  correctWord: text('correct_word'),
  source: text('source'),
  sourceType: text('source_type'),
  sourceUrl: text('source_url'),
  passageId: text('passage_id'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

- [ ] **Step 1: Define all 7 tables** matching the spec schema (questions, passages, theory, vocabulary, user_progress, exam_results, ai_generated_tests).
  - Note: `user_progress.value` and `ai_generated_tests.questions` use `jsonb`.

- [ ] **Step 2: Write `lib/types.ts`** — export `Question`, `ExamResult`, `UserProgress` types.

- [ ] **Step 3: Write `db/index.ts`** — lazy singleton client:
  ```ts
  import { Pool } from '@neondatabase/serverless';
  import { drizzle } from 'drizzle-orm/neon-serverless';
  import * as schema from './schema';
  export const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL! }), { schema });
  ```

- [ ] **Commit: "db: schema + types + client"**

### Task 1.3: Seed script

**Files:**
- Create: `scripts/seed.mts`

**Interfaces:**
- Consumes: `data/questions.json`, `data/passages.json`, `data/theory.json`, `data/vocab.json`
- Produces: Seeded Postgres rows

- [ ] **Step 1: Write seed script** that inserts all JSON into respective tables (upsert by primary key).
- [ ] **Step 2: Add verification query** at end: logs row counts per table.
- [ ] **Step 3: Run + verify**
  Run: `npx tsx scripts/seed.mts`
  Verify: output shows `questions: 748` (or actual count), no errors.

- [ ] **Commit: "chore: seed script + data migration"**

---

## Phase 2: Auth + API Foundation

### Task 2.1: NextAuth.js + Google OAuth

**Files:**
- Create: `lib/auth.ts` (NextAuth config)
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `components/auth/sign-in.tsx` (Google sign-in button)
- Create: `lib/auth-utils.ts` (`getCurrentUser`, `requireAdmin`)

**Interfaces:**
- Produces: `GET/POST /api/auth/[...nextauth]`, `getCurrentUser()` returns `{ id, email, name, image } | null`

**Key decisions:**
- Use NextAuth.js v5 with Prisma/Neo adapter? No — use Drizzle adapter for Neon. Actually, use `better-auth` or NextAuth directly with database session in Postgres.
- Decision: NextAuth.js v5 with Drizzle adapter for Postgres sessions. Adapter: `@auth/drizzle-adapter`.
- Admin: hardcode owner email. Add `role` column to user via session callback.

- [ ] **Step 1: Add `@auth/drizzle-adapter`** → `npm install @auth/drizzle-adapter`
- [ ] **Step 2: Extend schema** with `user`, `session`, `account`, `verificationToken` tables (from adapter).
- [ ] **Step 3: Write auth config** in `lib/auth.ts`:
  ```ts
  import NextAuth from 'next-auth';
  import Google from 'next-auth/providers/google';
  import { DrizzleAdapter } from '@auth/drizzle-adapter';
  export const { auth, signIn, signOut } = NextAuth({
    adapter: DrizzleAdapter(db),
    providers: [Google({ clientId: process.env.GOOGLE_CLIENT_ID!, ... })],
    callbacks: {
      async session({ session, user }) {
        session.user.role = user.email === process.env.ADMIN_EMAIL ? 'admin' : 'user';
        session.user.id = user.id;
        return session;
      }
    }
  });
  ```

- [ ] **Step 4: Test** — `GET /api/auth/session` returns `{ user: null }` when no session. (Vitest: mock NextAuth, assert null.)

- [ ] **Commit: "feat: NextAuth + Google OAuth + admin role"**

### Task 2.2: Database query helpers

**Files:**
- Create: `lib/db/queries.ts` (all SQL query functions)

**Interfaces:**
- Consumes: `db` instance from `db/index.ts`
- Produces:
  - `getQuestions(opts: { subject?, lesson?, type?, difficulty?, topic?, limit?, offset? }): Promise<Question[]>`
  - `getQuestionById(id: string): Promise<Question | null>`
  - `getPassages(): Promise<Record<string, Passage>>`
  - `getTheory(subject: string, lesson: number): Promise<Theory | null>`
  - `getVocabulary(unit: string): Promise<Vocabulary[]>`
  - `saveUserProgress(userId: string, key: string, value: any): Promise<void>`
  - `getUserProgress(userId: string): Promise<Record<string, any>>`
  - `saveExamResult(result: ExamResultInput): Promise<void>`
  - `getUserExamResults(userId: string, limit?: number): Promise<ExamResult[]>`
  - `getWeakAreas(userId: string): Promise<WeakArea[]>`
  - `getAdminQuestions(filters): Promise<Question[]>`

Each function uses Drizzle ORM queries against the typed schema.

- [ ] **Step 1: Implement read queries** (`getQuestions`, `getQuestionById`, `getPassages`, `getTheory`, `getVocabulary`).
- [ ] **Step 2: Implement write queries** (`saveUserProgress`, `getUserProgress`, `saveExamResult`, `getUserExamResults`).
- [ ] **Step 3: Implement analytics query** (`getWeakAreas` — groups by topic/topic+difficulty, computes accuracy, returns worst 3).
- [ ] **Step 4: Test** — `getQuestionById('h1.1')` returns question with non-null fields.

- [ ] **Commit: "feat: database query layer"**

---

## Phase 3: Core UI Components (port from app.js)

### Task 3.1: Shared layout + navigation

**Files:**
- Modify: `app/layout.tsx` (Header, Footer, ThemeProvider)
- Create: `components/layout/Header.tsx`
- Create: `components/layout/MobileNav.tsx`
- Create: `components/ui/theme-toggle.tsx` (port from `themeBtn`)
- Create: `lib/theme.tsx` (ThemeProvider + `useTheme`)

**Interfaces:**
- Port: Header (logo, nav buttons, theme toggle, mobile menu)
- Theme: use CSS `data-theme="light|dark"` (same as existing)

- [ ] **Step 1: Write `lib/theme.tsx`** — React Context provider that reads/writes localStorage key `ontap12-theme`.
- [ ] **Step 2: Write `components/layout/Header.tsx`** — desktop 1-line nav, mobile 2-line (menu button + overlay).
- [ ] **Step 3: Write `components/ui/theme-toggle.tsx`** — toggle button with sun/moon icons (Phosphor icons).
- [ ] **Step 4: Test** — Theme toggle switches `data-theme` attribute. (RTL: render toggle, click, assert html dataset)

- [ ] **Commit: "feat: shared layout + theme + navigation"**

### Task 3.2: Home page

**Files:**
- Create: `app/page.tsx` (Home view)
- Create: `components/home/Hero.tsx`
- Create: `components/home/SubjectCard.tsx`
- Create: `components/home/LessonCard.tsx`
- Create: `components/home/StudyGuide.tsx` (the "Cách học hiệu quả" panel)

**Interfaces:**
- Consumes: `getQuestions()`, `getTheory()`, `getVocabulary()` queries
- Produces: Home page with hero stats, subject cards, lesson cards

Port logic from `renderHome()` in `app.js` (lines 63-80). Key data: subject cards show question count + progress %, lesson cards show theory + "Học lý thuyển" / "Luyện ngay" buttons.

- [ ] **Step 1: Write `Hero.tsx`** — eyebrow, h1, subtitle, 4 CTA buttons, stats block.
- [ ] **Step 2: Write `SubjectCard.tsx`** + `LessonCard.tsx`.
- [ ] **Step 3: Write `app/page.tsx`** — Server Component fetching data via `getQuestions()`, `getTheory()`, passing to client components.
- [ ] **Step 4: Test** — Home page renders 4 subject cards with correct names. Mock `getQuestions` to return known data.

- [ ] **Commit: "feat: home page (hero, subjects, lessons)"**

### Task 3.3: Subject view

**Files:**
- Create: `app/[subject]/page.tsx` (Subject overview)
- Create: `app/[subject]/[lesson]/page.tsx` (Individual lesson)
- Create: `components/subject/TestConfig.tsx` (question count/time/lesson/level/type/shuffle)
- Create: `components/subject/LessonList.tsx`

**Interfaces:**
- Consumes: `META` config (port from app.js lines 9-14), `getQuestions()`

Port: `renderSubject()` (lines 90-103), `collectCfg()` (line 105), `cfgStart`/`cfgPractice` handlers.

- [ ] **Step 1: Define `META` constant** in `lib/constants.ts` (subjects, lesson names, book names).
- [ ] **Step 2: Write `TestConfig.tsx`** — selects for count/time/lesson/level/type, checkboxes for shuffle, buttons: "Bắt đầu làm bài" / "Luyện tập".
- [ ] **Step 3: Write `app/[subject]/page.tsx`** — server component fetching questions, rendering lesson cards + config.
- [ ] **Step 4: Test** — English subject shows type filter row; other subjects hide it.

- [ ] **Commit: "feat: subject view + test config"**

### Task 3.4: Theory view

**Files:**
- Create: `components/subject/TheoryView.tsx`

Port `renderTheory()` (lines 111-114). Shows theory HTML from DB.

- [ ] **Step 1: Write `TheoryView.tsx`** — renders theory HTML with sanitize.
- [ ] **Step 2: Test** — Theory title renders from DB data.

- [ ] **Commit: "feat: theory view"**

### Task 3.5: Quiz view (THE COMPLEX ONE)

This is the largest port. The original `app.js` has ~150 lines of quiz logic (`pool()`, `startExam()`, `renderQ()`, `submit()`, `tick()`).

**Files:**
- Create: `app/quiz/page.tsx`
- Create: `lib/hooks/useQuiz.ts` (custom hook encapsulating all quiz logic)
- Create: `components/quiz/QuizView.tsx` (main client component)
- Create: `components/quiz/QuestionCard.tsx`
- Create: `components/quiz/Options.tsx`
- Create: `components/quiz/TrueFalseGrid.tsx`
- Create: `components/quiz/Timer.tsx`
- Create: `components/quiz/QuestionPalette.tsx`
- Create: `components/quiz/QuizNav.tsx`

**Interfaces:**
- `useQuiz(cfg: ExamConfig)` returns:
  ```ts
  interface ExamConfig {
    subject: string; lesson: string | number; count: number; time: number;
    level?: string; qtype?: string; practice: boolean; ids?: string[];
    shQ?: boolean; shA?: boolean; quick?: boolean;
  }
  interface QuizState {
    qs: Question[];     // selected questions
    ans: number[];      // answers (-1 = unanswered)
    flag: boolean[];    // flagged for review
    i: number;          // current index
    practice: boolean;
  }
  ```
- Produces: `useQuiz` hook with `start()`, `answer(i)`, `next()`, `prev()`, `flag()`, `submit()`, `timeLeft`, `progress`.

**Approach:** Extract the pure logic (pool selection, scoring) into testable functions. The `pool()` function (lines 121-152) is the most complex — port it faithfully, then add unit tests.

- [ ] **Step 1: Write `lib/quiz/pool.ts`** — pure function `pool(questions: Question[], opts: ExamConfig): Question[]` (port lines 121-152).
  - Test data: `pool(CHEM_QUESTIONS, {subject:'chemistry',lesson:1,count:20,...})` returns ≤20 unique IDs, includes true_false if available.
- [ ] **Step 2: Write `lib/quiz/scoring.ts`** — `scoreExam(qs, ans, cfg): ExamScore` (port submit logic lines 238-301).
  - Test: a 3-correct/2-wrong exam returns `ok:3, bad:2, point:6.0`.
- [ ] **Step 3: Write `lib/hooks/useQuiz.ts`** — state management + timer + answer/star/flag.
- [ ] **Step 4: Write `QuestionCard.tsx`, `Options.tsx`, `TrueFalseGrid.tsx`** — UI components.
- [ ] **Step 5: Write `QuizView.tsx`** — ties hook + components together. Keyboard shortcuts (1-4, ←/→).
- [ ] **Step 6: Write `app/quiz/page.tsx`** — Server Component that receives config (from URL params or Server Action), calls `startExam` API or builds pool client-side from preloaded questions.

- [ ] **Commit: "feat: quiz view (port pool + scoring + UI)"**

### Task 3.6: Result view

**Files:**
- Create: `app/result/[id]/page.tsx`
- Create: `components/result/ResultView.tsx`
- Create: `components/result/ResultReview.tsx`

Port `submit()` result rendering (lines 261-300) + review list (lines 281-294).

- [ ] **Step 1: Write `ResultView.tsx`** — score display, verdict, stats grid (ok/bad/skip/time), topic/type breakdown.
- [ ] **Step 2: Write `ResultReview.tsx`** — per-question review with correct/incorrect highlighting, AI "Explain" button per question.
- [ ] **Step 3: Test** — `scoreExam()` output matches expected verdict labels ("Cần cố gắng" / "Đạt" / "Tốt" / "Xuất sắc").

- [ ] **Commit: "feat: result view + review"**

### Task 3.7: Bank view

**Files:**
- Create: `app/bank/page.tsx`
- Create: `components/bank/BankView.tsx`
- Create: `components/bank/BankFilters.tsx`
- Create: `components/bank/BankItem.tsx`

Port `renderBank()` (lines 310-326).

- [ ] **Step 1: Write `BankFilters.tsx`** — subject/lesson/difficulty/type/state/search filters.
- [ ] **Step 2: Write `BankItem.tsx`** — collapsible details with options + explanation.
- [ ] **Step 3: Write `BankView.tsx`** — fetches questions via API or server props, filters client-side.
- [ ] **Commit: "feat: question bank view"**

### Task 3.8: Vocabulary / Flashcard view

**Files:**
- Create: `app/vocab/page.tsx`
- Create: `components/vocab/Flashcard.tsx`
- Create: `components/vocab/VocabGrid.tsx`
- Create: `components/vocab/VocabControls.tsx`

Port `renderVocab()` + flashcard logic (lines 330-403). The 3D flip animation requires CSS `transform-style: preserve-3d` — port from `styles.css` lines 229-242.

- [ ] **Step 1: Write `Flashcard.tsx`** — flip animation on click, ARIA labels, next/prev/know/star buttons.
- [ ] **Step 2: Write `VocabGrid.tsx`** — grid of vocab cards with flip-on-click.
- [ ] **Step 3: Write `VocabControls.tsx`** — unit selector, kind/mode toggle, shuffle, star-only, hide-all.
- [ ] **Commit: "feat: vocabulary flashcard view"**

### Task 3.9: Progress view

**Files:**
- Create: `app/progress/page.tsx`
- Create: `components/progress/ProgressView.tsx`
- Create: `components/progress/WeaknessAnalysis.tsx`
- Create: `components/progress/TrendChart.tsx`

Port `renderProgress()` + `renderTrend()` + `renderWeak()` (lines 448-463).

- [ ] **Step 1: Write `TrendChart.tsx`** — progress bars from exam history (last 14).
- [ ] **Step 2: Write `WeaknessAnalysis.tsx`** — calls `getWeakAreas()`, renders 10c/luyện buttons.
- [ ] **Step 3: Write `ProgressView.tsx`** — subject progress cards + history list.
- [ ] **Step 4: Test** — `weakStats()` function returns sorted array, worst first.

- [ ] **Commit: "feat: progress + analytics view"**

### Task 3.10: Toast + global event handlers

**Files:**
- Create: `components/ui/Toast.tsx`
- Create: `components/ui/SkipLink.tsx`

Port toast (line 29) and skip link (line 14).

- [ ] **Commit: "feat: toast + skip link"**

---

## Phase 4: API Routes (Backend)

### Task 4.1: Exam API

**Files:**
- Create: `app/api/exam/start/route.ts`
- Create: `app/api/exam/submit/route.ts`
- Create: `lib/api/exam.ts` (shared logic)

**Interfaces:**
- `POST /api/exam/start` — body: `{subject, lesson, count, time, level, qtype, shQ, shA, practice, quick, ids?}` → returns `{questions: Question[], examId: string}`.
  Logic: calls `pool()` with DB questions. For anonymous: return questions (client manages state). For auth: also create a draft exam record.
- `POST /api/exam/submit` — body: `{examId, answers, flags, timeSec, cfg}` → returns `{point, ok, bad, skip, wrongIds[]}`.
  Logic: calls `scoreExam()`, saves to `exam_results` if user is logged in, updates `user_progress`.

- [ ] **Step 1: Write `app/api/exam/start/route.ts`** — fetch questions, build pool, return.
- [ ] **Step 2: Write `app/api/exam/submit/route.ts`** — score, save results, update progress.
- [ ] **Step 3: Test** — POST `/api/exam/start` with `{subject:'history',lesson:1,count:10}` returns 10 unique questions.
- [ ] **Commit: "feat: exam API routes"**

### Task 4.2: Progress sync API

**Files:**
- Create: `app/api/progress/route.ts`
- Create: `lib/hooks/useProgressSync.ts`

**Interfaces:**
- `GET /api/progress` — returns user's full progress object (merged from DB + localStorage if anonymous).
- `PUT /api/progress` — body: `{key, value}` — saves a progress key for the logged-in user. Debounced.
- `POST /api/progress/sync` — body: `{localStorageData}` — initial sync on first login. Server merges.

**Merge strategy:** For each key (`answered`, `prog`, `starred`, `vocabKnown`, `best`, `exams`, `correct`):
- Cloud value and local value are objects/maps.
- Merge: take union of keys; for each key, if cloud timestamp > local, use cloud; else use local.
- Save merged result to cloud.

- [ ] **Step 1: Write `app/api/progress/route.ts`** (GET, PUT, POST/sync).
- [ ] **Step 2: Write `useProgressSync.ts`** — React hook that auto-syncs localStorage to cloud on auth change.
- [ ] **Step 3: Test** — merge strategy: local has `{"q1":"ok"}` cloud has `{"q2":"bad"}` → merged = `{"q1":"ok", "q2":"bad"}`.

- [ ] **Commit: "feat: progress sync API + hook"**

### Task 4.3: Questions API (for Bank + Admin)

**Files:**
- Create: `app/api/questions/route.ts`

**Interfaces:**
- `GET /api/questions?subject=history&lesson=1&type=&difficulty=` — paginated list.

- [ ] **Step 1: Write route with pagination** (limit 50, offset param).
- [ ] **Commit: "feat: questions API"**

---

## Phase 5: AI Features

### Task 5.1: Google AI client

**Files:**
- Create: `lib/ai/client.ts`
- Create: `.env.example` (add `GOOGLE_AI_API_KEY`)

```ts
// lib/ai/client.ts
import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });
export { ai };
```

- [ ] **Step 1: Install `@google/genai`** → `npm install @google/genai`
- [ ] **Step 2: Write `lib/ai/client.ts`** — singleton, only on server.
- [ ] **Commit: "feat: AI client setup"**

### Task 5.2: Ra đề AI (generate test)

**Files:**
- Create: `app/api/ai/generate/route.ts`
- Create: `lib/ai/prompts.ts` (PROMPT_GENERATE_TEST)
- Create: `components/ai/AiGenerateForm.tsx`
- Create: `app/ai/generate/page.tsx`

**Interfaces:**
- `POST /api/ai/generate` — body: `{subject, lesson, count, difficulty?}` → returns `{questions: Question[]}`.
- Rate limit: max 5 generations per user per day (store in `ai_generated_tests` table or a simple counter in `user_progress`).
- Cache: check `ai_generated_tests` for identical criteria within 24h.
- Fallback: if AI fails or quota exceeded, return `{ error: "AI hết lượt, vui lòng thử sau", fallback: true }` and client falls back to DB pool.

Prompt template (`/lib/ai/prompts.ts`):
```
You are a Vietnamese high school teacher for grade 12. Generate {count} multiple-choice questions about {subject_name} {unit_label}. 
Level: {difficulty}. Each question must follow this exact JSON format:
{ "questions": [{"id": "ai-{subject}-{timestamp}-{n}", "subject": "{subject}", "lesson": {lesson}, "type": "multiple_choice", "topic": "string", "difficulty": "{difficulty}", "question": "string", "options": ["A","B","C","D"], "correctAnswer": 0, "explanation": "string"}] }
Return ONLY valid JSON.
```

- [ ] **Step 1: Write `PROMPT_GENERATE_TEST`** in `lib/ai/prompts.ts` with all subject/difficulty mappings.
- [ ] **Step 2: Write `app/api/ai/generate/route.ts`** — calls AI, validates JSON, saves to cache.
- [ ] **Step 3: Write `AiGenerateForm.tsx`** — form with subject/lesson/count/level, submit button.
- [ ] **Step 4: Write `app/ai/generate/page.tsx`** — wraps form, handles response, starts quiz with generated questions.
- [ ] **Step 5: Test** — mock `@google/genai`, assert route returns 400 on non-JSON response and 200 with valid questions on success.

- [ ] **Commit: "feat: AI test generation (ra đề AI)"**

### Task 5.3: Giải đáp AI (explain answer)

**Files:**
- Create: `app/api/ai/explain/route.ts`
- Create: `lib/ai/prompts.ts` (add PROMPT_EXPLAIN)
- Create: `components/ai/ExplainButton.tsx`

**Interfaces:**
- `POST /api/ai/explain` — body: `{question, options, correctAnswer, userAnswer, explanation?}` → returns `{explanation: string}`.
- Rate limit: max 50 explains per user per day.
- Used in: Result review (each question has "AI Explain" button), Practice mode (show explanation).

Prompt template:
```
The user answered a quiz question incorrectly. Explain why the correct answer is correct and why the user's answer is wrong. Be brief and clear for a high school student.
Question: {question}
Options: A) {opt0} B) {opt1} C) {opt2} D) {opt3}
Correct: {correct_label}
User chose: {user_label}
```

- [ ] **Step 1: Write `PROMPT_EXPLAIN`** in `lib/ai/prompts.ts`.
- [ ] **Step 2: Write `app/api/ai/explain/route.ts`** — calls AI, returns text.
- [ ] **Step 3: Write `ExplainButton.tsx`** — button that shows loading → explanation inline.
- [ ] **Step 4: Test** — route returns 200 with explanation text, 429 on rate limit.

- [ ] **Commit: "feat: AI answer explanation (giải đáp AI)"**

---

## Phase 6: Admin Panel

### Task 6.1: Admin layout + guard

**Files:**
- Create: `app/admin/layout.tsx` (role guard)
- Create: `app/admin/page.tsx` (dashboard)

**Interfaces:**
- `/admin/*` requires `session.user.role === 'admin'`.
- Non-admin → redirect to `/login`.

- [ ] **Step 1: Write `app/admin/layout.tsx`** — `requireAdmin()` check, redirect if not.
- [ ] **Step 2: Write basic admin dashboard** — question count, user count, recent exams.
- [ ] **Commit: "feat: admin layout + guard"**

### Task 6.2: Question CRUD

**Files:**
- Create: `app/admin/questions/page.tsx`
- Create: `app/admin/questions/[id]/edit/page.tsx`
- Create: `app/api/admin/questions/[id]/route.ts`

**Interfaces:**
- `GET /admin/questions` — list with filters
- `POST /api/admin/questions` — create
- `PUT /api/admin/questions/[id]` — update
- `DELETE /api/admin/questions/[id]` — delete

- [ ] **Step 1: Write API routes** (GET list, POST create, PUT update, DELETE).
- [ ] **Step 2: Write admin UI** — table of questions with edit/delete buttons + create form.
- [ ] **Commit: "feat: admin question CRUD"**

---

## Phase 7: Offline-First + Deploy

### Task 7.1: Offline-first strategy + Service Worker

**Files:**
- Create: `lib/sync/offlineStore.ts` (localStorage wrapper matching schema)
- Modify: All views to read from localStorage first, then sync to cloud
- Create: `app/manifest.json` (PWA manifest)

**Strategy:**
- Anonymous: localStorage only (exact current behavior).
- Logged in: write to localStorage + background sync to DB.
- `useProgressSync.ts` handles the dual-write.

- [ ] **Step 1: Write `offlineStore.ts`** — typed get/set/delete matching `S` shape from app.js (theme, best, exams, correct, answered, marked, hist, prog, vocabKnown, starred).
- [ ] **Step 2: Integrate into quiz/result flows** — answers written to localStorage immediately, synced to cloud in background.
- [ ] **Step 3: Write `manifest.json`** + register in layout.
- [ ] **Commit: "feat: offline-first sync + PWA manifest"**

### Task 7.2: Migrate CSS

**Files:**
- Modify: `styles/globals.css` — convert `styles.css` to Tailwind-compatible (import existing CSS as base, add Tailwind directives).

The existing `styles.css` has ~310 lines of well-designed CSS. Approach: keep it, add Tailwind for new components, use `@layer` merge.

- [ ] **Step 1: Add `@tailwind base; @tailwind components; @tailwind utilities;` to `globals.css`.**
- [ ] **Step 2: Import existing `styles.css` in `globals.css` (prepend).**
- [ ] **Step 3: Replace icon SVGs with Phosphor icons** (`@phosphor-icons/react`).
- [ ] **Commit: "chore: migrate styles to Tailwind + shadcn"**

### Task 7.3: Finalize + Deploy

**Files:**
- Modify: `.github/workflows/deploy.yml` (if keeping GH Actions) or set up Vercel integration
- Modify: `next.config.js` (production optimizations)

- [ ] **Step 1: Set up Neon project** (free tier) → get `DATABASE_URL`.
- [ ] **Step 2: Set up Vercel project** → connect GitHub repo, add env vars.
- [ ] **Step 3: Run `npx drizzle-kit push`** to create tables in Neon.
- [ ] **Step 4: Run `npx tsx scripts/seed.mts`** to seed data.
- [ ] **Step 5: Deploy!** `git push origin main` → Vercel auto-deploys.
- [ ] **Step 6: Update README.md** with new setup/deploy instructions.
- [ ] **Step 7: Verify:** site loads, sign in with Google, quiz works, AI explain works, $0 cost.
- [ ] **Commit: "deploy: Next.js 16 fullstack on Vercel + Neon"**

---

## Execution Order Summary

```
Phase 0: [0.1, 0.2]    → Working dev environment
Phase 1: [1.1, 1.2, 1.3] → Data in Postgres + typed schema
Phase 2: [2.1, 2.2]    → Auth works, query layer ready
Phase 3: [3.1–3.10]    → All 8 views ported to React
Phase 4: [4.1, 4.2, 4.3] → API routes
Phase 5: [5.1, 5.2, 5.3] → AI features
Phase 6: [6.1, 6.2]    → Admin panel
Phase 7: [7.1–7.3]     → Deploy
```

**Total tasks:** 27
**Estimated complexity:** Large (architectural)
**Riskiest file:** `lib/quiz/pool.ts` (faithful port of complex selection logic)

## Verification Milestones

- **M1 (after Task 1.3):** `questions.json` has ≥748 entries; `seed.mts` runs without error.
- **M2 (after Task 2.1):** `GET /api/auth/session` returns `{user: null}` for anonymous.
- **M3 (after Task 3.5):** Quiz pool logic returns correct question types for each subject (unit test).
- **M4 (after Task 5.2):** AI generate endpoint returns valid JSON or graceful fallback.
- **M5 (after Task 7.3):** Site live on Vercel, sign-in + quiz + AI all work, $0 on all free tiers.