# SkillPilot 2.0: Product Requirements & Specification

**Document Version:** 2.0.0  
**Status:** Living Engineering Baseline  
**Project Directory:** `c:\Users\Dhanush S Poojary\Downloads\SkillPilot\skillpilot-final`  
**Primary Application URL:** `http://localhost:3000`  
**Stack:** Next.js 15.5.27, React 19.2.3, TypeScript 5.7.3, PostgreSQL (Neon Cloud), LiveKit Cloud, OnlineCompiler / Piston / In-Memory SQLite  

---

## 1. Executive Product Vision

SkillPilot is an AI-first student career intelligence platform designed to eliminate the ambiguity of self-study and provide continuous, verifiable guidance toward technical career goals.

The continuous learning loop is:
```
ONBOARD
  -> ASSESS
  -> IDENTIFY SKILL GAPS
  -> GENERATE PERSONALIZED ROADMAP
  -> LEARN
  -> PRACTICE
  -> RECEIVE SOCRATIC FEEDBACK
  -> BUILD EVIDENCE
  -> RECEIVE MENTORSHIP
  -> COMPLETE MOCK INTERVIEWS
  -> REASSESS
  -> UPDATE MASTERY
  -> IMPROVE CAREER READINESS
```

SkillPilot directly answers seven core learner questions:
1. **What skills do I currently have?** (Distinguishing self-reported claims from server-verified evidence)
2. **What skills am I missing?** (Gap analysis mapped against target industry roles)
3. **What should I learn next?** (One authoritative, priority-ranked action for today)
4. **Why is that the right next step?** (Explicit prerequisite and gap rationale)
5. **How can I practice it?** (Interactive walkthroughs, variable execution traces, and safe code execution)
6. **How do I prove that I can do it?** (Server-scored assessments and objective problem solving)
7. **How close am I to my career goal?** (Evidence-weighted readiness percentages)

---

## 2. Core Architectural Principles & Invariants

1. **AI Proposes; Deterministic Logic Enforces**: Real LLMs (Google Gemini / Anthropic) provide natural language reasoning, Socratic question formulation, and misconception explanation. Deterministic application logic strictly controls authentication, authorization, scoring, database persistence, state transitions, prerequisite rules, and verification flags.
2. **Zero Pre-Submission Answer Leakage**: No assessment question or exercise submitted to the browser contains correct answer keys, evaluation rubrics, or scoring weights in DOM or payload.
3. **Strict Server-Side Scoring & Idempotency**: Scores are computed server-side from raw inputs. Client-submitted score flags are rejected. Duplicate submissions must never award duplicate mastery points.
4. **Isolated Code Execution**: Student code is executed in sandboxed remote runners (OnlineCompiler.io / Piston) or an isolated in-process in-memory SQLite sandbox (`:memory:`). Untrusted code never executes in the main application process or against production PostgreSQL.
5. **Honest Provider Fallbacks**: If external AI or execution providers become unavailable or quota-limited, the system falls back to vetted deterministic templates with explicit user-facing labels. Never simulate an LLM or fake test passes.
6. **Data Integrity & Non-Destructive Migrations**: Existing student accounts, assessment attempts, mentor conversations, and evidence records must be preserved. Production tables are never dropped or truncated.
7. **Single Port Development Safety**: Exactly one development server must be maintained on `http://localhost:3000`.

---

## 3. Detailed Functional Requirements

### 3.1. Authentication, Registration & Session Security (REQ-AUTH)
- **REQ-AUTH-01**: User registration supporting Student, Mentor, and Admin roles.
- **REQ-AUTH-02**: Passwords hashed using bcrypt (cost factor >= 10).
- **REQ-AUTH-03**: Secure HTTP-only, SameSite session cookies (`skillpilot_session`).
- **REQ-AUTH-04**: Cryptographic, single-use email verification and password reset tokens (`lib/email-tokens.ts`) with strict expiration.
- **REQ-AUTH-05**: Strict Origin & CSRF validation (`lib/server-security.ts`) on all state-changing mutations (`POST`, `PATCH`, `DELETE`). Cross-origin and spoofed Host header requests must be rejected.
- **REQ-AUTH-06**: Session persistence across page reloads and clean session termination on logout.

### 3.2. Conversational Onboarding & Student Profiling (REQ-ONBOARD)
- **REQ-ONBOARD-01**: Non-intrusive guided conversational discovery capturing:
  - Education level / Academic year
  - Programming experience (Beginner, Intermediate, Advanced)
  - Field of study
  - Career interests & primary career goal
  - Self-reported skill claims (distinguished clearly from verified competencies)
  - Daily/weekly study time availability
  - Preferred learning pace & format
- **REQ-ONBOARD-02**: Quick-form fallback mode allowing full structured control and categorized skill picker.
- **REQ-ONBOARD-03**: Calibration summary card presented prior to initial diagnostic assessment.
- **REQ-ONBOARD-04**: Ability to re-calibrate background and time availability at any time from settings or dashboard.

