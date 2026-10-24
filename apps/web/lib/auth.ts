import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db, one, tx } from './db.ts';

async function getCookies() {
    try {
        const { cookies } = await import('next/headers');
        return await cookies();
    } catch {
        return { get: () => undefined, set: () => undefined } as any;
    }
}

export const BCRYPT_COST = 12;
export const SESSION_COOKIE = 'skillpilot_session';
const SESSION_DAYS = 14;
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export type Role = 'student' | 'mentor' | 'admin';
export interface User {
    id: string;
    email: string;
    name: string;
    role: Role;
    status: string;
    mentorApproved: boolean;
}
function hashToken(token: string) { return createHash('sha256').update(token).digest('hex'); }
function cleanEmail(email: string) { return email.trim().toLowerCase(); }
export function validEmail(email: string) { return emailRe.test(email) && email.length <= 254; }
export function validPassword(password: string) { return password.length >= 12 && Buffer.byteLength(password, 'utf8') <= 72; }
export async function passwordHash(password: string) { return bcrypt.hash(password, BCRYPT_COST); }
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('skillpilot-invalid-password-constant', BCRYPT_COST);
export async function passwordCheck(password: string, hash: string) { return bcrypt.compare(password, hash); }
export async function passwordCheckDummy(password: string) { return bcrypt.compare(password, DUMMY_PASSWORD_HASH); }
export async function issueSession(userId: string) {
    const token = randomBytes(32).toString('base64url');
    const hash = hashToken(token);
    await db().query('delete from sessions where user_id=$1 and expires_at<=now()', [userId]);
    await db().query('insert into sessions(id,user_id,token_hash,expires_at) values(gen_random_uuid(),$1,$2,now()+$3::interval)', [userId, hash, `${SESSION_DAYS} days`]);
    await db().query(`delete from sessions where user_id=$1 and id not in (select id from sessions where user_id=$1 order by created_at desc limit 5)`, [userId]);
    (await getCookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' && process.env.SKILLPILOT_SECURE_COOKIES !== 'false', sameSite: 'lax', path: '/', maxAge: SESSION_DAYS * 86400 });
}
export async function clearSession() {
    const jar = await getCookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (token)
        await db().query('delete from sessions where token_hash=$1', [hashToken(token)]).catch(() => undefined);
    jar.set(SESSION_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production' && process.env.SKILLPILOT_SECURE_COOKIES !== 'false', sameSite: 'lax', path: '/', maxAge: 0, expires: new Date(0) });
}
export async function currentUser(): Promise<User | null> {
    const token = (await getCookies()).get(SESSION_COOKIE)?.value;
    if (!token)
        return null;
    const row = await one<User & {
        expires_at: string;
    }>(`select u.id,u.email,u.name,u.role,u.status,coalesce(mp.status='approved',false) as "mentorApproved",s.expires_at from sessions s join users u on u.id=s.user_id left join mentor_profiles mp on mp.user_id=u.id where s.token_hash=$1 and s.expires_at>now() and u.status='active'`, [hashToken(token)]).catch((err) => {
        console.error('currentUser database query failed:', err instanceof Error ? err.message : err);
        return null;
    });
    if (!row)
        return null;
    await db().query(`update sessions set last_seen_at=now() where token_hash=$1 and last_seen_at < now()-interval '5 minutes'`, [hashToken(token)]).catch(() => undefined);
    return { id: row.id, email: row.email, name: row.name, role: row.role, status: row.status, mentorApproved: row.mentorApproved };
}
export async function requireUser(roles?: Role[]) {
    const user = await currentUser();
    if (!user || (roles && !roles.includes(user.role)))
        throw new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } });
    return user;
}
export async function registerUser(emailRaw: string, password: string, nameRaw: string, role: 'student' | 'mentor') {
    const email = cleanEmail(emailRaw), name = nameRaw.trim().replace(/\s+/g, ' ');
    if (!validEmail(email))
        throw new Error('invalid_email');
    if (!validPassword(password))
        throw new Error('password_policy');
    if (name.length < 2 || name.length > 80)
        throw new Error('invalid_name');
    const hash = await passwordHash(password);
    return tx(async (c) => {
        const exists = await c.query('select 1 from users where email=$1', [email]);
        if (exists.rowCount)
            throw new Error('email_exists');
        const status = 'active';
        let user: User;
        try {
            user = (await c.query(`insert into users(email,password_hash,role,name,status,email_verified_at) values($1,$2,$3,$4,$5,now()) returning id,email,name,role,status`, [email, hash, role, name, status])).rows[0] as User;
        }
        catch (e) {
            // A concurrent signup with the same email lost the race.
            if (e && typeof e === 'object' && (e as {
                code?: string;
            }).code === '23505')
                throw new Error('email_exists');
            throw e;
        }
        if (role === 'mentor')
            await c.query(`insert into mentor_profiles(user_id,bio,focus,skills,status) values($1,'','', '[]'::jsonb,'pending')`, [user.id]);
        await c.query(`insert into career_goals(user_id,role_name,target_level) values($1,'Software Engineer','entry')`, [user.id]);
        return user;
    });
}
