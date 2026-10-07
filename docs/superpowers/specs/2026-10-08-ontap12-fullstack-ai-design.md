# ÔnTập12 — Fullstack + AI Modernization Design Spec

> **Status:** Approved
> **Date:** 2026-10-08
> **Goal:** Transform the static vanilla SPA (`index.html` + `app.js` + `data/*.js`) into a fullstack Next.js 16 application with user sync, analytics, and AI features (test generation + answer explanation) — at **$0 cost** using free tiers.

## 1. Purpose & Success Criteria

### Intent
The current app is an offline-first educational SPA for Vietnamese grade-12 students. It works entirely in-browser with localStorage. The goal is to add:

1. **User accounts** — Google OAuth, sync progress across devices.
2. **Cloud persistence** — PostgreSQL on Neon (free tier: 10GB, 20M rows).
3. **AI features** — (a) AI-generated custom tests, (b) AI-powered answer explanations.
4. **Analytics / Weakness detection** — server-side aggregation of results.
5. **Admin panel** — manage questions, view stats (owner-only).

### Success Criteria
- ✅ All current features still work (offline-first with graceful degradation).
- ✅ User can sign in with Google, progress syncs to cloud, accessible from any device.
- ✅ AI test generation works within free-tier quota (Google AI Studio: 1000 req/day).
- ✅ $0 monthly cost in production (Vercel Hobby + Neon Free + Google AI free tier).
- ✅ Existing 748+ questions migrated to Postgres with no data loss.

## 2. Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| **Frontend framework** | Next.js 16 (App Router) | Industry standard, RSC + Server Actions, best Vercel integration |
| **UI library** | React 19 + TypeScript + Tailwind CSS + shadcn/ui | Type-safe, modern, accessible, fast styling |
| **Backend** | Next.js Route Handlers + Server Actions | Fullstack in one repo, no separate service needed |
| **Database** | PostgreSQL on Neon (serverless) | Serverless, free tier, scales, familiar SQL |
| **Auth** | NextAuth.js v5 (Google OAuth) | Self-hosted (free), no vendor lock-in on auth |
| **AI** | Google AI Studio (free tier: 1000 req/day) | Free quota sufficient for small educational site |
| **Deployment** | Vercel Hobby (free) | Free hosting, automatic from GitHub |
| **Styling** | Tailwind CSS | Modern utility-first CSS |

### Free Tier Budget Analysis
- **Vercel Hobby:** 100GB bandwidth, 15GB-hours, 125k invocations/day — adequate for a class-sized user base.
- **Neon Free:** 3 projects, 10GB storage, 20M rows — more than enough for 748 questions + user data.
- **Google AI Studio:** 1000 requests/day — ~30/day for ra-đề AI, ~20/day for giải-đáp AI, leaves headroom.
- **NextAuth.js:** Self-hosted, $0.

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Browser                               │
│  Next.js 16 Client (React 19) + Tailwind               │
│  localStorage (cache) + SessionStorage                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │   Home      │  │    Quiz     │  │   AI Features   │ │
│  │   Subject   │  │  (timer)    │  │  ra-đề / explain │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
└────────────────────────┬────────────────────────────────┘
                         │  HTTPS (API + Page Navigations)
