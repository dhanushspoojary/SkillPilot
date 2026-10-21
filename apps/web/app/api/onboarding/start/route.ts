import { currentUser } from '../../../../lib/auth';
import { dbRateLimit } from '../../../../lib/guard';
import { json, readJsonBody, requireOrigin, safeText } from '../../../../lib/server-security';
import { startAdaptiveOnboardingSession } from '../../../../lib/adaptive-onboarding';

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
    const body = await readJsonBody<any>(req, 10000).catch(() => ({}));
    const targetRole = safeText(body?.targetRole || 'Software Engineer', 64) || 'Software Engineer';

    if (!(await dbRateLimit(`onboarding-start:user:${u.id}`, 20, 3600000))) {
      return json({ error: 'Onboarding start limit reached. Please slow down.' }, 429);
    }

    const session = await startAdaptiveOnboardingSession({
      userId: u.id,
      targetRole,
    });

    return json({ ok: true, session }, 200);
  } catch (err) {
    console.error('onboarding/start error:', err);
    return json({ error: 'Could not start adaptive onboarding session' }, 500);
  }
}
