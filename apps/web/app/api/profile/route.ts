import { currentUser } from '../../../lib/auth';
import { many, one, db } from '../../../lib/db';
import { json, requireOrigin, safeText, readJsonBody } from '../../../lib/server-security';
import { SKILLS } from '../../../lib/questions';
import { activityFromSource } from '../../../lib/activity';
import { getStudentCapabilityProfile, saveStudentCapabilityProfile } from '../../../lib/capability-profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const u = await currentUser();
  if (!u) return json({ error: 'Unauthorized' }, 401);

  const ev = await many<any>(
    `select e.id, s.slug as skill, e.source as kind, e.score, e.confidence, e.captured_at as at, e.metadata,
            coalesce(e.metadata->>'label', e.source || ' evidence') as label
     from user_skill_evidence e
     join skills s on s.id = e.skill_id
     where e.user_id = $1
     order by e.captured_at asc`,
    [u.id]
  );

  const req = await many<any>(
    `select mr.id, mr.mentor_id as "mentorId", mr.message, mr.status, mr.created_at as at
     from mentor_requests mr
     where mr.student_id = $1
     order by mr.created_at desc limit 30`,
    [u.id]
  );

  const runsRaw = await many<any>(
    `select id, created_at as at, provider, model_version as model, status, output
     from agent_runs
     where user_id = $1
     order by created_at desc limit 30`,
    [u.id]
  );

  const runs = runsRaw.map((r: any) => ({
    id: r.id,
    at: r.at,
    mode: r.output?.body?.mode === 'ai' ? 'ai' : 'fallback',
    question: String(r.output?.question || 'Agent run').slice(0, 500),
    model: r.model,
    fallbackReason: r.output?.body?.fallbackReason,
    proposalCount: Array.isArray(r.output?.body?.proposals) ? r.output.body.proposals.length : 0,
    evidenceVersion: 'server',
  }));

  const activityRows = await many<any>(
    `select source, completed_at as at
     from roadmap_actions
     where user_id = $1 and status = 'completed' and completed_at is not null
     order by completed_at asc`,
    [u.id]
  );

  const activity = activityRows.flatMap((r: any) => {
    const a = activityFromSource(r.source, r.at);
    return a ? [a] : [];
  });

  const capabilityProfile = await getStudentCapabilityProfile(u.id);

  const careerGoalRow = await one<{ role_name: string }>(
    `select role_name from career_goals where user_id = $1 and active = true order by created_at desc limit 1`,
    [u.id]
  );
  const careerGoal = careerGoalRow?.role_name || capabilityProfile.careerInterests[0] || 'Software Engineer';

  return json({
    user: u,
    evidence: ev,
    activity,
    requests: req,
    agentRuns: runs,
    skills: SKILLS.map((s) => ({ id: s.id, name: s.name, target: s.target, weight: s.weight })),
    capabilityProfile,
    careerGoal,
  });
}

export async function PATCH(req: Request) {
  if (!requireOrigin(req)) return json({ error: 'Origin not allowed' }, 403);
  const u = await currentUser();
  if (!u) return json({ error: 'Unauthorized' }, 401);

  try {
    const b = await readJsonBody<any>(req, 20000);

    let updatedUser = u;
    if (b.name) {
      const name = safeText(b.name, 80);
      if (name && name.length >= 2) {
        const r = await db().query(
          `update users set name = $1, updated_at = now() where id = $2 returning id, email, name, role, status`,
          [name, u.id]
        );
        updatedUser = r.rows[0];
      }
    }

    if (b.capabilityProfile && typeof b.capabilityProfile === 'object') {
      await saveStudentCapabilityProfile(u.id, b.capabilityProfile);
    }

    if (b.careerGoal && typeof b.careerGoal === 'string') {
      const goal = safeText(b.careerGoal, 60);
      if (goal) {
        await db().query(
          `insert into career_goals (user_id, role_name, active, created_at)
           values ($1, $2, true, now())`,
          [u.id, goal]
        );
      }
    }

    const updatedCapability = await getStudentCapabilityProfile(u.id);

    return json({
      user: updatedUser,
      capabilityProfile: updatedCapability,
      careerGoal: b.careerGoal || updatedCapability.careerInterests[0] || 'Software Engineer',
    });
  } catch (err) {
    console.error('profile PATCH error', err);
    return json({ error: 'Could not update profile' }, 500);
  }
}
