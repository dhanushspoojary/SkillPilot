# SkillPilot: Continuous AI Learning, Adaptive Practice & Skill Mastery

## 1. Executive Summary
SkillPilot has been upgraded from a static roadmap and assessment tool into a continuous, AI-powered learning and skill-mastery platform. A student is never left wondering *"What should I do next?"*, *"Why am I learning this?"*, *"How do I practice it?"*, or *"Have I mastered it?"*.

Every major view provides one-click actionability directly connected to persistent server state, real interactive lessons, progressive code walkthroughs, code tracing exercises, Socratic error recovery with multi-tier hints, and transparent concept mastery tracking.

---

## 2. Files Changed & Created

### Database & Migrations
- `db/migrations/013-lessons-practice-and-mastery.sql`:
  - `student_lesson_progress`: tracks lesson starts, exercises completed, total exercises, completion timestamps, and status.
  - `student_practice_attempts`: records every code-tracing attempt, chosen answer, correctness, hints used, and feedback.
  - `student_concept_mastery`: tracks concept-level mastery (`novice`, `practicing`, `proficient`, `mastered`), solving streaks, unassisted solves, and timestamps.
  - `practice_questions`: persistent repository of validated generated and templated practice questions with SHA-256 duplicate-detection fingerprints.
  - `student_capability_profiles`: added `skills_to_learn` and `skills_known` JSONB columns to distinguish learning targets from verified prior knowledge.

### Server-Side Engines & Catalogs (`apps/web/lib/`)
- `lib/lessons-catalog.ts`: Complete multi-track curriculum catalog covering:
  - **Problem Solving / DSA**: Loop Tracing, State Accumulation, Loop Invariants, and Off-by-One Boundaries.
  - **C Systems Programming**: Pointer Semantics, Memory Addresses, Dereferencing, and Pass-by-Reference.
  - **Modern JavaScript**: Lexical Scope, Closures, and Private State Encapsulation.
  - **Relational Databases & SQL**: Inner vs Left Joins, Null Coalescing, and Aggregation logic.
  - Includes step-by-step code walkthroughs, line annotations, mental models, key definitions with analogies, common pitfalls, and sanitized interactive exercises.
- `lib/practice-engine.ts`:
  - Continuous practice generation pipeline combining algorithmic problem templates and Gemini AI generation (`@google/genai`).
  - SHA-256 deterministic question fingerprinting to prevent duplicates.
  - Strict schema validation for generated questions.
  - Socratic evaluation engine diagnosing student misconceptions and providing pedagogical feedback rather than merely revealing answers.
  - Hint penalty mechanism: solving with hints awards reduced mastery credit.
  - Transparent mastery progression: requires multiple distinct problems solved on the same concept without hints to advance from Novice → Practicing → Proficient → Mastered.
  - In-memory fallback caching with persistent PostgreSQL sync.
- `lib/next-action-engine.ts`:
  - `determineNextAction(userId)`: Dynamically computes the single highest-leverage task based on persisted server evidence:
    - Step 1: Onboarding discovery (if incomplete).
    - Step 2: Diagnostic assessment (if no baseline skill evidence exists).
    - Step 3: Targeted remediation (if recent mistakes or weak concepts `< 60%` score exist).
    - Step 4: Resume in-progress lesson (picks up right where the student left off).
    - Step 5: Next catalog milestone (based on demonstrated prerequisites).
    - Step 6: Practical project application (to demonstrate verified portfolio evidence).
  - Supplies plain-language explanations, estimated completion times, and one-click action triggers.
- `lib/capability-profile.ts`: Updated parser and updater to support `skillsToLearn` and `skillsKnown`.
- `lib/server-security.ts`: Hardened `requireOrigin` to strictly reject mutation requests lacking legitimate Origin/Referer headers, preventing CSRF while explicitly allowing approved development origins.
- `lib/learning-practice.test.ts`: 15 comprehensive unit tests covering catalog integrity, question schemas, fingerprinting, templated generation, Socratic evaluations, hint penalties, and next-action determination.

### Server API Endpoints (`apps/web/app/api/learn/`)
- `GET /api/learn/lessons`: Returns lesson catalog with student's personal completion progress.
- `GET /api/learn/lesson?id=...`: Returns lesson definitions, step-by-step walkthroughs, and exercises with `correctIndex` and `explanation` stripped out so answers cannot be inspected client-side.
- `POST /api/learn/attempt`: Evaluates code-tracing answers, updates concept mastery, applies hint penalties, and returns Socratic remediation. Supports both `chosenIndex` and `selectedIndex`.
- `POST /api/learn/practice/generate`: Generates fresh practice questions on-demand via algorithmic templates or Gemini AI.
- `GET /api/learn/next-action`: Authoritative next-action endpoint driving the dashboard and roadmap recommendation banners.

