# SkillPilot Engineering Progress Log

## 1. Executive Summary

SkillPilot has been upgraded from an unstable prototype to a robust, accessible, secure, and production-ready career operating system. All 10 engineering phases have been executed autonomously, and all automated test suites (unit, database integration, API integration, full browser end-to-end, and production build) pass with 100% success.

---

## 2. Baseline State & Initial Investigation (Phase 1)

- **Repository State**: Clean baseline established from `skillpilot-final`. Git repository initialized with `pre-finish-checkpoint`.
- **Environment & Database**: Connected to remote PostgreSQL database on Neon (`ep-lively-shadow-b34o5ybf-pooler.c-4.ap-southeast-1.aws.neon.tech`). All 22 tables verified, append-only trigger active, migrations 002–006 verified and applied cleanly.
- **Initial Verification**:
  - `npm --prefix apps/web run typecheck`: Passed (TypeScript 5.7.3 strict).
  - `npm --prefix apps/web test`: Initial 33 unit tests passed.
  - `npm --prefix apps/web run api:integration`: Initial API integration suite passed.

---

## 3. Root Cause Analysis & Fixes: Adaptive Assessment (Phase 2 - Top Priority)

### Root Causes Discovered
1. **React StrictMode Double-Mount Contention**:
   - `next.config.mjs` enables `reactStrictMode: true`.
   - In development, `Assess.tsx`'s `useEffect` runs twice concurrently on mount.
   - The route handler enforced a tight rate limit of 3 requests per hour (`dbRateLimit('assess-start:user:${u.id}', 3, 3600000)`).
   - Re-navigating or remounting rapidly tripped this limit, returning HTTP 429 or causing concurrency contention.
2. **Database Connection Pool Exhaustion in Transactions**:
   - Inside `tx(async (c) => { ... })` in `assess/start/route.ts`, `dbRateLimit` called `db().query(...)` which acquired a *second* pooled connection rather than using the existing transactional client `c`. Under concurrent requests, pool exhaustion occurred, stalling queries until connection timeout.
3. **Fragile UI Error Handling**:
   - `Assess.tsx` caught any network delay, abort, JIT compile pause, or server error and rendered the raw `e.message` ("Failed to fetch") alongside "SERVER CHECK FAILED / Your evidence was not changed".
   - Progressive answers were lost on submit error.

### Implementations & Fixes
- **`apps/web/lib/guard.ts`**:
  - Added `QueryRunner` interface to accept an optional transactional `client`.
  - When `client` is provided to `dbRateLimit`, queries execute on the existing connection rather than checking out a new pool connection.
- **`apps/web/app/api/assess/start/route.ts`**:
  - Made assessment resumption resilient.
  - Relaxed rate limit to 10 starts/hr and passed transactional client `c`.
  - Added robust prompt parsing for JSON and object structures.
- **`apps/web/app/api/assess/submit/route.ts`**:
  - Added full idempotency: retries of the same answer choice safely return the current question or completed results rather than failing with 409 Conflict.
- **`apps/web/components/Assess.tsx`**:
  - Added `fetchWithRetry` with exponential backoff (2 attempts, 400ms base delay).
  - Replaced raw error text with human-friendly guidance.
  - Implemented non-destructive inline retry on answer submission (question and picked choice are preserved).
  - Added keyboard navigation (A/B/C/D, 1/2/3/4, Enter).
  - Added accessible progress indicator (`QUESTION X OF Y`), resume banner, and rich diagnostic results breakdown (strengths and priority gaps).

---

## 4. Backend Reliability, Data Integrity & Migrations (Phase 3 & Phase 10)

- **Native Env Loading**: Updated `scripts/migrate.mjs`, `scripts/bootstrap-admin.mjs`, and `scripts/db-integration.mjs` with native `process.loadEnvFile` fallback so all npm scripts run standalone without failing on missing `DATABASE_URL`.
- **Database Migrations**: Migrations 002 through 006 verified and applied cleanly via `migrate.mjs`.
- **Safe Test Isolation**: `scripts/db-integration.mjs` and `scripts/e2e-workflow.mjs` execute test account cleanup using `set skillpilot.allow_account_delete = 'on'`, respecting the production append-only trigger constraint while guaranteeing test isolation.

---

## 5. Security & Authentication Audit (Phase 4)

- **Password Policy**: Enforced 12–72 UTF-8 bytes with bcrypt hashing (work factor 12).
- **Session Security**: Cryptographically signed HMAC-SHA256 session tokens with `httpOnly`, `sameSite=lax`, and secure cookies in production.
- **CSRF & Origin Verification**: Strict `requireOrigin` check on all state-mutating POST/PATCH/DELETE endpoints.
- **Privilege Separation**: Role-based access control strictly enforced on `/api/admin/*` and `/api/mentor/*`.
- **Environment Safety**: `.env.example` contains only non-sensitive placeholder variable names; actual credentials remain Git-ignored in `.env.local`.

---

## 6. UI/UX Redesign & Accessibility (Phases 5 & 6)

- **Color Palette & Visual Foundation**:
  - Deep indigo/navy foundation (`#0F172A`)
  - Warm orange primary action (`#EA580C`)
  - Cyan highlights (`#0891B2`)
  - Clean neutral surfaces with strict WCAG AA contrast (minimum 4.5:1 text contrast).
