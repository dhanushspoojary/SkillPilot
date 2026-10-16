import { currentUser } from '../../../../lib/auth';
import { db, many } from '../../../../lib/db';
import { json, readJsonBody, requireOrigin, safeText, isUuid, logSecurityEvent } from '../../../../lib/server-security';
import { dbRateLimit } from '../../../../lib/guard';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() { const u = await currentUser(); if (!u || u.role !== 'admin')
    return json({ error: 'Admin required' }, 403); if (!(await dbRateLimit(`admin-mentors-read:${u.id}`, 120, 60000))) return json({ error: 'Too many admin requests' }, 429); return json({ mentors: await many<any>(`select u.id,u.email,u.name,mp.bio,mp.focus,mp.skills,mp.status,mp.approved_at as "approvedAt",mp.rejection_reason as "rejectionReason" from users u join mentor_profiles mp on mp.user_id=u.id order by case mp.status when 'pending' then 0 when 'rejected' then 1 when 'suspended' then 2 else 3 end, u.created_at desc`) }); }
export async function PATCH(req: Request) {
    if (!requireOrigin(req))
        return json({ error: 'Origin not allowed' }, 403);
    const u = await currentUser();
    if (!u || u.role !== 'admin')
        return json({ error: 'Admin required' }, 403);
    if (!(await dbRateLimit(`admin-mentors-write:${u.id}`, 60, 3600000)))
        return json({ error: 'Too many admin changes' }, 429);
    try {
        const b = await readJsonBody<any>(req, 10000);
        const id = safeText(b.mentorId, 64), status = b.status;
        const reason = safeText(b.reason, 500) || null;
        if (!isUuid(id) || !['approved', 'rejected', 'suspended'].includes(status))
            return json({ error: 'mentorId and a valid status are required' }, 400);
        if (status === 'approved') {
            const ready = await db().query(`select 1 from mentor_profiles where user_id=$1 and length(trim(focus))>0 and length(trim(bio))>=20`, [id]);
            if (!ready.rowCount)
                return json({ error: 'Mentor must complete a focus and a 20+ character bio before approval' }, 400);
        }
        const r = await db().query(`update mentor_profiles set status=$1,approved_by=case when $1='approved' then $2 else approved_by end,approved_at=case when $1='approved' then coalesce(approved_at,now()) when $1 in ('rejected','suspended') then null else approved_at end,rejection_reason=$3 where user_id=$4 returning user_id as id,status`, [status, u.id, reason, id]);
        if (!r.rowCount)
            return json({ error: 'Mentor not found' }, 404);
        await logSecurityEvent({ userId: u.id, eventType: 'admin.mentor_status_changed', userAgent: req.headers.get('user-agent'), metadata: { mentorId: id, status } });
        return json({ mentor: r.rows[0] });
    }
    catch {
        return json({ error: 'Could not update mentor' }, 500);
    }
}
