import { currentUser } from '../../../../lib/auth';
import { many, tx } from '../../../../lib/db';
import { isUuid, json, logSecurityEvent, readJsonBody, requireOrigin } from '../../../../lib/server-security';
import { dbRateLimit } from '../../../../lib/guard';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Lists student and mentor accounts (never other admins) for moderation. */
export async function GET(req: Request) {
    const admin = await currentUser();
    if (!admin || admin.role !== 'admin')
        return json({ error: 'Admin required' }, 403);
    if (!(await dbRateLimit(`admin-users-read:${admin.id}`, 120, 60000)))
        return json({ error: 'Too many admin requests' }, 429);
    const url = new URL(req.url);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || 25)));
    const offset = Math.min(10000, Math.max(0, Number(url.searchParams.get('offset') || 0)));
    const q = (url.searchParams.get('q') || '').trim().slice(0, 80);
    const params: unknown[] = [limit, offset];
    let filter = '';
    if (q) {
        params.push(`%${q.replace(/[\\%_]/g, '\\$&')}%`);
        filter = ' and (name ilike $3 or email ilike $3)';
    }
    const users = await many<any>(`select id,email,name,role,status,email_verified_at as "emailVerifiedAt",created_at as "createdAt"
       from users where role in ('student','mentor')${filter} order by created_at desc limit $1 offset $2`, params);
    return json({ users, limit, offset, hasMore: users.length === limit });
}
/** Suspends or reactivates a student or mentor. Suspension ends all of their sessions immediately. */
export async function PATCH(req: Request) {
    if (!requireOrigin(req))
        return json({ error: 'Origin not allowed' }, 403);
    const admin = await currentUser();
    if (!admin || admin.role !== 'admin')
        return json({ error: 'Admin required' }, 403);
    if (!(await dbRateLimit(`admin-users-write:${admin.id}`, 60, 3600000)))
        return json({ error: 'Too many admin changes' }, 429);
    try {
        const b = await readJsonBody<any>(req, 5000);
        const userId = typeof b.userId === 'string' ? b.userId : null;
        const status = b.status;
        if (!isUuid(userId) || !['active', 'suspended'].includes(status))
            return json({ error: 'userId and a valid status are required' }, 400);
        if (userId === admin.id)
            return json({ error: 'You cannot change your own account status' }, 400);
        const out = await tx(async (c) => {
            const target = await c.query<{
                id: string;
                role: string;
            }>('select id,role from users where id=$1 for update', [userId]);
            if (!target.rowCount)
                throw new Error('not_found');
            if (target.rows[0].role === 'admin')
                throw new Error('admin_protected');
            await c.query('update users set status=$1,updated_at=now() where id=$2', [status, userId]);
            if (status === 'suspended')
                await c.query('delete from sessions where user_id=$1', [userId]);
            return { id: userId, status };
        });
        await logSecurityEvent({ userId: admin.id, eventType: 'admin.user_status_changed', userAgent: req.headers.get('user-agent'), metadata: { targetUserId: userId, status } });
        return json({ user: out });
    }
    catch (e) {
        const m = e instanceof Error ? e.message : '';
        if (m === 'not_found')
            return json({ error: 'User not found' }, 404);
        if (m === 'admin_protected')
            return json({ error: 'Administrator accounts cannot be changed here' }, 403);
        if (m === 'body_too_large')
            return json({ error: 'Request too large' }, 413);
        return json({ error: 'Could not update user' }, 500);
    }
}
