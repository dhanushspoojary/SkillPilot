import { handleAgentRequest, MAX_BODY_BYTES } from '../../../lib/agent';
import { currentUser } from '../../../lib/auth';
import { db, many } from '../../../lib/db';
import { dbRateLimit, networkKey } from '../../../lib/guard';
import { parseState } from '../../../lib/engine';
import { activityFromSource } from '../../../lib/activity';
import { maybeRunRetention } from '../../../lib/retention';
import { json, readJsonBody, requireOrigin } from '../../../lib/server-security';
import { appendConversationMessage } from '../../../lib/conversation';
import { getCoherentStudentContext } from '../../../lib/student-context';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90; // up to 4 sequential model calls with a 20s timeout each
const HOURLY_CAP = Number(process.env.SKILLPILOT_AGENT_HOURLY_CAP ?? 200) || 200;
const GLOBAL_CAP = Number(process.env.SKILLPILOT_AGENT_GLOBAL_CAP ?? HOURLY_CAP * 50) || HOURLY_CAP * 50;
export async function POST(req: Request) {
    if (!requireOrigin(req))
        return json({ error: 'Origin not allowed' }, 403);
    const u = await currentUser();
    if (!u || u.role !== 'student')
        return json({ error: 'Student account required' }, 401);
    // All quota checks happen BEFORE any model call is made.
    const key = `${u.id}:${networkKey(req.headers, process.env.SKILLPILOT_TRUST_PROXY === 'true')}`;
    if (!(await dbRateLimit(`agent:min:${key}`, 8, 60000)))
        return json({ error: 'Agent rate limit reached. Try again shortly.' }, 429);
    if (!(await dbRateLimit(`agent:runs:${u.id}`, HOURLY_CAP, 3600000)))
        return json({ error: 'Your hourly agent capacity has been reached. Try again later.' }, 429);
    if (!(await dbRateLimit('agent:global-safety', GLOBAL_CAP, 3600000)))
        return json({ error: 'Shared agent capacity is temporarily full. Try again later.' }, 429);
    let parsed: any;
    try {
        parsed = await readJsonBody<any>(req, MAX_BODY_BYTES);
    }
    catch (e) {
        return e instanceof Error && e.message === 'body_too_large' ? json({ error: 'Request too large' }, 413) : json({ error: 'Invalid JSON' }, 400);
    }
    if (typeof parsed?.question !== 'string' || !parsed.question.trim() || parsed.question.length > 500)
        return json({ error: 'Question must be 1-500 characters' }, 400);
    try {
        const threadId = typeof parsed?.threadId === 'string' && parsed.threadId.trim() ? parsed.threadId.trim() : undefined;
        const studentMsg = await appendConversationMessage(u.id, 'student', parsed.question, {}, threadId).catch(() => null);
        const activeThreadId = studentMsg?.threadId || threadId;

        const [evidence, requests, activity, mentors, coherentContext] = await Promise.all([
            many<any>(`select e.id,s.slug as skill,e.source as kind,e.score,e.confidence,e.captured_at as at,e.metadata,coalesce(e.metadata->>'label',e.source||' evidence') as label from user_skill_evidence e join skills s on s.id=e.skill_id where e.user_id=$1 order by e.captured_at asc`, [u.id]),
            many<any>(`select id, mentor_id as "mentorId",message,status,created_at as at from mentor_requests where student_id=$1 order by created_at desc limit 30`, [u.id]),
            many<any>(`select source as id, completed_at as at from roadmap_actions where user_id=$1 and status='completed' and completed_at is not null order by completed_at asc`, [u.id]),
            many<any>(`select u.id,u.name,mp.focus from users u join mentor_profiles mp on mp.user_id=u.id where u.role='mentor' and u.status='active' and mp.status='approved' order by mp.approved_at desc limit 20`),
            getCoherentStudentContext(u.id).catch(() => undefined),
        ]);

        // Evidence, requests and activity come from the database only. Nothing from the browser is trusted.
        const state = parseState(JSON.stringify({
            v: 2, name: u.name, evidence, requests,
            activity: activity.map((a) => activityFromSource(a.id, a.at)).filter(Boolean),
            mentorNoteResolved: activity.some((a) => a.id === 'MENTOR:feedback'),
            planNote: '', agentRuns: [],
        }));
        const apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;
        const provider: 'anthropic' | 'openai' | 'gemini' | undefined = process.env.ANTHROPIC_API_KEY ? 'anthropic' : (process.env.OPENAI_API_KEY ? 'openai' : (process.env.GEMINI_API_KEY ? 'gemini' : undefined));
        const model = process.env.ANTHROPIC_MODEL || process.env.OPENAI_MODEL || process.env.GEMINI_MODEL || (provider === 'openai' ? 'gpt-4o' : 'claude-sonnet-5-5');

        const { status, body } = await handleAgentRequest({ question: parsed.question }, {
            apiKey,
            provider,
            model,
            fetchImpl: fetch,
            state,
            studentContext: coherentContext,
            mentors: mentors.map((m) => ({ id: m.id, name: m.name, initials: m.name.split(' ').map((x: string) => x[0]).join('').slice(0, 2), focus: m.focus || 'Career mentor', strengths: {} })),
        });
        const isReply = body && !('error' in body);
        const mode = isReply ? body.mode : 'unknown';
        const proposalCount = isReply && Array.isArray(body.proposals) ? body.proposals.length : 0;
        if (isReply) {
            await appendConversationMessage(u.id, 'agent', body.answer, {
                mode: body.mode,
                steps: body.steps,
                proposals: body.proposals,
                fallbackReason: body.fallbackReason,
                model: body.model,
                provider: body.provider,
            }, activeThreadId).catch(() => {});
        }
        try {
            await db().query(`insert into agent_runs(user_id,agent,input_hash,provider,model_version,status,output) values($1,'career-orchestrator',encode(digest($2::text,'sha256'),'hex'),$3,$4,'proposed',$5)`, [u.id, parsed.question, apiKey ? provider : 'deterministic', apiKey ? model : 'deterministic-engine', JSON.stringify({ mode, proposalCount, redacted: true })]);
        }
        catch (e) {
            console.error('agent audit failed', e);
        }
        void maybeRunRetention();
        const responseData = isReply && activeThreadId ? { ...body, threadId: activeThreadId } : body;
        return json(responseData, status);
    }
    catch (e) {
        console.error('agent route failed', e);
        return json({ error: 'The agent is temporarily unavailable' }, 503);
    }
}
