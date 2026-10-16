import { currentUser } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { json, requireOrigin, safeText, isUuid, readJsonBody } from '../../../../lib/server-security';
import { dbRateLimit } from '../../../../lib/guard';
export const runtime = 'nodejs';
export async function POST(req: Request) { if (!requireOrigin(req))
    return json({ error: 'Origin not allowed' }, 403); const u = await currentUser(); if (u && !(await dbRateLimit(`mentor-request:${u.id}`, 10, 3600000)))
    return json({ error: 'Mentor request limit reached for today.' }, 429); if (!u || u.role !== 'student')
    return json({ error: 'Student account required' }, 401); try {
    const b = await readJsonBody<any>(req, 20000);
    const mentorId = safeText(b.mentorId, 64), message = safeText(b.message, 1200);
    if (!isUuid(mentorId) || !message)
        return json({ error: 'Mentor and message are required' }, 400);
    const ok = await db().query(`select 1 from users u join mentor_profiles mp on mp.user_id=u.id where u.id=$1 and u.role='mentor' and u.status='active' and mp.status='approved'`, [mentorId]);
    if (!ok.rowCount)
        return json({ error: 'Mentor is not currently available' }, 404);
    const r = await db().query(`insert into mentor_requests(student_id,mentor_id,message) values($1,$2,$3) returning id,mentor_id as "mentorId",message,status,created_at as at`, [u.id, mentorId, message]);
    return json({ request: r.rows[0] }, 201);
}
catch (e) {
    if (e && typeof e === 'object' && 'code' in e && (e as any).code === '23505')
        return json({ error: 'You already have an open request with this mentor' }, 409);
    return json({ error: 'Could not create mentor request' }, 500);
} }
