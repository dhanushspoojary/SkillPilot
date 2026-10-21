import { currentUser } from '../../../../lib/auth';
import { dbRateLimit } from '../../../../lib/guard';
import { json, readJsonBody, requireOrigin, safeText, isUuid } from '../../../../lib/server-security';
import { submitAdaptiveOnboardingAnswer } from '../../../../lib/adaptive-onboarding';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!requireOrigin(req)) {
    return json({ error: 'Origin not allowed' }, 403);
  }

  const u = await currentUser();
  if (!u || u.role !== 'student') {
    return json({ error: 'Student account required' }, 401);
  }

  try {
    const body = await readJsonBody<any>(req, 15000);
    const sessionId = safeText(body?.sessionId, 64);
    const answer = typeof body?.answer === 'string' ? body.answer.trim() : '';
    const targetRole = safeText(body?.targetRole || 'Software Engineer', 64) || 'Software Engineer';

    if (!isUuid(sessionId)) {
      return json({ error: 'Invalid sessionId' }, 400);
    }

    if (!answer) {
      return json({ error: 'Answer cannot be empty' }, 400);
    }

    if (!(await dbRateLimit(`onboarding-submit:user:${u.id}`, 40, 600000))) {
      return json({ error: 'Too many submissions. Please slow down.' }, 429);
    }

    const session = await submitAdaptiveOnboardingAnswer({
      sessionId,
      userId: u.id,
      answer,
      targetRole,
    });

    return json({ ok: true, session }, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Submission failed';
    if (msg.includes('not found') || msg.includes('unauthorized')) {
      return json({ error: 'Unauthorized or session not found' }, 404);
    }
    if (msg.includes('already completed')) {
      return json({ error: 'Assessment is already completed' }, 400);
    }
    console.error('onboarding/submit error:', err);
    return json({ error: 'Could not process adaptive answer' }, 500);
  }
}
