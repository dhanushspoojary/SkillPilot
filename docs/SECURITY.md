# SkillPilot Security Architecture & Audit Report

**Project**: SkillPilot  
**Workspace**: `apps/web`  
**Classification**: High-Integrity Educational & Credential Platform  
**Last Updated**: 2026-10-19  

---

## 1. Executive Summary

SkillPilot handles student educational progress, verified competency evidence, private mentor interactions, and public credential passports. The platform enforces a **Server-Authoritative Trust Model** where the browser is considered an untrusted client. 

All capability scoring, diagnostic branching, evidence persistence, and role privileges are calculated strictly on the server and backed by PostgreSQL database constraints.

---

## 2. Core Security Controls

### 2.1 Authentication & Session Management
- **Password Hashing**: Passwords are hashed using `bcrypt` with adaptive work factor (salt rounds >= 10). Raw passwords are never logged, echoed, or stored in plaintext.
- **Session Tokens**: Sessions use cryptographically random 256-bit entropy tokens stored as SHA-256 hashes in the database.
- **Cookie Security**:
  - `HttpOnly`: Prevents JavaScript access and mitigates XSS session hijacking.
  - `SameSite=Lax`: Mitigates Cross-Site Request Forgery on top-level navigations.
  - `Secure`: Transmitted only over HTTPS when `SKILLPILOT_SECURE_COOKIES=true` (or in production).
  - Explicit session expiry and instant revocation on logout.

### 2.2 CSRF & Origin Validation
- All state-mutating requests (`POST`, `PUT`, `DELETE`, `PATCH`) validate the HTTP `Origin` / `Referer` headers against `SKILLPILOT_ALLOWED_ORIGIN`.
- Cross-origin form posts from untrusted external sites are immediately rejected with HTTP 403 Forbidden.

### 2.3 Server-Authoritative Scoring & Zero Leakage
- **No Client-Side Answer Keys**: Diagnostic assessment questions and practice problems send only question text, code snippets, and candidate choices to the browser.
- **Server Verification**: Correct answer indexes, explanation rationales, and hint penalties are verified strictly inside the server route (`/api/assess/submit`, `/api/practice/execute`).
- **Cryptographic Fingerprints**: Skill Passport evidence items include SHA-256 integrity hashes linking student ID, skill ID, score, timestamp, and verification level.

### 2.4 SQL Parameterization & Injection Defense
- Every SQL query is parameterized using numbered placeholders (`$1, $2, ...`) via the PostgreSQL driver (`pg` / Neon serverless).
- String interpolation or dynamic query concatenation for user inputs is strictly forbidden.

### 2.5 Role-Based Access Control (RBAC)
- **Student**: Can view own progress, take assessments, submit practice problems, request approved mentors, and manage own profile privacy. Cannot access other students' unshared evidence.
- **Mentor**: Must be approved by an administrator before appearing in mentor listings. Can only review students who have actively sent a mentorship request.
- **Admin**: Cannot register via public endpoints. Created only through secure CLI bootstrap (`scripts/bootstrap-admin.mjs`). Server-side checks verify role before granting access to approval queues or user suspensions.

### 2.6 Practice Arena Code Execution Boundary
- Student code submissions for Python, JavaScript, C, C++, Java, and SQL are evaluated strictly through an isolated runner boundary (`Judge0Provider` or `PistonProvider`) with bounded timeouts, CPU, and memory limits.
- **Untrusted Code Execution**: Arbitrary shell commands or student code submissions are NEVER executed directly in the Next.js process or on the application host.
- **Strict Language Allowlist**: Only languages in the explicit allowlist (`'python' | 'javascript' | 'c' | 'cpp' | 'java' | 'sql'`) are accepted; any other input is rejected before dispatch.
- **Payload & Length Limits**: Maximum source code length is strictly enforced at 50,000 characters. Submissions exceeding this threshold are rejected with HTTP 400.
- **Bounded Polling**: Asynchronous Judge0 submissions use bounded polling (max 10 iterations, 600ms backoff) to prevent hanging worker threads.
- **Zero Client-Side Test Verification**: Expected outputs for hidden test cases are retained exclusively on the server. The client cannot forge a `success: true` flag, score, or mastery level.
- **No Evidence Without Verified Execution**: When sandbox infrastructure is unconfigured or offline, SkillPilot enters **Solution Drafting Mode** — code is accepted for syntax drafting, but verified skill evidence is never awarded for unverified runs.
- **Database Safety**: SQL problems are wrapped in an isolated in-memory/sandbox SQLite harness and never executed against SkillPilot's production PostgreSQL database.

