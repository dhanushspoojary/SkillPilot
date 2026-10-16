import { registerUser, issueSession } from '../../../../lib/auth';
import { verificationRequired, appUrl } from '../../../../lib/config';
import { createEmailToken } from '../../../../lib/email-tokens';
import { one } from '../../../../lib/db';
import { sendMailInBackground } from '../../../../lib/mailer';
import { dbRateLimit, networkKey } from '../../../../lib/guard';
import { json, requireOrigin, safeText, readJsonBody } from '../../../../lib/server-security';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const CHECK_EMAIL = { status: 'verify_email', message: 'If this address can be used, we have sent instructions to it. Check your inbox.' };
export async function POST(req: Request) {
    if (!requireOrigin(req))
        return json({ error: 'Origin not allowed' }, 403);
    const ip = networkKey(req.headers, process.env.SKILLPILOT_TRUST_PROXY === 'true');
    if (!(await dbRateLimit(`signup:${ip}`, 5, 3600000)))
        return json({ error: 'Signup rate limit reached. Try again later.' }, 429);
    try {
        const b = await readJsonBody<any>(req, 10000);
        const email = safeText(b.email, 254);
        const password = typeof b.password === 'string' && Buffer.byteLength(b.password, 'utf8') <= 72 ? b.password : null;
        const name = safeText(b.name, 80);
        const role = b.role === 'mentor' ? 'mentor' : 'student';
        if (!email || !password || !name)
            return json({ error: 'Name, email and password are required' }, 400);
        const verify = verificationRequired();
        try {
            const user = await registerUser(email, password, name, role);
            if (!verify) {
                await issueSession(user.id);
                return json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, mentorApproved: false } }, 201);
            }
            const token = await createEmailToken(user.id, 'verify', 24 * 60);
            sendMailInBackground({
                to: user.email,
                subject: 'Confirm your SkillPilot email',
                text: `Hi ${user.name},\n\nConfirm your email to finish creating your SkillPilot account (the link is valid for 24 hours):\n\n${appUrl()}/?verify=${token}\n\nIf you did not sign up, ignore this message.`,
            });
            return json(CHECK_EMAIL, 202);
        }
        catch (e) {
            const m = e instanceof Error ? e.message : '';
            if (m === 'email_exists') {
                // Same response as a fresh signup when verification is on; the real owner is told by email.
                if (verify) {
                    const existing = await one<{
                        email: string;
                        name: string;
                    }>('select email,name from users where email=$1', [email.trim().toLowerCase()]);
                    if (existing) {
                        sendMailInBackground({
                            to: existing.email,
                            subject: 'You already have a SkillPilot account',
                            text: `Hi ${existing.name},\n\nSomeone tried to create a SkillPilot account with this address. If that was you, sign in, or use "Forgot password" at ${appUrl()} to reset your password.\n\nIf it was not you, no action is needed.`,
                        });
                    }
                    return json(CHECK_EMAIL, 202);
                }
                return json({ error: 'Could not create account' }, 400);
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
