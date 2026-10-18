import { currentUser } from '../../../../lib/auth';
import { tx } from '../../../../lib/db';
import { dbRateLimit } from '../../../../lib/guard';
import { json, readJsonBody, requireOrigin, safeText, isUuid } from '../../../../lib/server-security';
import { QUESTIONS, publicQ } from '../../../../lib/questions';
import { answeredCount as countAnswered, totalQuestions as countTotal } from '../../../../lib/assessment';
import { evaluateResponse, selectAdaptiveNextQuestion, computeSkillAdaptiveSummary } from '../../../../lib/adaptive-engine';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
    if (!requireOrigin(req))
        return json({ error: 'Origin not allowed' }, 403);
    const u = await currentUser();
    if (!u || u.role !== 'student')
        return json({ error: 'Student account required' }, 401);
    if (!(await dbRateLimit(`assess-submit:${u.id}`, 40, 10 * 60000)))
        return json({ error: 'Too many assessment answers. Slow down.' }, 429);
    try {
        const b = await readJsonBody<any>(req, 10000);
        const aid = safeText(b.assessmentId, 64), qid = safeText(b.questionId, 80);
        const isSkip = b.action === 'skip' || b.action === 'dont_know' || Number(b.choice) === -1;
        const choice = isSkip ? -1 : Number(b.choice);
        if (!isUuid(aid) || !qid || (!isSkip && (!Number.isInteger(choice) || choice < 0 || choice > 5)))
            return json({ error: 'Invalid answer' }, 400);
        const out = await tx(async (c) => {
            const a = await c.query<any>(`select id,started_at from assessments where id=$1 and user_id=$2 and status='started' for update`, [aid, u.id]);
            if (!a.rowCount)
                throw new Error('assessment');
            if (Date.now() - new Date(a.rows[0].started_at).getTime() > 30 * 60000) {
                await c.query(`update assessments set status='abandoned' where id=$1`, [aid]);
                throw new Error('expired');
            }
            const item = await c.query<any>(`select id,question_id,skill_slug,response from assessment_items where assessment_id=$1 and question_id=$2 for update`, [aid, qid]);
            if (!item.rowCount)
                throw new Error('question');
            if (item.rows[0].response) {
                let prevChoice: number | null = null;
                try {
                    const parsed = typeof item.rows[0].response === 'string' ? JSON.parse(item.rows[0].response) : item.rows[0].response;
                    prevChoice = parsed?.choice;
                } catch {}
                if (prevChoice === choice) {
                    const answered = await c.query<any>(`select question_id,skill_slug,prompt,response,score from assessment_items where assessment_id=$1 order by position`, [aid]);
                    const answeredCount = countAnswered(answered.rows);
                    const totalQuestions = countTotal(answered.rows);
                    const remaining = await c.query<any>(`select question_id,skill_slug,prompt from assessment_items where assessment_id=$1 and response is null order by position limit 1`, [aid]);
                    if (remaining.rowCount) {
                        const promptObj = typeof remaining.rows[0].prompt === 'string' ? JSON.parse(remaining.rows[0].prompt) : remaining.rows[0].prompt;
                        return { recorded: true, done: false, index: answeredCount, total: totalQuestions, question: promptObj };
                    }
                    const comp = await c.query<any>(`select server_score from assessments where id=$1 and status='completed'`, [aid]);
                    if (comp.rowCount) {
                        return { recorded: true, done: true, overall: comp.rows[0].server_score };
                    }
                }
                throw new Error('answered');
            }
            const q = QUESTIONS.find(x => x.id === qid);
            if (!q)
                throw new Error('question');
            
            const evalResult = evaluateResponse(q, {
                choice: isSkip ? -1 : choice,
                action: isSkip ? 'skip' : undefined,
            });

            await c.query(
                `update assessment_items set response=$1,score=$2 where id=$3`,
                [
                    JSON.stringify({
                        choice: isSkip ? -1 : choice,
                        classification: evalResult.classification,
                        misconception: evalResult.misconceptionIdentified,
                        verifiedConcept: evalResult.verifiedConcept,
                        conceptNeedingEvidence: evalResult.conceptNeedingEvidence,
                    }),
                    evalResult.isEvidence ? evalResult.earnedPoints : null,
                    item.rows[0].id
                ]
            );

            const answered = await c.query<any>(`select question_id,skill_slug,prompt,response,score from assessment_items where assessment_id=$1 order by position`, [aid]);
            const answeredCount = countAnswered(answered.rows); // includes the answer just stored
            const totalQuestions = countTotal(answered.rows);
            const skill = item.rows[0].skill_slug;

            // Adaptive question progression: evaluate skill evidence decisive condition
            const skillAnswered = answered.rows.filter((r: any) => r.skill_slug === skill);
            if (skillAnswered.length === 1) {
                const used = new Set(answered.rows.map((r: any) => r.question_id));
                const next = selectAdaptiveNextQuestion({
                    skill,
                    currentQuestion: q,
                    evalResult,
                    usedQuestionIds: used,
                });
                if (next) {
                    await c.query(
                        `insert into assessment_items(assessment_id,question_id,skill_slug,prompt) values($1,$2,$3,$4)`,
                        [aid, next.id, next.skill, JSON.stringify(publicQ(next))]
                    );
                    return {
                        recorded: true,
                        done: false,
                        index: answeredCount,
                        total: totalQuestions,
                        question: publicQ(next),
                        evalResult: {
                            classification: evalResult.classification,
                            explanation: evalResult.explanation,
                            misconception: evalResult.misconceptionIdentified,
                        },
                    };
                }
            }

            const remaining = await c.query<any>(`select question_id,skill_slug,prompt from assessment_items where assessment_id=$1 and response is null order by position limit 1`, [aid]);
            if (remaining.rowCount) {
                const promptObj = typeof remaining.rows[0].prompt === 'string' ? JSON.parse(remaining.rows[0].prompt) : remaining.rows[0].prompt;
                return { recorded: true, done: false, index: answeredCount, total: totalQuestions, question: promptObj };
            }

            const rows = await c.query<any>(`select skill_slug,position,prompt,response,score from assessment_items where assessment_id=$1 order by position`, [aid]);
            const bySkill = new Map<string, any[]>();
            for (const r of rows.rows) {
                const list = bySkill.get(r.skill_slug) ?? [];
                list.push(r);
                bySkill.set(r.skill_slug, list);
            }

            const results = [...bySkill.entries()].map(([sSlug, items]) => {
                const skillItems = items.map((it: any) => {
                    const promptObj = typeof it.prompt === 'string' ? JSON.parse(it.prompt) : it.prompt;
                    const questionObj = QUESTIONS.find((x) => x.id === promptObj?.id) || {
                        id: promptObj?.id || 'q',
                        skill: sSlug,
                        level: Number(promptObj?.level ?? 1),
                        q: promptObj?.q || '',
                        options: promptObj?.options || [],
                        answer: 0,
                        why: '',
                    };
                    const respObj = typeof it.response === 'string' ? JSON.parse(it.response) : it.response;
                    return { question: questionObj, response: respObj || {} };
                });

                const summary = computeSkillAdaptiveSummary({ skill: sSlug, items: skillItems });
                return {
                    skill: sSlug,
                    asked: items.length,
                    score: summary.proficiency,
                    confidence: summary.confidence,
                    verifiedConcepts: summary.verifiedConcepts,
                    conceptsNeedingEvidence: summary.conceptsNeedingEvidence,
                    misconceptions: summary.misconceptions,
                    nextAction: summary.nextAction,
                };
            });

            const overall = Math.round(results.reduce((s: number, r: any) => s + r.score, 0) / Math.max(1, results.length));
            for (const r of results) {
                const skill = (await c.query<any>('select id from skills where slug=$1', [r.skill])).rows[0];
                if (skill) {
                    await c.query(
                        `insert into user_skill_evidence(user_id,skill_id,source,score,confidence,metadata) values($1,$2,'assessment',$3,$4,$5)`,
                        [
                            u.id,
                            skill.id,
                            r.score,
                            r.confidence,
                            JSON.stringify({
                                label: 'Server-scored adaptive assessment',
                                assessmentId: aid,
                                verifiedConcepts: r.verifiedConcepts,
                                conceptsNeedingEvidence: r.conceptsNeedingEvidence,
                                misconceptions: r.misconceptions,
                                nextAction: r.nextAction,
                                timestamp: new Date().toISOString(),
                            }),
                        ]
                    );
                }
            }
            await c.query(`update assessments set status='completed',completed_at=now(),server_score=$1 where id=$2`, [overall, aid]);
            await c.query(
                `insert into student_workflow_states(user_id, stage, updated_at)
                 values($1, 'SKILL_BASELINE_REVIEW', now())
                 on conflict(user_id) do update set stage = 'SKILL_BASELINE_REVIEW', updated_at = now()`,
                [u.id],
            );
            return { recorded: true, done: true, results, overall, workflowStage: 'SKILL_BASELINE_REVIEW' };
        });
        return json(out);
    }
    catch (e) {
        const m = e instanceof Error ? e.message : '';
        if (m === 'assessment' || m === 'question' || m === 'answered' || m === 'expired')
            return json({ error: 'Assessment state is invalid or expired' }, 409);
        if (m === 'body_too_large')
            return json({ error: 'Request too large' }, 413);
        if (m === 'invalid_json')
            return json({ error: 'Invalid JSON' }, 400);
        return json({ error: 'Could not score answer' }, 500);
    }
}
