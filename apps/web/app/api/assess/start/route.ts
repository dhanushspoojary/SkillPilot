import { currentUser } from '../../../../lib/auth';
import { many, tx } from '../../../../lib/db';
import { dbRateLimit } from '../../../../lib/guard';
import { json, readJsonBody, requireOrigin, safeText } from '../../../../lib/server-security';
import { QUESTIONS, SKILLS, publicQ } from '../../../../lib/questions';
import { answeredCount, nextUnanswered, totalQuestions } from '../../../../lib/assessment';
import { getStudentCapabilityProfile } from '../../../../lib/capability-profile';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const COOLDOWN_MS = 30 * 60000;
const MAX_ACTIVE_MS = 30 * 60000;
function shuffle<T>(items: T[]): T[] {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
export async function POST(req: Request) {
    if (!requireOrigin(req))
        return json({ error: 'Origin not allowed' }, 403);
    const u = await currentUser();
    if (!u || u.role !== 'student')
        return json({ error: 'Student account required' }, 401);
    try {
        const b = await readJsonBody<any>(req, 10000).catch((e) => { if (e instanceof Error && e.message === 'body_too_large')
            throw e; return {}; });
        const focus = safeText(b.focus, 40);
        const capability = await getStudentCapabilityProfile(u.id);
        const isBeginner = capability.programmingExperience === 'beginner' || capability.educationLevel === 'first_year';
        const startingLevel = isBeginner ? 1 : 2;
        const result = await tx(async (c) => {
            // Serialise concurrent starts for the same user (double clicks, StrictMode, two tabs).
            await c.query('select pg_advisory_xact_lock(hashtext($1))', [`assess-start:${u.id}`]);
            // Abandoned attempts cannot remain open forever.
            await c.query(`update assessments set status='abandoned' where user_id=$1 and status='started' and started_at < now()-interval '30 minutes'`, [u.id]);
            // Resume an in-progress assessment instead of locking the student out for 30 minutes.
            const active = await c.query<any>(`select id from assessments where user_id=$1 and status='started' order by started_at desc limit 1`, [u.id]);
            if (active.rowCount) {
                const items = await c.query<any>(`select skill_slug,prompt,response from assessment_items where assessment_id=$1 order by position`, [active.rows[0].id]);
                const next = nextUnanswered(items.rows);
                if (next) {
                    const parsedQ = typeof next.prompt === 'string' ? JSON.parse(next.prompt) : next.prompt;
                    return { id: active.rows[0].id, question: parsedQ, total: totalQuestions(items.rows), index: answeredCount(items.rows), resumed: true };
                }
                await c.query(`update assessments set status='abandoned' where id=$1`, [active.rows[0].id]);
            }
            if (!(await dbRateLimit(`assess-start:user:${u.id}`, 10, 3600000, Date.now(), c)))
                throw new Error('rate_limit');
            const recent = await c.query(`select 1 from assessments where user_id=$1 and status='completed' and completed_at > now()-interval '30 minutes' limit 1`, [u.id]);
            if (recent.rowCount)
                throw new Error('cooldown');
            const assessable = SKILLS.filter(s => s.assessable);
            let selected: string[];
            if (focus && assessable.some(s => s.id === focus)) {
                selected = [focus];
            } else if (isBeginner) {
                selected = ['problem-solving', 'git', 'communication'];
            } else {
                selected = shuffle(assessable.map(s => s.id));
            }
            const qs = [] as typeof QUESTIONS;
            // Select starting question tailored to student background (Level 1 for beginners, Level 2 for experienced)
            for (const skill of selected) {
                const pool = shuffle(QUESTIONS.filter(q => q.skill === skill));
                const targetQ = pool.find(q => q.level === startingLevel) ?? pool.find(q => q.level === 1) ?? pool[0];
                qs.push(targetQ);
            }
            const a = (await c.query<any>(`insert into assessments(user_id,kind,version,status) values($1,'adaptive','v5','started') returning id`, [u.id])).rows[0];
            for (const q of qs)
                await c.query(`insert into assessment_items(assessment_id,question_id,skill_slug,prompt) values($1,$2,$3,$4)`, [a.id, q.id, q.skill, JSON.stringify(publicQ(q))]);
            return { id: a.id, question: publicQ(qs[0]), total: qs.length * 2, index: 0, resumed: false };
        });
        return json({ assessmentId: result.id, total: result.total, index: result.index, question: result.question, resumed: result.resumed }, result.resumed ? 200 : 201);
    }
    catch (e) {
        const m = e instanceof Error ? e.message : '';
        if (m === 'rate_limit')
            return json({ error: 'Assessment start limit reached. Try again later.' }, 429);
        if (m === 'cooldown')
            return json({ error: 'Please wait 30 minutes between completed assessments.' }, 429);
        if (m === 'body_too_large')
            return json({ error: 'Request too large' }, 413);
        console.error('assess/start error:', e);
        return json({ error: 'Could not start assessment' }, 500);
    }
}
