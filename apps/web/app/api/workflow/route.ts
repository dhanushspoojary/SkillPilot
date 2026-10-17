import { currentUser } from '../../../lib/auth';
import { json, requireOrigin, readJsonBody } from '../../../lib/server-security';
import {
  getOrComputeWorkflowState,
  confirmSkillBaseline,
  confirmLearningGoals,
  transitionWorkflowStage,
  type WorkflowStage,
} from '../../../lib/workflow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const u = await currentUser();
  if (!u || u.role !== 'student') {
    return json({ error: 'Student account required' }, 401);
  }

  const state = await getOrComputeWorkflowState(u.id);
  return json({ ok: true, workflow: state, state, guidance: state });
}

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
    const action = typeof body?.action === 'string' ? body.action : '';

    if (action === 'confirm_skills') {
      const skills = body?.skills && typeof body.skills === 'object'
        ? body.skills
        : Array.isArray(body?.confirmedSkills)
        ? Object.fromEntries(body.confirmedSkills.map((s: any) => [s.skill, s.score]))
        : {};
      const updated = await confirmSkillBaseline(u.id, skills);
      return json({ ok: true, workflow: updated, state: updated, guidance: updated });
    }

    if (action === 'confirm_goals') {
      const goals = Array.isArray(body?.goals) ? body.goals : ['Software Engineer'];
      const updated = await confirmLearningGoals(u.id, goals);
      return json({ ok: true, workflow: updated, state: updated, guidance: updated });
    }

    if (action === 'transition') {
      const target = body?.targetStage as WorkflowStage;
      if (!target) return json({ error: 'targetStage is required' }, 400);
      const updated = await transitionWorkflowStage(u.id, target);
      return json({ ok: true, workflow: updated, state: updated, guidance: updated });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (err) {
    console.error('workflow POST error', err);
    return json({ error: 'Could not update workflow' }, 500);
  }
}