### 3.3. Adaptive Assessment Engine (REQ-ASSESS)
- **REQ-ASSESS-01**: Context-aware diagnostic question selection matching student level (Levels 0–5) and background calibration.
- **REQ-ASSESS-02**: Absolute prerequisite enforcement: complete beginners are assigned foundational problem solving (Level 1) and never receive unearned advanced questions (e.g., JavaScript closures or SQL joins).
- **REQ-ASSESS-03**: Dynamic response-dependent progression:
  - Correct answers advance difficulty or explore adjacent required competencies.
  - Incorrect answers trigger diagnostic misconception probes.
  - Correct answers with weak reasoning prompt explanation follow-ups.
- **REQ-ASSESS-04**: Variable stopping criteria based on confidence thresholds, skill coverage, and maximum question budget. No fixed-length forced sequences.
- **REQ-ASSESS-05**: Safe session resume: interrupted assessments resume at the exact pending question without double scoring or state loss.
- **REQ-ASSESS-06**: Assessment completion persists to PostgreSQL (`user_assessments`, `user_assessment_responses`) and updates skill mastery estimates in `user_skill_evidence`.

### 3.4. Career Discovery & Gap Analysis (REQ-CAREER)
- **REQ-CAREER-01**: Role competency mapping (Software Engineer, Backend Engineer, Frontend Engineer, Data Engineer, Fullstack Engineer).
- **REQ-CAREER-02**: Explicit categorization of skills into Claimed vs. Verified with visual indicators.
- **REQ-CAREER-03**: Real gap calculation computing exact point deficit between current verified readiness and role benchmarks.
- **REQ-CAREER-04**: Realistic educational guidance without fabricated salary claims or placement guarantees.

### 3.5. Personalized Roadmap Engine (REQ-ROADMAP)
- **REQ-ROADMAP-01**: Multi-tiered progression hierarchy: Career Goal → Year → Semester → Month → Weekly Targets → Today's Primary Action.
- **REQ-ROADMAP-02**: Topological dependency enforcement: advanced milestones remain locked until prerequisite competencies have verified proof.
- **REQ-ROADMAP-03**: Dynamic recomputation when new assessment evidence or practice completions are recorded.
- **REQ-ROADMAP-04**: Natural language calibration support via AI Companion ("I have 20 minutes daily", "focus on C first", "explain simpler").
- **REQ-ROADMAP-05**: Prerequisite conflict explanation when a learner requests an advanced topic before mastering fundamentals.

### 3.6. Interactive Learning & Socratic Practice Engine (REQ-LEARN)
- **REQ-LEARN-01**: Curated tracks across core fundamentals: Problem Solving, C Language, JavaScript, and SQL.
- **REQ-LEARN-02**: Multi-stage lesson structure:
  - Stage 1: Conceptual Introduction (Why it matters, real-world relevance, syntax rules)
  - Stage 2: Guided Code Execution Walkthrough (Line-by-line highlights, mental models, interactive variable trace tables)
  - Stage 3: Code Tracing & Socratic Practice
- **REQ-LEARN-03**: Non-punitive Socratic misconception evaluation: diagnoses specific cognitive traps (e.g., off-by-one errors, pointer dereference confusion) without leaking the correct answer.
- **REQ-LEARN-04**: Progressive 5-tier hint ladders (Nudge, Concept, Pseudo-code, Debugging Checklist, Full Solution with explanation).
- **REQ-LEARN-05**: Sandboxed multi-language code runner with strict execution timeouts (2.5s) and stdout size caps (64KB).
- **REQ-LEARN-06**: In-memory SQLite sandbox (`:memory:`) executing practice SQL queries safely without database write permissions.

### 3.7. AI Mentor & Agentic Capabilities (REQ-AGENT)
- **REQ-AGENT-01**: Centralized server-side LLM provider layer supporting Google Gemini primary (`gemini-3.5-flash`, `gemini-flash-latest`) and Anthropic secondary (`claude-3-5-sonnet`).
- **REQ-AGENT-02**: Authorized context retrieval: injects only student-owned profile data, recent evidence signals, and active roadmap targets.
- **REQ-AGENT-03**: Allowlisted tool execution:
  - `get_claimed_vs_verified_skills`
  - `collect_discovery_info`
  - `select_adaptive_question`
  - `evaluate_student_response`
  - `recommend_next_action`
- **REQ-AGENT-04**: Prompt injection defense: treats all user inputs and external content as untrusted; neutralizes system override attempts.
- **REQ-AGENT-05**: Multi-threaded conversational history with persistent PostgreSQL backing (`agent_threads`, `agent_messages`).

