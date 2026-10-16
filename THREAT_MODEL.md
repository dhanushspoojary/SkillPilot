# SkillPilot threat model

| Threat | Control |
|---|---|
| Browser edits localStorage | Server-derived profile and PostgreSQL authority |
| Forged assessment score | Server-only answer key and scoring |
| Fake mentor | Signup + profile + admin approval gate |
| Fake mentor review | Authenticated mentor ownership + request ownership + DB transaction |
| Duplicate mentor requests | Partial unique database index |
| Session theft | HttpOnly, SameSite cookie; short token entropy; session expiry; session cap |
| CSRF | Same-origin/origin validation on state-changing requests |
| Cross-site framing | CSP frame-ancestors + X-Frame-Options |
| Search-engine exposure | noindex/nosnippet and private routes |
| Automated mentor harvesting | authentication + pagination + per-user DB rate limits |
| Agent prompt injection | untrusted-message boundary + fixed system contract + allow-listed tools |
| Agent runaway loop | hard tool-step cap |
| LLM outage | deterministic fallback |
| LLM oversized response | response byte cap |
| API abuse | distributed PostgreSQL rate limits + recommended edge WAF |
| Database migration drift | migration tracking and production migration service |
| Admin action ambiguity | admin role checks + security-event audit records |

## Residual risks

- A legitimate user can copy information that their account is allowed to see.
- Credential phishing cannot be solved entirely by application code.
- DDoS protection belongs at the network/CDN layer.
- Email verification, password recovery and transactional email require a configured email provider before public launch.
- Production security claims should be validated with external testing.
