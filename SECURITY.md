# SkillPilot security model

SkillPilot is designed around a server-authoritative trust boundary.

## Identity
- Students, mentors and admins use separate roles in PostgreSQL.
- Passwords are hashed with bcrypt (cost 12 for every account, including the bootstrap admin, so login timing does not reveal admin accounts).
- Sessions are random 256-bit tokens stored only as SHA-256 hashes in PostgreSQL.
- Session cookies are HttpOnly, SameSite=Lax and Secure in production.
- Mutating routes require the exact configured Origin.

## Account recovery and enumeration
- With email verification on (production + mail provider), signup and "forgot password" return identical responses for registered and unregistered addresses; resend-verification does too.
- Verification and reset tokens are 256-bit random values, stored as SHA-256 hashes, single-use, and consumed by POST so link scanners cannot burn them.
- A password reset deletes every session for the user.
- Administrators can suspend student and mentor accounts; suspension deletes their sessions.
- IP, user-agent and email rate-limit keys are HMAC-hashed with `SKILLPILOT_HASH_SECRET`, which production refuses to start without.
- `agent_runs` and `security_events` are retained for 90 days by default.

## Evidence
- Browser storage is never an authority for scores.
- Adaptive assessments are created server-side.
- The answer key is not shipped to the browser.
- Answers are checked against the server-side question bank.
- Only the server writes assessment evidence.
- Mentor evidence can only be created by an approved mentor against a real mentor request.
- There is no public endpoint for editing/deleting evidence.

## Mentors
- There are no seeded mentor accounts.
- A mentor must create an account and remain hidden while pending.
- An administrator must approve the mentor before students can discover them.
- Mentor requests are account-bound.
- Mentor review -> evidence is an atomic PostgreSQL transaction.

## Agentic AI
The Career Agent is a bounded tool-using agent.

It can:
- read the authenticated student's server-owned evidence;
- inspect the deterministic roadmap;
- inspect currently approved mentors;
- propose a retest, action or mentor request.

It cannot:
- write evidence;
- change a score;
- approve a mentor;
- send a mentor request directly;
- change account roles;
- access another student's records.

Every agent run is audited in PostgreSQL. The model output is a proposal, never the source of truth.

## Abuse and scraping resistance
SkillPilot uses several layers rather than claiming scraping can be made impossible:
- authenticated data endpoints;
- per-account and per-network rate limits for expensive agent calls;
- bounded request bodies and provider responses;
- short server-side query limits;
- no-store responses for private data;
- no indexing directives for private API responses;
- approved-only mentor discovery;
- account ownership checks on student/mentor/admin resources;
- origin validation for browser mutations;
- strict database constraints;
- no answer key in the assessment client.

A public production deployment should additionally place the service behind a WAF/CDN with distributed rate limiting and bot management. No web application can honestly guarantee that a determined user cannot scrape information that their authenticated account is allowed to see.

## Additional hardening in this release
- Production startup fails closed unless the public origin is exact HTTPS, secure cookies remain enabled, and email verification has a configured mail provider.
- Admin moderation endpoints are rate-limited.
- Mentor self-declared skills are allowlisted to the platform skill catalog and deduplicated.
- Last-admin deletion is serialized with a database advisory lock.
- The account-deletion SECURITY DEFINER function is not executable by PUBLIC; only the dedicated application role receives EXECUTE.

## Production requirements
- Use HTTPS.
- Set a strong random `POSTGRES_PASSWORD`.
- Set an exact `SKILLPILOT_ALLOWED_ORIGIN` (never `*`).
- Bootstrap the first admin through the documented server-side command; never expose admin creation in the browser.
- Store `ANTHROPIC_API_KEY` only as a server secret.
- Enable database backups and test restoration.
- Put the app behind a reverse proxy/WAF if publicly exposed.
- Set `SKILLPILOT_TRUST_PROXY=true` only when exactly one controlled reverse proxy is in front of the app and it sanitizes forwarding headers.
- Use a shared rate-limit store when running multiple application instances.
