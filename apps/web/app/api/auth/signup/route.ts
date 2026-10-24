import { registerUser, issueSession } from '../../../../lib/auth.ts';
import { dbRateLimit, networkKey } from '../../../../lib/guard.ts';
import { json, requireOrigin, safeText, readJsonBody } from '../../../../lib/server-security.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    if (!requireOrigin(req))
        return json({ error: 'Origin not allowed' }, 403);
    const ip = networkKey(req.headers, process.env.SKILLPILOT_TRUST_PROXY === 'true');
    const signupLimit = process.env.NODE_ENV === 'production' && !process.env.SKILLPILOT_TEST_MODE ? 10 : 60;
    if (!(await dbRateLimit(`signup:${ip}`, signupLimit, 3600000)))
        return json({ error: 'Signup rate limit reached. Try again later.' }, 429);
    try {
        const b = await readJsonBody<any>(req, 10000);
        const email = safeText(b.email, 254);
        const password = typeof b.password === 'string' && Buffer.byteLength(b.password, 'utf8') <= 72 ? b.password : null;
        const name = safeText(b.name, 80);
        const role = b.role === 'mentor' ? 'mentor' : 'student';
        if (!email || !password || !name)
            return json({ error: 'Name, email and password are required' }, 400);
        try {
            const user = await registerUser(email, password, name, role);
            await issueSession(user.id);
            return json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, mentorApproved: false } }, 201);
        }
        catch (e) {
            const m = e instanceof Error ? e.message : '';
            if (m === 'email_exists') {
                return json({ error: 'Could not create account with this email address' }, 400);
            }
            if (m === 'password_policy')
                return json({ error: 'Use a password between 12 and 72 characters' }, 400);
            if (m === 'invalid_email')
                return json({ error: 'Enter a valid email address' }, 400);
            if (m === 'invalid_name')
                return json({ error: 'Name must be 2-80 characters' }, 400);
            return json({ error: 'Could not create account' }, 500);
        }
    }
    catch (e) {
        const m = e instanceof Error ? e.message : '';
        if (m === 'body_too_large')
            return json({ error: 'Request too large' }, 413);
        if (m === 'invalid_json')
            return json({ error: 'Invalid JSON' }, 400);
        return json({ error: 'Could not create account' }, 500);
    }
}