### 3.8. Human Mentorship Lifecycle (REQ-MENTOR)
- **REQ-MENTOR-01**: Mentor self-registration with profile submission (bio, expertise, company, years of experience, calendar booking link).
- **REQ-MENTOR-02**: Mandatory administrator review: mentors remain invisible in student discovery until explicitly approved by an admin.
- **REQ-MENTOR-03**: Student discovery displaying only verified, approved mentors.
- **REQ-MENTOR-04**: Request lifecycle: pending → accepted / declined.
- **REQ-MENTOR-05**: Role-scoped encrypted chat available exclusively between a student and their accepted mentor.
- **REQ-MENTOR-06**: Meeting URL policy enforcement: external calendar/video links validated against allowlisted domains (meet.google.com, zoom.us, cal.com, calendly.com).
- **REQ-MENTOR-07**: Structured post-session mentor review creating verified evidence records in `user_skill_evidence`.

### 3.9. LiveKit Video/Voice & Mock Interviews (REQ-LIVEKIT)
- **REQ-LIVEKIT-01**: Server-side LiveKit Cloud token generation (`wss://skillpilot-antxvdy9.livekit.cloud`) using `livekit-server-sdk`.
- **REQ-LIVEKIT-02**: Deterministic room naming (`mentor-call-<uuid>`) and identity-bound JWTs preventing room hijacking.
- **REQ-LIVEKIT-03**: Strict secret protection: LiveKit API Secret never exposed to browser bundles or client responses.
- **REQ-LIVEKIT-04**: Mock interview technical evaluation rubrics assessing technical accuracy, problem formulation, communication, and edge case coverage.

### 3.10. Skill Passport & Public Verification (REQ-PASSPORT)
- **REQ-PASSPORT-01**: Authoritative private passport aggregating evidence-backed competencies, assessments, verified projects, and mentor reviews.
- **REQ-PASSPORT-02**: Cryptographic authenticity hashing (`SHA-256`) binding student identity, verified skills, and timestamp.
- **REQ-PASSPORT-03**: Dedicated public sharing route (`/p/[handle]`) accessible without authentication.
- **REQ-PASSPORT-04**: Revocable public sharing links: once revoked by owner, public access immediately fails closed with privacy notice.
- **REQ-PASSPORT-05**: Zero leakage of sensitive user data: email, hashed passwords, assessment answers, and session cookies are excluded from public passport payloads.

### 3.11. UI/UX Transformation & Design System (REQ-UI)
- **REQ-UI-01**: Curated editorial pastel color system:
  - Background: `#FAF9FB`
  - Card/Surface: `#FFFFFF`
  - Primary Purple: `#8874C7`
  - Lavender: `#DCD2F0`
  - Pink: `#E9B3D0`
  - Blue: `#B9C9EA`
  - Text Primary: `#17151B`
  - Text Secondary: `#77727F`
  - Borders: `#E7E3EB`
- **REQ-UI-02**: Clean typography hierarchy using Google Fonts Inter and System UI, with 15–17px body copy.
- **REQ-UI-03**: Compact, collapsible desktop navigation sidebar with keyboard accessibility, aria-labels, and route persistence.
- **REQ-UI-04**: Full mobile responsiveness across 320px, 375px, 768px, 1024px, and 1440px viewports with zero horizontal overflow (`scrollWidth === clientWidth`).
- **REQ-UI-05**: Elimination of distracting aesthetic anti-patterns: no neon glows, heavy gradients, custom cursor followers, marquees, click sparks, or blocking animations.
- **REQ-UI-06**: Full support for `prefers-reduced-motion`.

---

## 4. Verification Acceptance Criteria

| ID | Criterion | Success Condition |
| :--- | :--- | :--- |
| **AC-01** | Port Safety | Exactly one server on port 3000; ports 3001–3003 free. |
| **AC-02** | Type Safety | `npm run typecheck` passes with 0 errors. |
| **AC-03** | Unit Test Suite | `npm test` passes 100% of tests with 0 failures. |
| **AC-04** | E2E Beginner Journey | Complete beginner receives Level 1 Problem Solving question, never JS or SQL. |
| **AC-05** | E2E Experienced Journey | Practical JS developer receives Level 2 closure question; roadmap reflects distinct milestones. |
| **AC-06** | Socratic Feedback | Incorrect exercise answer produces conceptual misconception hint without revealing answer. |
| **AC-07** | Idempotent Scoring | Duplicate submission of identical exercise attempt does not double score or increment counters. |
| **AC-08** | Code Execution | Python and SQL problems execute against real isolated sandboxes with correct pass/fail states. |
| **AC-09** | LiveKit Token Security | LiveKit tokens generated server-side with deterministic room claim; API secret never in browser. |
| **AC-10** | Passport Revocation | Public passport accessible via valid token; returns 404/Private when disabled or revoked. |
| **AC-11** | Mobile Viewport Fit | Zero horizontal document overflow at 320px, 375px, 768px, 1024px, 1440px. |
| **AC-12** | Database Safety | 156 existing users and 100 evidence rows preserved intact. |
