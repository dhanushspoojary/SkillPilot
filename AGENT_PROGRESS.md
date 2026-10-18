# SkillPilot: Autonomous Agentic AI System Progress Log

**Branch:** `feat/agentic-skillpilot`  
**Root Path:** `c:\Users\Dhanush S Poojary\Downloads\SkillPilot\skillpilot-final`  
**Web App Path:** `apps/web`  
**Primary Provider:** Google Gemini via official `@google/genai` SDK  
**Environment Variables:** `GEMINI_API_KEY`, `GEMINI_MODEL_FAST` (default: `gemini-2.5-flash`), `GEMINI_MODEL_STRONG` (default: `gemini-2.5-flash`)

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
  - [x] Configured `GEMINI_MODEL_FAST` and `GEMINI_MODEL_STRONG` routing (default: `gemini-2.5-flash`)
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
- [x] **Phase 9: Security & Reliability**
  - [x] Feature flag kill switches: `SKILLPILOT_AGENT_ENABLED`, `SKILLPILOT_DISABLED_TOOLS`
  - [x] Prompt injection resistance, parameterized PostgreSQL queries, cross-user isolation
  - [x] Execution budgets, request timeouts, and token budgeting
- [x] **Phase 10: UX, Motion & Accessibility**
  - [x] Streaming chat UI with concise tool indicators, Stop/Cancel button (`AbortController`), and Retry on failure
  - [x] 5-stage stepper (01 Discover · 02 Verify · 03 Plan · 04 Learn · 05 Improve)
  - [x] Mobile 320px responsive layout with zero horizontal overflow
  - [x] `@media (prefers-reduced-motion)` support and `aria-live="polite"` for accessible streaming
- [x] **Phase 11: Eval Harness & Observability**
  - [x] Golden conversation eval suite (beginner, advanced JS, undecided, injection attempt, preference change, general topic)
  - [x] Structured observability logging with request ID, step count, latency, tokens, cost estimate (no raw private reasoning)
  - [x] Explain-the-recommendation capability
  - [x] Honest degradation mode with user-friendly notices
- [x] **Phase 12: Comprehensive Automated Testing**
  - [x] Unit test suite pass: **118 passing, 0 failing, 0 skipped** (`npm test`)
  - [x] Typecheck pass: **0 TypeScript compiler errors** (`npm run typecheck`)
  - [x] Production build pass: **Clean build in 5.1s, all 9 static pages and dynamic routes compiled** (`npm run build`)
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
| **Unit & Scenario Tests** | `npm test` (`apps/web`) | **118** | **0** | **PASS** | Evaluated in 18.3s |
| **TypeScript Typecheck** | `npm run typecheck` | N/A | **0 errors** | **PASS** | `tsc --noEmit` exited 0 |
| **Production Build** | `npm run build` | 9/9 pages | **0 errors** | **PASS** | Compiled in 5.1s |
| **Browser E2E Journeys** | `node scripts/verify-journeys-e2e.mjs` | **2 journeys** | **0** | **PASS** | Edge headless automation |

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

1. **Root Cause of Unrelated Diagnostic Questions (JavaScript / SQL shown to beginners)**:
   - **Root Cause**: `apps/web/app/api/assess/start/route.ts` previously fetched all questions from `lib/questions.ts` and applied an unguided Fisher-Yates array shuffle, presenting JavaScript or SQL questions randomly regardless of the student's claimed skills or education level.
   - **Solution**: Replaced random selection with `planAssessmentSession` in `apps/web/lib/assessment-planner.ts`. It cross-references self-reported claims, learning goals, and verified prerequisites. Complete beginners receive strictly Level 1 Problem Solving. Furthermore, `validateQuestionProposal` serves as a hard deterministic server-side guard that rejects any question whose skill is not claimed or whose prerequisites are unverified.

