import { currentUser } from '../../../../lib/auth';
import { json, requireOrigin, readJsonBody } from '../../../../lib/server-security';
import { processOnboardingTurn, transitionWorkflowStage, resetOnboardingDialogue } from '../../../../lib/workflow';

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
    const body = await readJsonBody<any>(req, 10000);

    // If student confirms the onboarding summary:
    if (body?.action === 'complete') {
      const state = await transitionWorkflowStage(u.id, 'ONBOARDING_COMPLETE');
      return json({ ok: true, state, completed: true });
    }

    // If student restarts onboarding dialogue:
    if (body?.action === 'restart') {
      const state = await resetOnboardingDialogue(u.id);
      return json({ ok: true, state, nextTurn: state.onboardingDialogue[0] });
    }

    const answer = typeof body?.answer === 'string' ? body.answer.trim() : '';
    if (!answer) {
      return json({ error: 'answer is required' }, 400);
    }

    const topic = typeof body?.topic === 'string' ? body.topic.trim() : undefined;
    const result = await processOnboardingTurn(u.id, answer, topic);
    return json(result);
  } catch (err) {
    console.error('onboarding POST error', err);
    return json({ error: 'Could not process onboarding' }, 500);
  }
}