┌────────────────────────▼────────────────────────────────┐
│                   Next.js Server                         │
│  (Vercel)                                                │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │ Route Handlers  │  │ Server Actions  │              │
│  │                 │  │                 │              │
│  │  /api/questions  │  │  saveProgress()  │              │
│  │  /api/exam       │  │  submitExam()    │              │
│  │  /api/progress   │  │  syncProgress()   │              │
│  │  /api/ai/*       │  │  ...              │              │
│  └─────────────────┘  └─────────────────┘              │
│                                                         │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │  lib/db.ts       │  │  lib/ai.ts      │              │
│  │  (Neon/Drizzle)  │  │  (Google AI)   │              │
│  └─────────────────┘  └─────────────────┘              │
└─────────────────────────────────────────────────────────┘
         │                          │
         ▼  SQL                    ▼  API calls
┌────────────────────┐   ┌──────────────────────┐
│   Neon Postgres    │   │  Google AI Studio     │
│   (Free Tier)      │   │  (Free: 1000 req/day) │
└────────────────────┘   └──────────────────────┘
```

### Key Patterns

#### 1. Offline-First with Graceful Degradation
- localStorage remains the primary cache (preserves existing UX).
- When user is **logged in**:
  - App writes to localStorage AND syncs to Postgres (debounced batch write).
  - On load: fetch cloud data, merge with local (cloud wins for conflicts, but preserve new local answers).
- When user is **anonymous**:
  - Works exactly as before (localStorage only).
  - Prompt to sign in to save progress to cloud.

#### 2. API Design (Route Handlers)
| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/auth/[...nextauth]` | GET/POST | Public | NextAuth.js OAuth flow |
| `/api/questions` | GET | Public | Paginated question list (for Bank view) |
| `/api/exam/start` | POST | Public* | Generate exam pool from DB |
| `/api/exam/submit` | POST | User | Save exam result, update progress |
| `/api/progress` | GET/PUT | User | Get/update user progress |
| `/api/admin/questions` | CRUD | Admin | Question management |
| `/api/ai/generate` | POST | User | Ra đề AI |
| `/api/ai/explain` | POST | User | Giải đáp AI |

#### 3. Data Access Layer
- `lib/db.ts` — Neon connection + Drizzle ORM
- `lib/db/queries.ts` — all SQL queries in one place
- `lib/ai.ts` — Google AI client wrapper (server-side only)

## 4. Database Schema

```sql
-- Questions table (migrated from data/*.js)
CREATE TABLE questions (
    id TEXT PRIMARY KEY,
    subject TEXT NOT NULL,           -- 'history' | 'biology' | 'chemistry' | 'english'
    lesson INTEGER NOT NULL,
    type TEXT,                       -- 'multiple_choice' | 'true_false' | 'cloze' | ...
    topic TEXT,
    difficulty TEXT,                 -- 'Nhận biết' | 'Thông hiểu' | 'Vận dụng' | 'Vận dụng cao'
    band REAL,                       -- English band score
    question TEXT NOT NULL,
    options TEXT[],                  -- 4 options for MCQ
    correct_answer INTEGER,          -- index of correct option
    statements JSONB,                -- true_false: [{text, is_correct}]
    explanation TEXT,
    wrong_word TEXT,
    correct_word TEXT,
    source TEXT,
    source_type TEXT,
    source_url TEXT,
    passage_id TEXT,
    created_at TIMESTAMP DEFAULT now()
);

-- Passages (cloze/reading)
CREATE TABLE passages (
    passage_id TEXT PRIMARY KEY,
    title TEXT,
    text TEXT
);

-- Theory content
CREATE TABLE theory (
    subject TEXT NOT NULL,
    lesson INTEGER NOT NULL,
    title TEXT,
    description TEXT,
    html TEXT,
    PRIMARY KEY (subject, lesson)
);

-- Vocabulary flashcards
CREATE TABLE vocabulary (
    unit TEXT NOT NULL,
    en TEXT NOT NULL,
    vi TEXT,
    pos TEXT,
    ipa TEXT,
    kind TEXT,             -- 'word' | 'phrase'
    PRIMARY KEY (unit, en)
);

-- User progress (synced from localStorage)
CREATE TABLE user_progress (
    user_id TEXT NOT NULL,           -- NextAuth user ID
    key TEXT NOT NULL,              -- 'answered', 'prog', 'starred', 'vocabKnown', 'best', 'exams', 'correct'
    value JSONB,
    updated_at TIMESTAMP DEFAULT now(),
    PRIMARY KEY (user_id, key)
);

-- Exam results (for analytics)
CREATE TABLE exam_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    subject TEXT,
    lesson TEXT,
    point REAL,
    ok INTEGER,
    wrong INTEGER,
    skip INTEGER,
    total INTEGER,
    time_seconds INTEGER,
    is_practice BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT now()
);

-- AI-generated tests (cache results to save quota)
CREATE TABLE ai_generated_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    criteria JSONB,                  -- {subject, lesson, count, difficulty, ...}
    questions JSONB,                 -- generated question objects
    created_at TIMESTAMP DEFAULT now(),
    expires_at TIMESTAMP             -- cache expiry (24h)
);
```

## 5. Feature Breakdown

### 5.1 User Sync (localStorage → Cloud)
**Migration flow:**
1. Anonymous user uses app → data in localStorage (existing behavior).
2. User clicks "Sign in" → Google OAuth via NextAuth.
3. First login: client POSTs localStorage data to `/api/progress` (merge).
4. Server: upsert all progress keys to `user_progress` table.
5. After sync: cloud is source of truth. Client fetches `/api/progress` on load.
6. Ongoing: changes debounced-write to cloud; localStorage updated as cache.

**Conflict resolution:** Cloud data wins (more authoritative across devices). If local has newer answers not yet synced, server merges per-key.

### 5.2 AI: Ra Đề AI (Generate Test)
- **Trigger:** User selects "AI Generate Test" in subject view → configures criteria (subject, lesson, count, difficulty, qtype).
- **Flow:**
  1. Client POST `{subject, lesson, count, difficulty}` to `/api/ai/generate`.
  2. Server checks cache (`ai_generated_tests`) — if cached and <24h old, return cached.
  3. Otherwise calls Google AI Studio with a prompt like:
     ```
     You are a high school teacher. Generate {count} multiple-choice questions about {subject} lesson {lesson} at {difficulty} level. Each question must have 4 options, one correct answer, and a brief explanation. Return JSON.
     ```
  4. Server validates JSON structure, saves to `ai_generated_tests`, returns to client.
  5. Client renders as a quiz (reuses existing Quiz component).

- **Free quota protection:** Cache results for 24h. Per-user rate limit (max 5 generations/day).

### 5.3 AI: Giải Đáp AI (Explain Answer)
- **Trigger:** In result review or practice mode, user clicks "AI Explain" on a question.
- **Flow:**
  1. Client POST `{question, options, correct_answer, user_answer, explanation}` to `/api/ai/explain`.
  2. Server calls Google AI Studio:
     ```
     Explain why the correct answer is correct and the user's answer is wrong. The question is: {question}
     ```
  3. Returns personalized explanation text.
- **Free quota protection:** Per-user rate limit (max 50 explains/day).

### 5.4 Analytics & Weakness Detection
- **Backend:** Compute aggregate stats server-side (faster than client-side JS).
- **Weak areas:** Query `exam_results` grouped by topic/difficulty, compute accuracy rates.
- **Endpoints:** `/api/analytics/wEAK` returns top 3 weak areas for a user.

### 5.5 Admin Panel
- **Access control:** NextAuth session `role` must be 'admin' (hardcode owner's email).
- **Features:** List/create/edit/delete questions, import JSON, view user stats.

## 6. Project Structure

```
ontap12/
├── app/                          # Next.js 16 App Router
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx          # Sign-in page
│   ├── (main)/
│   │   ├── layout.tsx            # App layout (header, footer)
│   │   ├── page.tsx              # Home page (hero, subject cards)
│   │   ├── [subject]/
│   │   │   └── [lesson]/
│   │   │       └── page.tsx      # Subject lesson view + test config
│   │   ├── quiz/
│   │   │   └── page.tsx          # Quiz (timer, options, navigation)
│   │   ├── result/
│   │   │   └── [id]/
│   │   │       └── page.tsx      # Result + review wrong answers
│   │   ├── bank/
│   │   │   └── page.tsx          # Question bank + filters
│   │   ├── vocab/
│   │   │   └── page.tsx          # Flashcards (flip, star, mode)
│   │   ├── progress/
│   │   │   └── page.tsx          # Progress + trends + history
│   │   ├── ai/
│   │   │   └── generate/
│   │   │       └── page.tsx      # AI test generation UI
│   │   └── admin/
│   │       └── page.tsx          # Admin panel (owner only)
│   └── api/
│       ├── auth/[...nextauth]/
│       │   └── route.ts          # NextAuth config
│       ├── questions/
│       │   └── route.ts          # Get questions (pagination, filters)
│       ├── exam/
│       │   ├── start/route.ts    # Generate exam pool
│       │   └── submit/route.ts   # Submit + score
│       ├── progress/
│       │   └── route.ts          # Get/merge sync
│       ├── analytics/
│       │   └── weak/route.ts     # Weakness detection
│       ├── admin/
│       │   └── questions/route.ts # Admin CRUD
│       └── ai/
│           ├── generate/route.ts  # Ra đề AI
│           └── explain/route.ts   # Giải đáp AI
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── layout/                   # Header, Footer, MobileNav
│   ├── theme-toggle.tsx          # Dark/light mode
│   ├── hero.tsx                  # Home hero section
│   ├── subject-card.tsx
│   ├── lesson-card.tsx
│   ├── quiz-view.tsx             # Full quiz logic (ported from app.js)
│   ├── question-card.tsx
│   ├── result-view.tsx
│   ├── bank-view.tsx
│   ├── flashcard.tsx
│   └── progress-view.tsx
├── lib/
│   ├── db.ts                     # Neon connection
│   ├── db/
│   │   ├── schema.ts             # Drizzle schema
│   │   └── queries.ts            # All SQL queries
│   ├── auth.ts                   # NextAuth config
│   ├── ai.ts                     # Google AI client wrapper
│   └── utils.ts                  # Helpers (esc, shuffle, etc.)
├── data/
│   ├── questions.json            # Extracted from data/*.js
│   ├── passages.json             # Questions with passages
│   ├── theory.json
│   ├── english-theory.json
│   └── vocab.json
├── scripts/
│   ├── extract-data.ts           # Convert existing JS data → JSON
│   └── seed.ts                   # JSON → Postgres
├── styles/
│   └── globals.css               # Tailwind base + custom CSS
├── drizzle.config.ts
└── package.json
```

## 7. Migration Strategy

### Phase 1: Extract Data
- Write `scripts/extract-data.ts` to parse existing `data/*.js` files (which set `window.QBANK`, `window.PASSAGES`, `window.THEORY`, etc.) and output clean JSON files.
- Verify data integrity (748+ questions, no duplicates).

### Phase 2: Scaffold Next.js Project
- `npx create-next-app@latest ontap12-next --typescript --tailwind --app`
- Set up Drizzle ORM + Neon connection.
- Port existing Tailwind/custom CSS to `globals.css`.

### Phase 3: Database + Seed
- Define Drizzle schema (`lib/db/schema.ts`).
- Run `scripts/seed.ts` to import JSON → Postgres.
- Verify row counts match.

### Phase 4: Core Pages (Port from app.js)
- Port the single-file `app.js` (700 lines) into React components:
  - Home page (hero, subject cards, lesson cards)
  - Subject view (config + lesson list)
  - Quiz view (timer, options, navigation, true/false)
  - Result view (score, review, weak analysis)
  - Bank view (filters, search)
  - Vocab (flashcards)
  - Progress (trends, history)
- Preserve all existing behavior (keyboard shortcuts 1-4, ←/→, beforeunload, etc.).

### Phase 5: Auth + Sync
- Add NextAuth.js with Google OAuth.
- Implement localStorage → DB sync on first login.
- Implement cloud-first mode after login.

### Phase 6: AI Features
- Set up Google AI Studio API key (env var).
- Implement `/api/ai/generate` (ra đề AI).
- Implement `/api/ai/explain` (giải đáp AI).
- Add cache layer to stay within free quota.

### Phase 7: Admin + Analytics
- Admin panel (owner-only access).
- Server-side analytics (weakness detection, progress trends).

### Phase 8: Deploy
- Connect to Vercel (deploy from GitHub).
- Set env vars (NEXTAUTH_URL, GOOGLE_CLIENT_ID, etc., DATABASE_URL from Neon).
- Update GitHub Actions workflow.

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Free tier AI quota insufficient | Cache all AI responses; per-user rate limits; fallback to existing question pool |
| Large vanilla JS logic hard to port | Port incrementally; keep app.js working in parallel until React version is complete |
| Data loss during migration | Verify row counts; keep original data/*.js files as backup |
| Vercel cold starts (AI latency) | AI calls go through server-side, acceptable latency for educational use |
| Google OAuth consent screen | Use "testing" mode initially, then publish for external users |

## 9. Non-Goals (YAGNI)

- ❌ No real-time multiplayer (not requested)
- ❌ No mobile app (PWA covers install use case)
- ❌ No CMS (admin panel + JSON import is sufficient)
- ❌ No separate mobile backend (Next.js API routes suffice)
- ❌ No CI/CD complexity (GitHub Actions + Vercel auto-deploy is enough)

## 10. Open Questions

1. **Admin access control:** Hardcode owner email, or use a role in the user table? (Spec leans: hardcode for simplicity.)
2. **PWA support:** Add service worker for offline-first? (Noted as future enhancement; current localStorage approach already covers basic offline.)
