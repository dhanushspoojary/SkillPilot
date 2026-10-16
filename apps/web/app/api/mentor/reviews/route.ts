import { currentUser } from '../../../../lib/auth';
import { tx } from '../../../../lib/db';
import { dbRateLimit } from '../../../../lib/guard';
import { json, readJsonBody, requireOrigin, safeText, isUuid, logSecurityEvent } from '../../../../lib/server-security';
import { SKILLS } from '../../../../lib/questions';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
    if (!requireOrigin(req))
        return json({ error: 'Origin not allowed' }, 403);
    const u = await currentUser();
    if (!u || u.role !== 'mentor' || !u.mentorApproved)
        return json({ error: 'Approved mentor account required' }, 403);
    if (!(await dbRateLimit(`mentor-review:${u.id}`, 10, 3600000)))
        return json({ error: 'Mentor review limit reached for this hour.' }, 429);
    try {
        const b = await readJsonBody<any>(req, 20000);
        const requestId = safeText(b.requestId, 64), skill = safeText(b.skill, 64), review = safeText(b.review, 2000);
        const score = Number(b.score);
        if (!isUuid(requestId) || !skill || !review || review.length < 10 || !Number.isFinite(score) || score < 0 || score > 100)
            return json({ error: 'Valid request, skill, score and review are required' }, 400);
        if (!SKILLS.some(s => s.id === skill))
            return json({ error: 'Unknown skill' }, 400);
        const out = await tx(async (c) => {
            const q = await c.query<any>(`select mr.id,mr.student_id,mr.mentor_id,mr.status,mp.skills from mentor_requests mr join mentor_profiles mp on mp.user_id=mr.mentor_id join users mentor on mentor.id=mr.mentor_id where mr.id=$1 and mr.mentor_id=$2 and mentor.status='active' and mp.status='approved' for update`, [requestId, u.id]);
            if (!q.rowCount)
                throw new Error('request_not_found');
            if (q.rows[0].student_id === u.id)
                throw new Error('self_review');
            if (q.rows[0].status !== 'accepted')
                throw new Error('request_not_accepted');
            const mentorSkills = Array.isArray(q.rows[0].skills) ? q.rows[0].skills : [];
            if (mentorSkills.length && !mentorSkills.includes(skill))
                throw new Error('skill_not_listed');
            const r = q.rows[0];
            const reviewRow = await c.query<any>(`insert into mentor_reviews(request_id,mentor_id,student_id,skill_slug,score,confidence,review) values($1,$2,$3,$4,$5,.65,$6) returning id,score,review,created_at as at`, [requestId, u.id, r.student_id, skill, score, review]);
            const skillRow = await c.query<any>('select id from skills where slug=$1', [skill]);
            await c.query(`insert into user_skill_evidence(user_id,skill_id,source,score,confidence,metadata) values($1,$2,'mentor',$3,.65,$4)`, [r.student_id, skillRow.rows[0].id, score, JSON.stringify({ label: 'Mentor review', reviewId: reviewRow.rows[0].id, mentorId: u.id })]);
            await c.query(`update mentor_requests set status='completed',responded_at=now() where id=$1`, [requestId]);
            return reviewRow.rows[0];
        });
        await logSecurityEvent({ userId: u.id, eventType: 'mentor.review_created', userAgent: req.headers.get('user-agent'), metadata: { requestId, skill, score } });
        return json({ review: out }, 201);
    }
    catch (e) {
        const m = e instanceof Error ? e.message : '';
        if (m === 'request_not_found' || m === 'skill_not_listed')
            return json({ error: 'Request or mentor skill not found' }, 404);
        if (m === 'request_not_accepted')
            return json({ error: 'The student request must be accepted before reviewing' }, 409);
        if (m === 'self_review')
            return json({ error: 'A mentor cannot review their own account' }, 400);
        return json({ error: 'Could not save mentor review' }, 500);
    }
}