- **Accessibility Enhancements**:
  - Added Skip to Content link (`<a href="#main-content" className="skip-link">`) in `apps/web/app/layout.tsx`.
  - Added `id="main-content"` across `App.tsx`, `MentorWorkspace.tsx`, and `AdminWorkspace.tsx`.
  - Full keyboard accessibility and focus rings (`:focus-visible`).
  - Minimum 44px touch targets across all interactive buttons.
  - `prefers-reduced-motion` media query to disable heavy transitions for sensitive users.
- **Responsive Layout Verification**:
  - Zero horizontal overflow (`scrollWidth <= clientWidth`) verified across all standard viewports: 320px, 375px, 768px, 1024px, and 1440px.
- **Custom Error Boundaries**:
  - Created `apps/web/app/not-found.tsx` (accessible 404 page).
  - Created `apps/web/app/error.tsx` (component-level error boundary with retry).
  - Created `apps/web/app/global-error.tsx` (root-level fallback error boundary).

---

## 7. Roadmap Engine & Adaptive Logic (Phases 8 & 9)

- **Topological Dependency Ordering**: Implemented `SKILL_PREREQUISITES`, `CAREER_GOALS`, `getCareerGoal`, and `resolveSkillOrder` in `apps/web/lib/engine.ts` with cycle-breaking to prevent infinite loops.
- **Prerequisite Priority Boosting**: If a foundational prerequisite is weak, dependent actions are deprioritized until the prerequisite is satisfied.
- **Comprehensive Unit Testing**: Added 9 new unit test suites in `apps/web/lib/engine.test.ts` covering:
  - Empty assessments & default actions
  - Strong skillsets
  - Unknown career goals (graceful fallback)
  - Missing skill dependencies
  - Circular skill dependencies
  - Task completion retention
  - Reassessment triggers & readiness updates
  - Total test count expanded from 33 to 42 tests.

---

## 8. Friendly Future Visual Identity & Student Capability Onboarding

- **Friendly Future Visual Tokens**:
  - Main background: `#2D276F` (deep indigo throughout the entire application shell and pages)
  - Dark navy surface: `#211D52` (cards, sidebars, modals)
  - Secondary indigo surface: `#38347F` (inner blocks, chips, action items)
  - Primary action: `#FF7A00` (bold orange action buttons and highlights)
  - Cyan micro-accent: `#00F0FF` (focus rings, tags, live indicators)
  - Primary text: `#FFFFFF`, Secondary text: `#D5D5E8`
- **Minimal Student Dashboard (`Today`)**:
  - Implemented 4-tier visual hierarchy:
    1. Header: Greeting, career goal target pill (`Target: Software Engineer`), and calibration trigger (`Calibrate background`).
    2. Main Action: High-visibility priority action banner with one primary action button (`Start adaptive assessment`) and contextual rationale.
    3. Next Steps: High-priority learning tasks (`action-card task-row`) displaying time required (~15 mins), prerequisites, and readiness impact (`+10% readiness`).
    4. Progress Column: Computed readiness progress ring, compact roadmap showing current phase (`Phase 1: Foundation & Core Logic`), and small skill overview with truthful status tags.
- **Truthful Skill Evidence Statuses**:
  - Explicit skill states computed strictly from evidence: `not_assessed`, `self_reported`, `demonstrated`, `practical_submitted`, `mentor_verified`.
  - Unassessed skills (`count === 0`) are explicitly labeled as *"Not yet assessed"* without claiming a 0 score failure or misleading gap message.
- **Student Capability Onboarding & Migration 007**:
  - Database Migration `db/migrations/007-student-capability-profiles.sql`: Added `student_capability_profiles` table with foreign key to `users(id)` and JSONB columns.
  - Interactive calibration modal (`CapabilityOnboarding.tsx`) collecting education level, prior programming experience (including complete beginner options without stigma), career goal, and weekly learning availability.
  - API endpoints `GET /api/profile` and `PATCH /api/profile` fully integrated with database persistence.
- **Adaptive Level 1 Assessment Calibration**:
  - Added beginner-friendly Level 1 questions (variables, simple arithmetic, basic loop counting, output tracing, step-by-step logic) across all 6 skills.
  - Diagnostic starts at Level 1 for beginner capability profiles, with smooth item-response scaling.
- **Career Agent Workspace**:
  - Full conversation history with user message bubbles and agent responses.
  - Visible tool execution traces showing exact evidence items inspected.
  - One-click execution for routine tasks and review modal for mentor messages.
  - Deterministic Career Intelligence badge reflecting verified server evidence.

---

## 9. Verification Results & Test Summary

All automated checks pass cleanly with exit code 0:

| Verification Suite | Command | Result | Details |
| :--- | :--- | :--- | :--- |
| **TypeScript Typecheck** | `npm --prefix apps/web run typecheck` | **PASS** (0 errors) | Strict compilation with TypeScript 5.7.3 |
| **Node.js Unit Tests** | `npm --prefix apps/web test` | **PASS** (42 / 42 passed) | Engine, auth, security, agent, mailer, config, parser |
| **Database Integration** | `npm --prefix apps/web run db:integration` | **PASS** | 23 tables, transactions, append-only trigger, isolation |
| **API Integration** | `npm --prefix apps/web run api:integration` | **PASS** | Auth, profile, capability profile, assess, mentors, admin routes |
| **Production Build** | `npm --prefix apps/web run build` | **PASS** | `next build` compiled 32 dynamic routes, 8 static pages |
| **Browser E2E Workflow** | `npm --prefix apps/web run test:e2e` | **PASS** | Real Edge browser, 12 adaptive assessment questions, roadmap, action, mock interview, passport, 5 viewports (320px–1440px) |

