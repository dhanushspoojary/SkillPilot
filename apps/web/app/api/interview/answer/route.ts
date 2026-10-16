import { currentUser } from '../../../../lib/auth';
import { one } from '../../../../lib/db';
import { dbRateLimit } from '../../../../lib/guard';
import { json, readJsonBody, requireOrigin, isUuid } from '../../../../lib/server-security';
import { INTERVIEW_MAX_TRANSCRIPT } from '../../../../lib/interview';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!requireOrigin(req)) return json({ error: 'Origin not allowed' }, 403);
  const u = await currentUser();
  if (!u || u.role !== 'student') return json({ error: 'Student account required' }, 401);
  if (!(await dbRateLimit(`interview-answer:${u.id}`, 60, 60000))) return json({ error: 'Too many submissions. Slow down.' }, 429);
  try {
    const b = await readJsonBody<any>(req, 30000);
    const interviewId = typeof b.interviewId === 'string' ? b.interviewId : null;
    const position = Number(b.position);
    const transcript = typeof b.transcript === 'string' ? b.transcript.trim() : '';
    const latencyMs = Number.isFinite(Number(b.latencyMs)) ? Math.max(0, Math.min(600000, Math.round(Number(b.latencyMs)))) : null;
    if (!isUuid(interviewId) || !Number.isInteger(position) || position < 1 || position > 10)
      return json({ error: 'Valid interview and question are required' }, 400);
    if (!transcript || transcript.length > INTERVIEW_MAX_TRANSCRIPT)
      return json({ error: `Transcript must be 1-${INTERVIEW_MAX_TRANSCRIPT} characters` }, 400);
    const out = await one<any>(
      `update mock_interview_questions q set transcript=$1,latency_ms=$2
       from mock_interviews i
       where q.interview_id=i.id and i.user_id=$3 and i.status='started'
         and q.interview_id=$4 and q.position=$5 and q.transcript is null
       returning q.id`,
      [transcript, latencyMs, u.id, interviewId, position],
    );
    if (!out) return json({ error: 'Question is already answered or the interview is closed' }, 409);
    return json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : '';
    if (message === 'body_too_large') return json({ error: 'Request body is too large' }, 413);
    if (message === 'invalid_json') return json({ error: 'Invalid JSON body' }, 400);
    return json({ error: 'Could not save answer' }, 500);
  }
}