### Frontend Components & Views (`apps/web/components/`)
- `components/LearnWorkspace.tsx`:
  - **Interactive Walkthrough**: Step-by-step execution viewer highlighting code lines, showing variable evolution, and providing mental-model notes.
  - **Code Tracing & Practice**: Interactive multiple-choice exercises, progressive 3-tier hints, and immediate Socratic feedback.
  - **AI Socratic Tutor Bar**: Quick prompt shortcuts (*"Explain simpler"*, *"Show another example"*, *"Why is my answer wrong"*, *"Generate fresh question"*).
  - **Concept Mastery Sidebar**: Displays live mastery status badges (`Novice`, `Practicing`, `Proficient`, `Mastered`), solving stats, and difficulty progression.
  - **Lessons Catalog Browser**: Allows switching between topics and exploring the multi-track curriculum.
- `components/CapabilityOnboarding.tsx`: Searchable, multi-select categorized skill picker across 6 domains (Languages, DSA, Web, Databases, Systems/APIs, Practical Projects) explicitly distinguishing *"Skills I Want to Learn"* vs *"Skills I Know Already"*.
- `components/App.tsx`: Added `'learn'` to navigation (`02 // Learn`) and main view router.
- `components/views.tsx`:
  - Connected `dynamicNextAction` to the Today dashboard priority card and Stage 04 stepper.
  - Added high-visibility `"RECOMMENDED LEARNING TASK // ONE-CLICK LAUNCH"` banner to the Roadmap view with a prominent `"Start Learning"` button linking directly to the active lesson workspace.
- `app/globals.css`: Added styles for the deep blue theme (`.learn-workspace`, `.roadmap-actionable-task-card`, `.walkthrough-container`, `.hints-container`).

### Test Scripts
- `scripts/api-integration.mjs`: Added full end-to-end integration tests for catalog retrieval, answer masking, practice attempt evaluation, Socratic feedback, question generation, and next-action recommendation.

---

## 3. Database Changes
Migration `013-lessons-practice-and-mastery.sql` applied to Neon PostgreSQL:
```sql
CREATE TABLE IF NOT EXISTS student_lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_slug VARCHAR(100) NOT NULL,
  lesson_id VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'in_progress',
  exercises_completed INTEGER NOT NULL DEFAULT 0,
  total_exercises INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_student_lesson UNIQUE (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS student_practice_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_slug VARCHAR(100) NOT NULL,
  topic VARCHAR(100) NOT NULL,
  question_id VARCHAR(100) NOT NULL,
  question_prompt TEXT NOT NULL,
  chosen_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  hints_used INTEGER NOT NULL DEFAULT 0,
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_concept_mastery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_slug VARCHAR(100) NOT NULL,
  concept VARCHAR(100) NOT NULL,
  mastery_score INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'novice',
  problems_solved INTEGER NOT NULL DEFAULT 0,
  problems_attempted INTEGER NOT NULL DEFAULT 0,
  last_practiced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_student_concept UNIQUE (user_id, skill_slug, concept)
);

CREATE TABLE IF NOT EXISTS practice_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint VARCHAR(64) NOT NULL UNIQUE,
  skill_slug VARCHAR(100) NOT NULL,
  topic VARCHAR(100) NOT NULL,
  concept VARCHAR(100) NOT NULL,
  difficulty VARCHAR(50) NOT NULL,
  question_type VARCHAR(50) NOT NULL,
  prompt TEXT NOT NULL,
  code_snippet TEXT,
  choices JSONB NOT NULL,
  correct_index INTEGER NOT NULL,
  hints JSONB NOT NULL,
  explanation TEXT NOT NULL,
  source VARCHAR(50) NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE student_capability_profiles
  ADD COLUMN IF NOT EXISTS skills_to_learn JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS skills_known JSONB DEFAULT '[]'::jsonb;
```

---

