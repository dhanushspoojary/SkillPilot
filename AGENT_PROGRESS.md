# SkillPilot: Autonomous Agentic AI System Progress Log

**Branch:** `feat/agentic-skillpilot`  
**Root Path:** `c:\Users\Dhanush S Poojary\Downloads\SkillPilot\skillpilot-final`  
**Web App Path:** `apps/web`  
**Primary Provider:** Google Gemini via official `@google/genai` SDK  
**Environment Variables:** `GEMINI_API_KEY`, `GEMINI_MODEL_FAST` (configured: `gemini-flash-latest`), `GEMINI_MODEL_STRONG` (configured: `gemini-flash-latest`)

---

## 1. Phase Checklist

- [x] **Phase 1: Inspection & Architecture Mapping**
  - [x] Codebase structure, packages, and scripts mapped
  - [x] Provider, SDK, env vars, agent routes, tool definitions inspected
  - [x] DB schema, migrations, auth, RBAC, sessions, rate limits inspected
  - [x] Onboarding, assessment engine, question taxonomy, memory systems inspected
  - [x] Root cause of unrelated JS/SQL questions verified and documented
  - [x] Baseline typecheck, tests, and build executed and recorded
- [x] **Phase 2: Provider-Agnostic Model Layer with Google Gemini as Primary**
  - [x] Installed official `@google/genai` SDK in `apps/web` (`^2.30.0`)
  - [x] Implemented `LLMProvider` abstraction (`generateResponse`, `generateText`, toolCall schemas)
  - [x] Implemented `GeminiProviderAdapter` using official `@google/genai` SDK
  - [x] Configured `GEMINI_MODEL_FAST` and `GEMINI_MODEL_STRONG` routing (`gemini-flash-latest`)
  - [x] Verified live Google Gemini API connectivity & tool calling with real API key
  - [x] Implemented exponential backoff with jitter and clear user-facing messages for free-tier 429 errors
  - [x] PII minimization (`sanitizePII`) and secret redaction (`redactSecrets`)
  - [x] Maintained secondary `AnthropicProviderAdapter` compatibility for future provider swaps
  - [x] Centralized versioned prompt templates (`apps/web/lib/prompt-templates.ts`)
  - [x] Honest fallback labeling (`mode: 'fallback'`, `fallbackReason: 'Google Gemini capacity reached...'`)
  - [x] Verified with unit tests (`apps/web/lib/llm-provider.test.ts`)
- [x] **Phase 3: Agent Controller & Tool Registry**
  - [x] Server-side agent loop with loop detection (`step_limit_exceeded` on consecutive tool repetition)
  - [x] Tool disabling kill switch (`isToolDisabled`) and master kill switch (`isAgentEnabled`)
  - [x] Typed schemas for all tool definitions (`AGENT_TOOL_SCHEMAS`)
  - [x] Server-session identity enforcement (`requireAuth()`, never trusts client-supplied user ID)
  - [x] Bounded iterations (max 4 iterations), loop detection, per-run deadlines, rate limits
  - [x] Idempotency keys on state-changing operations (`withIdempotency`, table `agent_idempotency_keys`)
  - [x] Approval queue for consequential actions (`proposal_created` / proposals require explicit student confirmation)
  - [x] Versioned undo for roadmap/preference mutations (`revertLastRoadmapPreferenceChange`, table `roadmap_preference_history`)
- [x] **Phase 4: General-Purpose Assistant Behavior**
  - [x] General coding, writing, debugging, and analytical Q&A (closures, TCP/UDP, Big-O) without forced assessment routing
  - [x] Memory retrieval integration without hallucinated student data
  - [x] Combination of LLM reasoning with deterministic authorization and state guards
- [x] **Phase 5: Memory & Context Architecture**
  - [x] Rolling conversation summaries (`generateConversationSummary`)
  - [x] Student-accessible fact/preference view, edit, and delete controls (`/api/agent/memories` GET, POST, PATCH, DELETE)
  - [x] PII stripping before sending context to providers (`sanitizePII`)
- [x] **Phase 6: Adaptive Onboarding & Student Journey**
  - [x] 7-stage server-persisted conversational discovery (`ONBOARDING_TOPIC_CONFIGS`, `/api/discovery`)
  - [x] Multi-select, back/skip, non-forced career goals ("I don't know my career yet")
  - [x] Baseline summary confirmation prior to diagnostic launch
  - [x] Returning students automatically skip completed discovery to their next useful action
