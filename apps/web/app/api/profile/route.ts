import { currentUser } from '../../../lib/auth';
import { many, one } from '../../../lib/db';
import { json } from '../../../lib/server-security';
import { SKILLS } from '../../../lib/questions';
import { activityFromSource } from '../../../lib/activity';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() { const u = await currentUser(); if (!u)
    return json({ error: 'Unauthorized' }, 401); const ev = await many<any>(`select e.id,s.slug as skill,e.source as kind,e.score,e.confidence,e.captured_at as at,e.metadata,coalesce(e.metadata->>'label',e.source||' evidence') as label from user_skill_evidence e join skills s on s.id=e.skill_id where e.user_id=$1 order by e.captured_at asc`, [u.id]); const req = await many<any>(`select mr.id,mr.mentor_id as "mentorId",mr.message,mr.status,mr.created_at as at from mentor_requests mr where mr.student_id=$1 order by mr.created_at desc limit 30`, [u.id]); const runsRaw = await many<any>(`select id,created_at as at,provider,model_version as model,status,output from agent_runs where user_id=$1 order by created_at desc limit 30`, [u.id]); const runs = runsRaw.map((r: any) => ({ id: r.id, at: r.at, mode: r.output?.body?.mode === 'ai' ? 'ai' : 'fallback', question: String(r.output?.question || 'Agent run').slice(0, 500), model: r.model, fallbackReason: r.output?.body?.fallbackReason, proposalCount: Array.isArray(r.output?.body?.proposals) ? r.output.body.proposals.length : 0, evidenceVersion: 'server' })); const activityRows = await many<any>(`select source,completed_at as at from roadmap_actions where user_id=$1 and status='completed' and completed_at is not null order by completed_at asc`, [u.id]); const activity = activityRows.flatMap((r: any) => { const a = activityFromSource(r.source, r.at); return a ? [a] : []; }); return json({ user: u, evidence: ev, activity, requests: req, agentRuns: runs, skills: SKILLS.map(s => ({ id: s.id, name: s.name, target: s.target, weight: s.weight })) }); }
export async function PATCH(req: Request) {
    const { currentUser } = await import('../../../lib/auth');
    const { db } = await import('../../../lib/db');
    const { requireOrigin, safeText, json, readJsonBody } = await import('../../../lib/server-security');
    if (!requireOrigin(req))
        return json({ error: 'Origin not allowed' }, 403);
    const u = await currentUser();
    if (!u)
        return json({ error: 'Unauthorized' }, 401);
    try {
        const b = await readJsonBody<any>(req, 10000);
        const name = safeText(b.name, 80);
        if (!name || name.length < 2)
            return json({ error: 'Name is required' }, 400);
        const r = await db().query(`update users set name=$1,updated_at=now() where id=$2 returning id,email,name,role,status`, [name, u.id]);
        return json({ user: r.rows[0] });
    }
    catch {
        return json({ error: 'Could not update profile' }, 500);
    }
}