## 4. Security & Reliability Considerations
1. **Zero Untrusted Code Execution on Server**: Rather than executing arbitrary untrusted student C or JavaScript code inside the Next.js API server, exercises focus on deterministic code tracing, mental execution tables, output prediction, and debugging. Practical coding projects use the isolated sandboxed bookstore evaluation service.
2. **Server-Side Authorization**: All `/api/learn/*` endpoints enforce `currentUser()` and require a verified `student` role. Students can never view or mutate another student's progress or mastery records.
3. **Payload Answer Sanitization**: `GET /api/learn/lesson` and `POST /api/learn/practice/generate` explicitly strip `correctIndex` and `explanation` prior to sending payloads to the client. The client never receives answer keys before submission.
4. **Strict Origin Validation & CSRF Protection**: `requireOrigin` enforces same-origin policies on all mutation routes (`POST`, `PUT`, `DELETE`). Mutations lacking an `Origin` or same-origin `Referer` header are rejected with `403 Forbidden`.
5. **PII and Secret Sanitization**: `redactSecrets` and `sanitizePII` ensure API tokens and student personal identifiers are never passed to Gemini prompts.
6. **Graceful Fallbacks**: When Gemini AI generation is unavailable or rate-limited (HTTP 429), the practice engine seamlessly falls back to pre-vetted algorithmic templates with varied input parameters without throwing errors or breaking the learning flow.

---

## 5. Automated Tests & Empirical Evidence

### Unit & Engine Tests (`npm test`)
Command: `node --experimental-strip-types --test lib/*.test.ts`
- **Total Tests**: 138
- **Passed**: 138
- **Failed**: 0
- **Duration**: ~20.2s
- **Verified Suites**:
  - `Continuous AI Learning & Lessons Catalog`: Catalog structure, walkthrough steps, pitfalls, retrieval by ID.
  - `Continuous Practice Engine & Question Generation`: Deterministic SHA-256 fingerprint deduplication, schema validation, algorithmic templates, fallback when provider inactive.
  - `Socratic Feedback & Mastery-Based Progression`: Misconception feedback without revealing answer, unassisted solve credit, hint penalty deduction, multiple unassisted solve requirement for `mastered` status.
  - `Automated Next-Action Engine`: Authoritative priority calculation and plain-language explanation.
  - `Origin Validation & CSRF Protection`: Trailing slashes, port normalization, same-origin host match, cross-origin rejection, missing origin mutation rejection.
  - Existing auth, retention, readiness, and roadmap suites.

### Live Server Integration Suite (`npm run api:integration`)
Command: `$env:API_URL="http://localhost:3000"; npm run api:integration`
- **Result**: `api integration: PASS (all auth, assessment, learning, practice, projects, and next-action workflows verified)` (Exit Code 0).
- **Verified Steps on Live Server & Postgres DB**:
  1. Student registration & session issue.
  2. Capability profile calibration.
  3. Diagnostic assessment start & question evaluation.
  4. Activity persistence & idempotency.
  5. CSRF / missing origin rejection (HTTP 403).
  6. Verified project evaluation (Bookstore Service).
  7. Lessons catalog retrieval (`GET /api/learn/lessons`).
  8. Sanitized lesson retrieval without answer leaks (`GET /api/learn/lesson?id=ps-loop-tracing`).
  9. Incorrect attempt submission returning Socratic diagnosis (`POST /api/learn/attempt`).
  10. Correct attempt submission incrementing concept mastery (`POST /api/learn/attempt`).
  11. Dynamic question generation with SHA-256 fingerprint (`POST /api/learn/practice/generate`).
  12. Dynamic next-action recommendation with plain explanation (`GET /api/learn/next-action`).

### TypeScript & Production Build
- `npm run typecheck` (`tsc --noEmit`): Exited with code 0 (zero errors).
- `npm run build` (`next build`): Exited with code 0. Compiled successfully in 6.9s; static pages generated (9/9).

---

## 6. Failures & Unresolved Issues
- **None**: All 138 unit tests pass, live server API integration tests pass, typechecks pass, and the production build compiles with zero errors.

---

## 7. Next Steps for Student Development Team
1. **Expand Content Tracks**: Add additional lessons to `lib/lessons-catalog.ts` for Intermediate C (Pointers to Structs, Dynamic Memory with `malloc`/`free`) and Advanced JavaScript (Event Loop, Promises, Async/Await).
2. **Community Mentor Reviews**: Utilize the existing mentor review architecture (`/api/mentor/reviews`) to allow volunteer mentors to review a student's Socratic practice history and offer human feedback on weak concepts.
3. **PWA Offline Mode**: Service worker caching of lesson walkthroughs so students can review code mental models even with intermittent connectivity.
