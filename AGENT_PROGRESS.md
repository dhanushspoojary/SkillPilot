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
- [ ] **Phase 2: Provider-Agnostic Model Layer with Google Gemini as Primary**
  - [ ] Install official `@google/genai` SDK in `apps/web`
  - [ ] Implement `LLMProvider` abstraction (`complete`, `stream`, `structured`, `toolCall`)
  - [ ] Implement `GeminiProviderAdapter` using official `@google/genai` SDK
  - [ ] Configure `GEMINI_MODEL_FAST` and `GEMINI_MODEL_STRONG` routing
  - [ ] Implement exponential backoff, jitter, and clear user-facing messages for free-tier 429s
  - [ ] PII minimization and secret redaction before any provider call
  - [ ] Maintain secondary `AnthropicProviderAdapter` compatibility
  - [ ] Honest fallback labeling (`not AI-generated`)
- [ ] **Phase 3: Agent Controller & Tool Registry**
  - [ ] Typed schemas for all tool definitions (zod/typed validator)
  - [ ] Server-session identity enforcement (never trust client user ID)
  - [ ] Bounded iterations, loop detection, execution deadlines, rate limits
  - [ ] Idempotency keys on state-changing operations
  - [ ] Approval queue for consequential actions
  - [ ] Versioned undo for roadmap/preference mutations
- [ ] **Phase 4: General-Purpose Assistant Behavior**
  - [ ] General coding, writing, debugging, and analytical Q&A without forced assessment routing
  - [ ] Memory retrieval integration without hallucinated student data
  - [ ] Combination of LLM reasoning with deterministic authorization and state guards
- [ ] **Phase 5: Memory & Context Architecture**
  - [ ] Rolling conversation summaries
  - [ ] Student-accessible fact/preference view, edit, and delete controls
  - [ ] PII stripping (names, emails, credentials)
- [ ] **Phase 6: Adaptive Onboarding & Student Journey**
  - [ ] 7-stage server-persisted conversational discovery
  - [ ] Multi-select, back/skip, non-forced career goals
  - [ ] Baseline summary confirmation prior to diagnostic launch
- [ ] **Phase 7: Adaptive Assessment Engine & Prerequisite Guards**
  - [ ] Server-side assessment planner (`planAssessmentSession`)
  - [ ] 6-level taxonomy (Levels 0–5) and misconception classification
  - [ ] Hard deterministic guard against unclaimed/unearned skills
- [ ] **Phase 8: Roadmap & Preference Adaptation**
  - [ ] Natural language preference changes with before/after diffs and history
  - [ ] Prerequisite conflict explanation and safe alternatives
- [ ] **Phase 9: Security & Reliability**
  - [ ] Feature flag kill switch (`SKILLPILOT_AGENT_ENABLED`, `SKILLPILOT_DISABLED_TOOLS`)
  - [ ] Prompt injection resistance, parameterized queries, cross-user isolation
- [ ] **Phase 10: UX, Motion & Accessibility**
  - [ ] Streaming chat UI with concise tool indicators
  - [ ] 5-stage stepper (01 Discover · 02 Verify · 03 Plan · 04 Learn · 05 Improve)
  - [ ] Mobile 320px responsive layout with zero horizontal overflow
  - [ ] `@media (prefers-reduced-motion)` support
- [ ] **Phase 11: Eval Harness & Observability**
  - [ ] Golden conversation eval suite (beginner, advanced JS, undecided, injection, preference change)
  - [ ] Structured observability logging without private reasoning or secrets
- [ ] **Phase 12: Comprehensive Automated Testing**
  - [ ] Unit test suite pass (`npm run test`)
  - [ ] Typecheck pass (`npm run typecheck`)
  - [ ] Production build pass (`npm run build`)
  - [ ] Live browser E2E journey automation (`verify-journeys-e2e.mjs`)
- [ ] **Phase 13: Self-Audit & Code Cleanliness Loop**
- [ ] **Phase 14: Definition of Done & Final Delivery**

---

## 2. Baseline Status (Recorded in Phase 1)

- **Git Branch:** `feat/agentic-skillpilot`
- **TypeScript:** `tsc --noEmit` exited **0** (0 type errors).
- **Unit Tests:** `node --experimental-strip-types --test lib/*.test.ts` exited **0** (**109 passing, 0 failing, 0 skipped**).
- **Next.js Production Build:** `npm run build` compiled cleanly in **11.3s** (all 9 static pages and dynamic API routes compiled without error).
- **Root Runner:** Created `verify-journeys-e2e.mjs` at repository root forwarding to `apps/web/scripts/verify-journeys-e2e.mjs`.

---

## 3. Key Findings & Architectural Decisions

1. **Root Cause of Unrelated Diagnostic Questions**:
   - `apps/web/app/api/assess/start/route.ts` previously used random array shuffling on the entire question bank.
   - Solved with `planAssessmentSession` in `apps/web/lib/assessment-planner.ts`: validates prerequisites and student claims; complete beginners receive strictly Level 1 Problem Solving.

2. **Primary Provider Transition to Google Gemini**:
   - User directive: install `@google/genai` official SDK.
   - Primary adapter: `GeminiProviderAdapter` utilizing `GoogleGenAI` client.
   - Model configuration:
     - `GEMINI_MODEL_FAST` (default: `gemini-2.5-flash`) for intent classification, tool routing, conversation summarization, and quick responses.
     - `GEMINI_MODEL_STRONG` (default: `gemini-2.5-flash`) for deep Socratic explanation, multi-step planning, code evaluation, and roadmap orchestration.
   - Secondary adapter: retain `AnthropicProviderAdapter` structure for future provider switching.

3. **Rate Limit & 429 Backoff Strategy**:
   - Gemini free tier has RPM/RPD quotas. Implement exponential backoff with jitter (initial 1.5s, factor 2, max 3 retries).
   - If free-tier quota is exhausted, report user-facing message: *"Gemini capacity temporarily reached. Switched to verified deterministic mode without losing your progress."*

4. **Security & Privacy (PII Minimization)**:
   - Strip student names, email addresses, database session tokens, and passwords prior to payload dispatch to external providers.
   - Redact API keys from all server logging and client responses.
   - Hard kill switches: `SKILLPILOT_AGENT_ENABLED=false` disables model calls; `SKILLPILOT_DISABLED_TOOLS=tool_name` disables individual tools.

---

## 4. Assumptions

1. In development, if `GEMINI_API_KEY` is not present in `.env.local`, the system operates cleanly in labeled fallback mode (`mode: 'fallback' / 'deterministic'`) and all automated tests use deterministic or mocked adapters.
2. The default model for both fast and strong tiers is `gemini-2.5-flash`, which is the latest widely available high-efficiency Gemini model.
