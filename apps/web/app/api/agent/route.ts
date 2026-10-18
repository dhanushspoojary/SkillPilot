import { handleAgentRequest, MAX_BODY_BYTES } from '../../../lib/agent';
import { currentUser } from '../../../lib/auth';
import { db, many, one } from '../../../lib/db';
import { dbRateLimit, networkKey } from '../../../lib/guard';
import { parseState } from '../../../lib/engine';
import { activityFromSource } from '../../../lib/activity';
import { maybeRunRetention } from '../../../lib/retention';
import { json, readJsonBody, requireOrigin } from '../../../lib/server-security';
import { appendConversationMessage } from '../../../lib/conversation';
import { getCoherentStudentContext, addStudentMemory } from '../../../lib/student-context';
import { handleNaturalLanguagePreferenceRequest } from '../../../lib/roadmap-preferences';
import { getActiveLLMProvider, isAgentEnabled, redactSecrets } from '../../../lib/llm-provider';
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

        // Contextually infer and persist student constraints / struggles to durable memory
        const qLower = parsed.question.toLowerCase();
        if (qLower.includes('30 minutes') || qLower.includes('30 mins')) {
            await addStudentMemory(u.id, 'preference', 'Available 30 minutes daily for deliberate practice', 'student_input').catch(() => {});
        }
        if (qLower.includes('struggle with pointer') || qLower.includes('struggling with pointer') || qLower.includes('pointers in c')) {
            await addStudentMemory(u.id, 'struggle', 'Struggling with pointers and memory addresses in C', 'student_input').catch(() => {});
        }

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

        // Handle natural language preference adjustments or prerequisite rationale
        if (/explain\s+simpler|simpler\s+explanation|20\s+minute|30\s+minute|short\s+session|focus\s+on\s+c|c\s+first|focus\s+on\s+rest|rest\s+api|apis\s+first|harder\s+challenge|fewer\s+question|why\s+this/i.test(parsed.question)) {
            const prefResult = await handleNaturalLanguagePreferenceRequest(u.id, parsed.question, state).catch(() => null);
            if (prefResult) {
                let answerText = prefResult.summary;
                if (prefResult.conflictWarning) {
                    answerText = `${prefResult.conflictWarning} ${prefResult.recommendedAlternative || ''}`;
                }
                const prefBody = {
                    mode: 'deterministic' as const,
                    answer: answerText,
                    steps: [{ tool: 'calibrate_learning_schedule', input: { query: parsed.question }, result: JSON.stringify(prefResult) }],
                    proposals: prefResult.newTopAction ? [{
                        id: `prop-${Date.now()}`,
                        type: 'start_retest' as const,
                        skill: prefResult.newTopAction.skill,
                        actionId: prefResult.newTopAction.id,
                        reason: prefResult.summary,
                    }] : [],
                };
                await appendConversationMessage(u.id, 'agent', prefBody.answer, {
                    mode: prefBody.mode,
                    steps: prefBody.steps,
                    proposals: prefBody.proposals,
                }, activeThreadId).catch(() => {});
                try {
                    await db().query(
                        `insert into agent_runs(user_id,agent,input_hash,provider,model_version,status,output) values($1,'career-orchestrator',encode(digest($2::text,'sha256'),'hex'),'deterministic','deterministic-engine','proposed',$3)`,
                        [u.id, parsed.question, JSON.stringify({ mode: 'deterministic', proposalCount: prefBody.proposals.length, redacted: true })],
                    );
                } catch {}
                void maybeRunRetention();
                return json({ ...prefBody, threadId: activeThreadId }, 200);
            }
        }
        const activeProvider = getActiveLLMProvider();
        const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
        const provider: 'gemini' | 'anthropic' | 'openai' | undefined = activeProvider.providerName !== 'deterministic' && activeProvider.providerName !== 'disabled'
            ? (activeProvider.providerName as any)
            : undefined;
        const model = activeProvider.strongModel;

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

            // If a practice submission was evaluated and verified, record authoritative practice evidence
            if ((body as any).evaluatedPractice?.passed) {
                const ep = (body as any).evaluatedPractice;
                const skillRow = await one<{ id: string }>(`select id from skills where slug = $1`, [ep.skillId]).catch(() => null);
                if (skillRow) {
                    await db().query(
                        `insert into user_skill_evidence(user_id, skill_id, source, score, confidence, metadata)
                         values($1, $2, 'practice', $3, $4, $5)`,
                        [
                            u.id,
                            skillRow.id,
                            ep.score || 88,
                            ep.confidence || 0.65,
                            JSON.stringify({
                                label: ep.label || 'Career AI: Verified Practice Submission',
                                topic: ep.topic || 'c-pointers',
                                evaluatedAt: new Date().toISOString(),
                            }),
                        ],
                    ).catch(() => {});

                    // Auto-complete corresponding roadmap action
                    await db().query(
                        `insert into roadmap_actions(user_id, title, week_start, priority, status, source, completed_at)
                         values($1, $2, current_date, 0, 'completed', $3, now())
                         on conflict do nothing`,
                        [u.id, ep.label, `practice-${ep.topic || 'c-pointers'}`],
                    ).catch(() => {});
                }
            }
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