### 2.7 LiveKit WebRTC Real-Time Calling Security
- **Server-Minted Access Tokens**: Short-lived (60-minute) LiveKit WebRTC access tokens are signed server-side using HMAC-SHA256 with `LIVEKIT_API_SECRET`.
- **Zero Client Credential Exposure**: `LIVEKIT_API_SECRET` and `LIVEKIT_API_KEY` are strictly server-only environment variables and are never bundled into client JavaScript.
- **Deterministic Room Derivation**: Room names are derived deterministically on the server as `skillpilot-mentor-call-${requestId}`. Clients cannot specify or access arbitrary room identities.
- **Strict Request Authorization**: Token generation requires an active, authenticated session. The requested mentor session must exist, have an status of `accepted` (or `completed`), and the caller must match either the `student_id` or the `mentor_id`.
- **Cross-User Call Isolation**: Unrelated students, other mentors, and anonymous visitors attempting to generate a token or join the room are rejected with HTTP 403 Forbidden.
- **Participant Grants**: Student participants receive `canPublish: true`, `canSubscribe: true`, `roomJoin: true` scoped strictly to that specific room.

### 2.8 AI Companion & Idempotency Safeguards
- Client requests to `/api/agent` include an `Idempotency-Key` header.
- Repeated submissions or accidental rapid double-clicks return the cached response rather than duplicating messages in history or consuming excess tokens.
- Internal function names, tool traces, database queries, and system prompts are stripped before responses are streamed or returned to the student UI.

### 2.9 Privacy, Data Export & Deletion
- **Public Profile Privacy**: `/p/[handle]` displays only explicitly published sections. Private student details (e.g. email, full assessment question responses, mentor chat logs) are excluded from the public serializer.
- **Account Data Export**: Students can download their complete activity ledger and evidence profile in standard JSON format.
- **Account Deletion**: Self-service account deletion anonymizes or removes personal records while maintaining database integrity.

---

## 3. Security Verification Test Evidence

The automated security test suites (`apps/web/scripts/test-security-audit.mjs` and `apps/web/scripts/test-execution-and-livekit-security.mjs`) verify these defenses against active attack vectors:

| Test Case | Scenario Tested | Expected Behavior | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Unauthenticated API Call | Requesting protected endpoint without cookie | Returns HTTP 401 Unauthorized | **PASS** |
| **SEC-02** | Host-Spoofing CSRF Attack | Sending `Origin: https://evil-attacker.example` | Returns HTTP 403 Forbidden | **PASS** |
| **SEC-03** | Privilege Escalation Attempt | Regular student calling admin approval endpoint | Returns HTTP 403 Forbidden | **PASS** |
| **SEC-04** | Cross-Student Data Isolation | Student A attempting to query Student B's evidence | Returns empty or HTTP 404 | **PASS** |
| **SEC-05** | Question Answer Leakage | Inspecting diagnostic question payload | Zero answer keys or solution indexes found | **PASS** |
| **SEC-06** | Request Idempotency | Submitting identical request with same key | Returns cached result with 0 duplicates | **PASS** |
| **SEC-07** | Private Passport Access | Requesting private user handle without permission | Returns HTTP 404 or redacted profile | **PASS** |
| **SEC-08** | Unauthenticated Execution | Calling `/api/practice/execute` without session | Returns HTTP 401 Unauthorized | **PASS** |
| **SEC-09** | Execution CSRF Attack | Calling `/api/practice/execute` with cross-origin | Returns HTTP 403 Forbidden | **PASS** |
| **SEC-10** | LiveKit Token Unauthorized | Calling `/api/mentor-requests/[id]/call/token` without auth | Returns HTTP 401 Unauthorized | **PASS** |
| **SEC-11** | LiveKit Malformed UUID | Requesting token with non-UUID room ID | Returns HTTP 400 Bad Request | **PASS** |
| **SEC-12** | LiveKit Token Cryptography | Inspecting server-minted LiveKit AccessToken | Signed HMAC-SHA256 JWT scoped to room | **PASS** |
| **SEC-13** | Code Submission Length Limit | Submitting source code > 50,000 characters | Returns HTTP 400 payload too large | **PASS** |
| **SEC-14** | Unsupported Language | Submitting unsupported language identifier | Returns HTTP 400 unsupported language | **PASS** |
| **SEC-15** | Offline Runner Honesty | Submitting code when execution provider is unset | Returns Drafting Mode, 0 fake evidence | **PASS** |

---

## 4. Threat Model & Residual Risks

1. **Client-Side Automation / Bot Scraping**:
   - *Risk*: Scripted bots attempting to brute-force diagnostic questions.
   - *Mitigation*: Rate limiting per session/IP, question bank randomization, and server-side cooldown periods.
2. **External LLM Outages / Quota Exhaustion**:
   - *Risk*: Upstream Gemini API timeouts or rate limits.
   - *Mitigation*: Graceful fallback to deterministic next-action recommendations with informative user feedback.
3. **Public Deployment WAF Requirement**:
   - In production, SkillPilot should be deployed behind Cloudflare or AWS CloudFront with managed WAF rules for DDoS protection and bot mitigation.
