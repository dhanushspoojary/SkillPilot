import { currentUser, passwordCheck, passwordHash, validPassword, clearSession } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { json, requireOrigin, readJsonBody } from '../../../../lib/server-security';
import { dbRateLimit, networkKey } from '../../../../lib/guard';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
    if (!requireOrigin(req))
        return json({ error: 'Origin not allowed' }, 403);
    const user = await currentUser();
    if (!user)
        return json({ error: 'Unauthorized' }, 401);
    const ip = networkKey(req.headers, process.env.SKILLPILOT_TRUST_PROXY === 'true');
    if (!(await dbRateLimit(`change-password:user:${user.id}`, 5, 15 * 60000)))
        return json({ error: 'Too many password-change attempts. Try again later.' }, 429);
    if (!(await dbRateLimit(`change-password:network:${ip}`, 30, 15 * 60000)))
        return json({ error: 'Too many password-change attempts. Try again later.' }, 429);
    try {
        const body = await readJsonBody<any>(req, 10000);
        const current = typeof body.currentPassword === 'string' ? body.currentPassword : '';
        const next = typeof body.newPassword === 'string' ? body.newPassword : '';
        if (!validPassword(next))
            return json({ error: 'New password must be between 12 and 72 characters' }, 400);
        const row = await db().query<{
            password_hash: string;
        }>('select password_hash from users where id=$1 and status=\'active\'', [user.id]);
        if (!row.rowCount || !(await passwordCheck(current, row.rows[0].password_hash)))
            return json({ error: 'Current password is incorrect' }, 400);
        const hash = await passwordHash(next);
        await db().query('update users set password_hash=$1,updated_at=now() where id=$2', [hash, user.id]);
        await db().query('delete from sessions where user_id=$1', [user.id]);
        await clearSession();
        return json({ ok: true, message: 'Password changed. Sign in again on this device.' });
    }
    catch {
        return json({ error: 'Could not change password' }, 500);
    }
}