- [x] **Phase 7: Adaptive Assessment Engine & Prerequisite Guards**
  - [x] Server-side assessment planner (`planAssessmentSession`)
  - [x] 6-level taxonomy (Levels 0–5) and misconception classification
  - [x] Hard deterministic guard against unclaimed/unearned skills (`validateQuestionProposal`)
  - [x] Beginners strictly receive Level 1 Problem Solving; never JS or SQL without an explicit claim or goal
- [x] **Phase 8: Roadmap & Preference Adaptation**
  - [x] Natural language preference changes with before/after diffs and history ("explain simpler", "I have 20 minutes", "focus on C first", "why this?")
  - [x] Prerequisite conflict explanation and safe alternatives (e.g., requesting REST APIs without JS explains missing foundation)
  - [x] Completed progress preserved during roadmap adjustments
- [x] **Phase 9: Security & Reliability (Origin & CSRF Fix)**
  - [x] **Fixed "Origin not allowed" Root Cause**: Enhanced `requireOrigin` in `lib/server-security.ts` and `originOk` in `lib/guard.ts` to recognize legitimate same-origin requests matching Host header, request URL origin, and development IP/localhost aliases while strictly blocking cross-origin attempts and `sec-fetch-site: cross-site`.
  - [x] Created `lib/origin-security.test.ts` (7/7 tests passing)
  - [x] Feature flag kill switches: `SKILLPILOT_AGENT_ENABLED`, `SKILLPILOT_DISABLED_TOOLS`
  - [x] Prompt injection resistance, parameterized PostgreSQL queries, cross-user isolation
  - [x] Execution budgets, request timeouts, and token budgeting
