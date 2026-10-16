import { currentUser, passwordCheck, SESSION_COOKIE } from '../../../lib/auth';
import { db, tx } from '../../../lib/db';
import { dbRateLimit } from '../../../lib/guard';
import { json, readJsonBody, requireOrigin } from '../../../lib/server-security';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function DELETE(req: Request) {
    if (!requireOrigin(req))
        return json({ error: 'Origin not allowed' }, 403);
    const u = await currentUser();
    if (!u)
        return json({ error: 'Unauthorized' }, 401);
    // Deleting is password-gated, so it must be guarded like any other password oracle.
    if (!(await dbRateLimit(`account-delete:${u.id}`, 5, 15 * 60000)))
        return json({ error: 'Too many attempts. Try again later.' }, 429);
    try {
        const b = await readJsonBody<any>(req, 10000);
        const password = typeof b.password === 'string' ? b.password : '';
        if (!password)
            return json({ error: 'Current password is required' }, 400);
        const row = await db().query<{
            password_hash: string;
        }>("select password_hash from users where id=$1 and status='active'", [u.id]);
        if (!row.rowCount || !(await passwordCheck(password, row.rows[0].password_hash)))
            return json({ error: 'Current password is incorrect' }, 400);
        await tx(async (c) => {
            // Serialize admin deletion so two simultaneous requests cannot remove the last admin.
            if (u.role === 'admin') {
                await c.query("select pg_advisory_xact_lock(hashtext('skillpilot:last-admin-delete'))");
                const admins = await c.query("select 1 from users where role='admin' and status='active' and id<>$1 limit 1", [u.id]);
                if (!admins.rowCount) throw new Error('last_admin');
            }
            await c.query('select skillpilot_delete_account($1)', [u.id]);
        });
        const { cookies } = await import('next/headers');
        (await cookies()).set(SESSION_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production' && process.env.SKILLPILOT_SECURE_COOKIES !== 'false', sameSite: 'lax', path: '/', maxAge: 0 });
        return json({ ok: true });
    }
    catch (e) {
        if (e instanceof Error && e.message === 'last_admin') return json({ error: 'The last administrator cannot be deleted' }, 409);
        return json({ error: 'Could not delete account' }, 500);
    }
}
