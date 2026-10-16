# Mentor chat, meeting links and mock interviews

## Mentor chat
- Opens only after a mentor request is accepted.
- Only the student and mentor attached to that request can read or send messages.
- HTTP polling every 4 seconds avoids long-lived SSE infrastructure and reuses normal session authentication.
- 2,000 characters per message, 50 messages per page, 20 sends/minute and 40 refreshes/minute per user.
- Any participant can report the other participant's message. Reported messages disappear from chat and remain available to administrators.

## Video sessions
- Approved mentors can attach an HTTPS meeting link to an accepted request.
- Hosts are restricted to Google Meet, Zoom, Microsoft Teams, Jitsi Meet and Whereby.
- Optional scheduled time is stored server-side.
- This intentionally uses external meeting providers rather than adding an expensive SFU/TURN stack.

## Voice mock interviews
- Students choose a supported skill and receive three fixed open-ended questions.
- Browser speech recognition transcribes locally; no audio is uploaded to SkillPilot. Typed answers are supported as a fallback.
- The server accepts only transcripts up to 6,000 characters per question and applies a total scoring-payload ceiling.
- If `ANTHROPIC_API_KEY` is configured, one model call scores the complete interview using a fixed rubric. Otherwise a deterministic heuristic is used and clearly labelled.
- AI practice evidence has 0.35 confidence; fallback practice evidence has 0.20 confidence, deliberately below mentor review confidence.
- The interview flow is rate-limited and answer writes are first-write-wins.

## Moderation
Administrators get a chat-report section in the existing admin workspace. Reports include the message, sender, reporter, reason and request context.