2. **Primary Provider: Google Gemini Integration**:
   - Integrated using the official `@google/genai` SDK (`^2.30.0`).
   - Implemented `GeminiProviderAdapter` in `apps/web/lib/llm-provider.ts` routing between:
     - `GEMINI_MODEL_FAST` (default: `gemini-2.5-flash`) for intent classification, tool routing, conversation summarization, and quick responses.
     - `GEMINI_MODEL_STRONG` (default: `gemini-2.5-flash`) for deep tutoring, multi-step planning, code evaluation, and roadmap orchestration.
   - Preserved `LLMProvider` interface and `AnthropicProviderAdapter` so Anthropic or other providers can be configured seamlessly.
   - Rate limit handling: exponential backoff with jitter on 429 quota errors, falling back honestly to verified deterministic mode if free-tier capacity is exhausted.

3. **Privacy & Security**:
   - Client identity comes exclusively from `requireAuth()` server cookies; client-supplied user IDs are rejected.
   - Student PII (emails, phone numbers, auth tokens) is stripped (`sanitizePII`) before any external API call.
   - Secrets and tokens are redacted from all server logs (`redactSecrets`).
   - Administrative kill switches: `SKILLPILOT_AGENT_ENABLED` (disables model calls) and `SKILLPILOT_DISABLED_TOOLS` (disables individual tools).

4. **Idempotency & Reversible Preferences**:
   - Added `withIdempotency` caching using table `agent_idempotency_keys` to prevent duplicate attempts or mutations on network retries.
   - Added versioned preference history via table `roadmap_preference_history` and `revertLastRoadmapPreferenceChange`, enabling students to say "undo" or "revert" to restore their prior learning settings.

---

## 4. Advanced Features Implemented vs. Skipped

| Feature | Status | Notes |
| :--- | :---: | :--- |
| **Golden Conversation Eval Harness** | **Implemented** | 6 scenarios in `lib/scenarios-and-security.test.ts` (beginner, advanced JS, undecided, injection, preference change, general topic). |
| **Structured Observability** | **Implemented** | Logs request ID, step count, tool execution duration, token estimates, without exposing private reasoning. |
| **Conversation Auto-Summarization** | **Implemented** | Rolling summaries via `generateConversationSummary` in `lib/student-context.ts`. |
| **Student Memory View / Edit / Delete** | **Implemented** | Fully interactive via `/api/agent/memories` (GET, POST, PATCH, DELETE). |
| **Explain-the-Recommendation** | **Implemented** | Agent tool `explain_recommendation` provides prerequisite and gap justification. |
| **Honest Degradation Mode** | **Implemented** | Clear user-facing status when LLM provider is unavailable, keeping all core assessment and roadmap viewing intact. |
| **Stop / Cancel & Retry Streaming** | **Implemented** | `AbortController` cancel button and retry triggers in `components/AgentPanel.tsx`. |
| **Preference Undo / Revert** | **Implemented** | Reverts learning pace, daily schedule, and difficulty to prior version with before/after confirmation. |
| *Vector Database / pgvector Embeddings* | *Skipped* | Not present in existing schema; per instructions, utilized keyword and recency retrieval without adding heavy external infrastructure dependencies. |

---

## 5. How to Enable the Real Google Gemini Provider

In `.env.local` inside `apps/web`:
```bash
# Server-side only: never exposed to browser
GEMINI_API_KEY=your_actual_google_gemini_api_key_here
GEMINI_MODEL_FAST=gemini-2.5-flash
GEMINI_MODEL_STRONG=gemini-2.5-flash

# Optional kill switches:
# SKILLPILOT_AGENT_ENABLED=true
# SKILLPILOT_DISABLED_TOOLS=
```
When `GEMINI_API_KEY` is present, `getActiveLLMProvider()` automatically instantiates `GeminiProviderAdapter` via the official `@google/genai` client. If absent or quota-exhausted, SkillPilot operates in labeled deterministic fallback mode.
