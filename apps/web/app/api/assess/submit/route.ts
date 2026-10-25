import { currentUser } from '../../../../lib/auth';
import { tx } from '../../../../lib/db';
import { dbRateLimit } from '../../../../lib/guard';
import { json, readJsonBody, requireOrigin, safeText, isUuid } from '../../../../lib/server-security';
import { QUESTIONS, publicQ } from '../../../../lib/questions';
import { answeredCount as countAnswered, totalQuestions as countTotal } from '../../../../lib/assessment';
import { evaluateResponse, selectAdaptiveNextQuestion, computeSkillAdaptiveSummary, generateAdaptiveAssessmentQuestion } from '../../../../lib/adaptive-engine';
import { canonicalizeQuestion } from '../../../../lib/question-contract';
import { getStudentCapabilityProfile } from '../../../../lib/capability-profile';
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
        const answerText = typeof b.answerText === 'string' ? safeText(b.answerText, 2000) : typeof b.explanation === 'string' ? safeText(b.explanation, 2000) : '';
        const isOpenEnded = Boolean(answerText) && !isSkip;
        const choice = isSkip ? -1 : isOpenEnded ? 0 : Number(b.choice);
        if (!isUuid(aid) || !qid || (!isSkip && !isOpenEnded && (!Number.isInteger(choice) || choice < 0 || choice > 5)))
            return json({ error: 'Invalid answer' }, 400);
        const out = await tx(async (c) => {
            const a = await c.query<any>(`select id,started_at,status,server_score from assessments where id=$1 and user_id=$2 for update`, [aid, u.id]);
            if (!a.rowCount)
                throw new Error('assessment');
            if (a.rows[0].status === 'completed') {
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
                return { recorded: true, done: true, results, overall: a.rows[0].server_score ?? 100, workflowStage: 'SKILL_BASELINE_REVIEW' };
            }
            if (Date.now() - new Date(a.rows[0].started_at).getTime() > 30 * 60000) {
                await c.query(`update assessments set status='abandoned' where id=$1`, [aid]);
                throw new Error('expired');
            }
            let item = await c.query<any>(`select id,question_id,skill_slug,response,prompt from assessment_items where assessment_id=$1 and question_id=$2 for update`, [aid, qid]);
            if (!item.rowCount && (qid === 'current' || isSkip)) {
                item = await c.query<any>(`select id,question_id,skill_slug,response,prompt from assessment_items where assessment_id=$1 and response is null order by position limit 1 for update`, [aid]);
            }
            if (!item.rowCount)
                throw new Error('question');
            if (item.rows[0].response) {
                const answered = await c.query<any>(`select question_id,skill_slug,prompt,response,score from assessment_items where assessment_id=$1 order by position`, [aid]);
                const answeredCount = countAnswered(answered.rows);
                const totalQuestions = countTotal(answered.rows);
                const remaining = await c.query<any>(`select question_id,skill_slug,prompt from assessment_items where assessment_id=$1 and response is null order by position limit 1`, [aid]);
                if (remaining.rowCount) {
                    const promptObj = typeof remaining.rows[0].prompt === 'string' ? JSON.parse(remaining.rows[0].prompt) : remaining.rows[0].prompt;
                    const canonical = canonicalizeQuestion(promptObj, remaining.rows[0].question_id, remaining.rows[0].skill_slug) || {
                        ...promptObj,
                        id: remaining.rows[0].question_id,
                        skill: remaining.rows[0].skill_slug,
                    };
                    return { recorded: true, done: false, index: answeredCount, total: totalQuestions, question: canonical };
                }
                const comp = await c.query<any>(`select server_score from assessments where id=$1 and status='completed'`, [aid]);
                if (comp.rowCount) {
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
                    return { recorded: true, done: true, results, overall: comp.rows[0].server_score ?? 100, workflowStage: 'SKILL_BASELINE_REVIEW' };
                }
            }
            let q = QUESTIONS.find(x => x.id === item.rows[0].question_id || x.id === qid);
            if (!q && item.rows[0].prompt) {
                try {
                    const p = typeof item.rows[0].prompt === 'string' ? JSON.parse(item.rows[0].prompt) : item.rows[0].prompt;
                    if (p) {
                        q = {
                            id: p.id || item.rows[0].question_id,
                            skill: p.skill || p.skill_slug || item.rows[0].skill_slug,
                            level: Number(p.level ?? p.difficulty ?? 1),
                            q: p.q || p.text || p.prompt || '',
                            options: Array.isArray(p.options) ? p.options : [],
                            answer: Number(p.answer ?? 0),
                            why: p.why || '',
                        };
                    }
                } catch {
                    /* parse error */
                }
            }
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
                        answerText: answerText || undefined,
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
            const skillAnswered = answered.rows.filter((r: any) => r.skill_slug === skill && r.response !== null);
            const currentSkillItems = skillAnswered.map((it: any) => {
                const promptObj = typeof it.prompt === 'string' ? JSON.parse(it.prompt) : it.prompt;
                const questionObj = QUESTIONS.find((x) => x.id === promptObj?.id) || {
                    id: promptObj?.id || it.question_id,
                    skill,
                    level: Number(promptObj?.level ?? 1),
                    q: promptObj?.q || '',
                    options: promptObj?.options || [],
                    answer: 0,
                    why: '',
                };
                const respObj = typeof it.response === 'string' ? JSON.parse(it.response) : it.response;
                return { question: questionObj, response: respObj || {} };
            });

            const currentSkillSummary = computeSkillAdaptiveSummary({ skill, items: currentSkillItems });

            // If decisive evidence has not been reached and question limit for skill (< 4) not exceeded, select next adaptive question
            if (!currentSkillSummary.decisiveEvidenceReached && currentSkillItems.length < 4) {
                const used = new Set(answered.rows.map((r: any) => r.question_id));
                const usedTexts = answered.rows.map((r: any) => {
                    try {
                        const p = typeof r.prompt === 'string' ? JSON.parse(r.prompt) : r.prompt;
                        return p.q || p.text || '';
                    } catch {
                        return '';
                    }
                }).filter(Boolean);

                const capability = await getStudentCapabilityProfile(u.id).catch(() => null);

                const next = await generateAdaptiveAssessmentQuestion({
                    skill,
                    currentQuestion: q,
                    evalResult,
                    usedQuestionIds: used,
                    usedQuestionTexts: usedTexts,
                    studentProfile: capability ?? undefined,
                });
                if (next) {
                    await c.query(
                        `insert into assessment_items(assessment_id,question_id,skill_slug,prompt) values($1,$2,$3,$4)`,
                        [aid, next.id, next.skill, JSON.stringify(publicQ(next))]
                    );
                    const direction = next.level > q.level ? 'ELEVATED' : next.level < q.level ? 'DIAGNOSTIC' : 'RESOLVING';
                    const reason = direction === 'ELEVATED'
                        ? `Answer correct! Demonstrated mastery at Level ${q.level}. Elevating to Level ${next.level} to test deeper application.`
                        : direction === 'DIAGNOSTIC'
                        ? `Answer incorrect. Struggle at Level ${q.level}. Routing to Level ${next.level} diagnostic to isolate foundational concepts.`
                        : `Assessing clarifying question at Level ${next.level} to resolve uncertainty.`;

                    return {
                        recorded: true,
                        done: false,
                        index: answeredCount,
                        total: Math.max(answeredCount + 1, totalQuestions),
                        question: publicQ(next),
                        adaptation: {
                            direction,
                            previousLevel: q.level,
                            nextLevel: next.level,
                            reason,
                            skill,
                            evidenceCount: currentSkillItems.length,
                            decisiveReached: false,
                        },
                        evalResult: {
                            classification: evalResult.classification,
                            explanation: evalResult.explanation,
                            misconception: evalResult.misconceptionIdentified,
                        },
                    };
                }
            }

            // If decisive evidence is reached for this skill, check if there are other un-assessed skills in the session
            const remaining = await c.query<any>(`select question_id,skill_slug,prompt from assessment_items where assessment_id=$1 and response is null order by position limit 1`, [aid]);
            if (remaining.rowCount) {
                const promptObj = typeof remaining.rows[0].prompt === 'string' ? JSON.parse(remaining.rows[0].prompt) : remaining.rows[0].prompt;
                const canonical = canonicalizeQuestion(promptObj, remaining.rows[0].question_id, remaining.rows[0].skill_slug) || {
                    ...promptObj,
                    id: remaining.rows[0].question_id,
                    skill: remaining.rows[0].skill_slug,
                };
                return {
                    recorded: true,
                    done: false,
                    index: answeredCount,
                    total: totalQuestions,
                    question: canonical,
                    adaptation: {
                        direction: 'RESOLVING',
                        previousLevel: q.level,
                        nextLevel: Number(promptObj?.level ?? 1),
                        reason: `Skill '${skill}' reached decisive evidence. Advancing to next planned skill: ${promptObj.skill || 'next'}.`,
                        skill: promptObj.skill || skill,
                        evidenceCount: answeredCount,
                        decisiveReached: true,
                    },
                    evalResult: {
                        classification: evalResult.classification,
                        explanation: evalResult.explanation,
                        misconception: evalResult.misconceptionIdentified,
                    },
                };
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
            return {
                recorded: true,
                done: true,
                results,
                overall,
                workflowStage: 'SKILL_BASELINE_REVIEW',
                stoppingDecision: {
                    reason: 'Decisive evidence criteria satisfied or question limit reached',
                    totalQuestionsAsked: answeredCount,
                }
            };
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