- [x] **Phase 10: UX, Motion & Accessibility**
  - [x] Streaming chat UI with concise tool indicators, Stop/Cancel button (`AbortController`), and Retry on failure
  - [x] 5-stage stepper (01 Discover · 02 Verify · 03 Plan · 04 Learn · 05 Improve)
  - [x] Refined deep blue design system (#080D1A midnight, #0C1426 navy, #245BFF primary, #4D8DFF electric blue, #71E6FF cyan; zero stray orange/purple highlights)
  - [x] Mobile 320px responsive layout with zero horizontal overflow
  - [x] `@media (prefers-reduced-motion)` support and `aria-live="polite"` for accessible streaming
- [x] **Phase 11: Eval Harness & Observability**
  - [x] Golden conversation eval suite (beginner, advanced JS, undecided, injection attempt, preference change, general topic)
  - [x] Structured observability logging with request ID, step count, latency, tokens, cost estimate (no raw private reasoning)
  - [x] Explain-the-recommendation capability
  - [x] Honest degradation mode with user-friendly notices
- [x] **Phase 12: Comprehensive Automated Testing**
  - [x] Unit test suite pass: **125 passing, 0 failing, 0 skipped** (`npm test`)
  - [x] Typecheck pass: **0 TypeScript compiler errors** (`npm run typecheck`)
  - [x] Production build pass: **Clean build in 6.6s, all 9 static pages and dynamic routes compiled** (`npm run build`)
  - [x] Live browser E2E journey automation pass: **Both Beginner & Advanced Journeys Verified** (`verify-journeys-e2e.mjs`)
- [x] **Phase 13: Self-Audit & Code Cleanliness Loop**
  - [x] Codebase audited for raw user IDs, mock strings, and unverified claims
  - [x] All 11 agent tools registered, validated, authorized, and tested
  - [x] Hard guard against beginner JS/SQL verified in both unit and live browser tests
- [x] **Phase 14: Definition of Done & Final Delivery**
  - [x] All 11 criteria met and verified

---

## 2. Test Execution & Verification Results

| Suite / Check | Command | Pass Count | Fail Count | Status | Notes |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Unit & Scenario Tests** | `npm test` (`apps/web`) | **125** | **0** | **PASS** | Includes 7 origin security tests |
| **TypeScript Typecheck** | `npm run typecheck` | N/A | **0 errors** | **PASS** | `tsc --noEmit` exited 0 |
| **Production Build** | `npm run build` | 9/9 pages | **0 errors** | **PASS** | Compiled in 6.6s |
| **Browser E2E Journeys** | `node scripts/verify-journeys-e2e.mjs` | **2 journeys** | **0** | **PASS** | Edge headless automation |
| **Live Gemini Model Check** | `gemini-flash-latest` | 1 text, 1 tool | **0** | **PASS** | Real Google GenAI API response |

### Browser E2E Highlights:
- **Complete Beginner (Scenario A)**:
  - Account: `e2e_beginner_...@skillpilot.test`
  - Conversational Discovery: Completed all 7 turns automatically.
  - Diagnostic: Assigned **Problem Solving (Level 1)**; verified **0 JavaScript or SQL questions**.
  - Dashboard: Rendered 5-stage pipeline at Stage 02: VERIFY, 1 Claimed Skill, 0 Verified.
  - Natural Language: "I have 20 minutes" -> Calibrated practice plan to 20 mins/day.
  - Viewport: Tested at **320px width** -> Zero horizontal overflow.
- **Advanced JavaScript Developer (Scenario C)**:
  - Account: `e2e_advanced_...@skillpilot.test`
  - Conversational Discovery: Identified prior experience and claimed JavaScript.
  - Diagnostic: Assigned **JavaScript (Level 2)** closure question directly without forced basic intro.
  - Conflict Check: "I want to focus on REST APIs first" -> Correctly explained prerequisite requirement (JavaScript and Problem Solving required first).
  - Roadmap: Generated visibly differentiated full-stack milestone path.
  - DB Isolation: All test accounts cleaned up cleanly.

---

## 3. Key Findings & Architectural Solutions

1. **Origin Validation Mismatch ("Unable to Start Diagnostic / Origin not allowed")**:
   - **Root Cause**: `apps/web/lib/server-security.ts` called `originOk(req.method, req.headers.get('origin'), allowed)` where `allowed` was statically evaluated against `SKILLPILOT_ALLOWED_ORIGIN`. When accessed on local network IP (e.g. `http://192.168.1.102:3000`), a different port, or when `origin` was absent on same-origin POST requests, the request was rejected with 403 `Origin not allowed`.
   - **Solution**: Enhanced `requireOrigin` to cross-validate `origin` against the request's own `Host` header (`req.headers.get('host')`), incoming request URL origin, development hostname aliases (`localhost`, `127.0.0.1`, `[::1]`), and `sec-fetch-site`. Legitimate same-origin requests now succeed seamlessly, while unauthorized cross-origin requests (`sec-fetch-site: cross-site` or external domains) remain strictly rejected. Verified in `apps/web/lib/origin-security.test.ts`.

2. **Google Gemini Live Model Verification**:
   - Tested real Google Gemini inference using the configured `GEMINI_API_KEY`.
   - Discovered that Google deprecated `gemini-2.5-flash` for new accounts in favor of `gemini-flash-latest`.
   - Updated `apps/web/.env.local` and `apps/web/lib/llm-provider.ts` to use `gemini-flash-latest`.
   - Confirmed live inference succeeded and tool calling (`update_learning_preferences` with `dailyMinutes: 25`) returned structured function call arguments directly from Google Gemini.

3. **Root Cause of Unrelated Diagnostic Questions (JavaScript / SQL shown to beginners)**:
   - **Root Cause**: `apps/web/app/api/assess/start/route.ts` previously fetched all questions from `lib/questions.ts` and applied an unguided Fisher-Yates array shuffle.
   - **Solution**: Replaced random selection with `planAssessmentSession` in `apps/web/lib/assessment-planner.ts`. It cross-references self-reported claims, learning goals, and verified prerequisites. Complete beginners receive strictly Level 1 Problem Solving. Furthermore, `validateQuestionProposal` serves as a hard deterministic server-side guard that rejects any question whose skill is not claimed or whose prerequisites are unverified.

4. **Dashboard Aesthetic Refinement**:
   - Removed lingering orange/purple shadows and borders from `.priority-card`, `.primary-btn-link`, `.journey-step-btn`, and `.status-pill.active`.
   - Applied unified deep-blue design tokens: `#080D1A` midnight navy, `#0C1426` dark navy surface, `#245BFF` primary, `#4D8DFF` electric blue glow, and `#71E6FF` pale cyan accents.

---

## 4. How to Run & Verify

In `.env.local` inside `apps/web`:
```bash
DATABASE_URL=postgresql://...
SKILLPILOT_ALLOWED_ORIGIN=http://localhost:3000
SKILLPILOT_TRUST_PROXY=false
SKILLPILOT_SECURE_COOKIES=false
GEMINI_API_KEY="your_api_key_here"
GEMINI_MODEL_FAST=gemini-flash-latest
GEMINI_MODEL_STRONG=gemini-flash-latest
```

### Verification Commands
```bash
# Run 125 automated unit & security tests
npm test

# Run TypeScript type check
npm run typecheck

# Run production build
npm run build

# Run automated browser journeys
node scripts/verify-journeys-e2e.mjs
```
