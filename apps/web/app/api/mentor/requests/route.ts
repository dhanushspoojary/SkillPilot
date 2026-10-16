import { currentUser } from '../../../../lib/auth';
import { db, many, tx } from '../../../../lib/db';
import { json, readJsonBody, requireOrigin, safeText, isUuid } from '../../../../lib/server-security';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
    const u = await currentUser();
    if (!u || u.role !== 'mentor')
        return json({ error: 'Mentor required' }, 403);
    const requests = await many<any>(`select mr.id,mr.student_id,mr.message,mr.status,mr.created_at as at,u.name as student_name from mentor_requests mr join users u on u.id=mr.student_id where mr.mentor_id=$1 order by mr.created_at desc limit 50`, [u.id]);
    return json({ requests });
}
export async function PATCH(req: Request) {
    if (!requireOrigin(req))
        return json({ error: 'Origin not allowed' }, 403);
    const u = await currentUser();
    if (!u || u.role !== 'mentor' || !u.mentorApproved)
        return json({ error: 'Approved mentor account required' }, 403);
    try {
        const b = await readJsonBody<any>(req, 10000);
        const requestId = safeText(b.requestId, 64), status = b.status;
        if (!isUuid(requestId) || !['accepted', 'declined'].includes(status))
            return json({ error: 'Valid requestId and status are required' }, 400);
        const r = await tx(async (c) => {
            const q = await c.query<any>(`select id,student_id,status from mentor_requests where id=$1 and mentor_id=$2 for update`, [requestId, u.id]);
            if (!q.rowCount)
                throw new Error('not_found');
            if (q.rows[0].status !== 'pending')
                throw new Error('closed');
            if (q.rows[0].student_id === u.id)
                throw new Error('self_request');
            const out = await c.query<any>(`update mentor_requests set status=$1,responded_at=now() where id=$2 returning id,status`, [status, requestId]);
            return out.rows[0];
        });
        return json({ request: r });
    }
    catch (e) {
        const m = e instanceof Error ? e.message : '';
        if (m === 'not_found')
            return json({ error: 'Request not found' }, 404);
        if (m === 'closed')
            return json({ error: 'Request is already closed' }, 409);
        if (m === 'self_request')
            return json({ error: 'You cannot review your own account' }, 400);
        return json({ error: 'Could not update request' }, 500);
    }
}
