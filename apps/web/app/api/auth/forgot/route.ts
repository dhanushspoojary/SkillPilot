import { appUrl } from '../../../../lib/config';
import { one } from '../../../../lib/db';
import { createEmailToken } from '../../../../lib/email-tokens';
import { dbRateLimit, networkKey } from '../../../../lib/guard';
import { sendMailInBackground } from '../../../../lib/mailer';
import { hashInput, json, logSecurityEvent, readJsonBody, requireOrigin, safeText } from '../../../../lib/server-security';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Identical for registered and unregistered addresses.
const SAME = { ok: true, message: 'If that address has an account, a password reset link is on its way.' };
export async function POST(req: Request) {
    if (!requireOrigin(req))
        return json({ error: 'Origin not allowed' }, 403);
    const ip = networkKey(req.headers, process.env.SKILLPILOT_TRUST_PROXY === 'true');
    if (!(await dbRateLimit(`forgot:${ip}`, 10, 3600000)))
        return json({ error: 'Too many requests. Try again later.' }, 429);
    try {
        const b = await readJsonBody<any>(req, 2000);
        const email = safeText(b.email, 254)?.toLowerCase();
        if (!email)
            return json(SAME, 202);
        if (!(await dbRateLimit(`forgot:email:${hashInput(email)}`, 3, 3600000)))
            return json(SAME, 202);
        const u = await one<{
            id: string;
            name: string;
            email: string;
        }>(`select id,name,email from users where email=$1 and status='active'`, [email]);
        if (u) {
            const token = await createEmailToken(u.id, 'reset', 60);
            sendMailInBackground({ to: u.email, subject: 'Reset your SkillPilot password', text: `Hi ${u.name},\n\nUse this link to choose a new password (valid for 1 hour):\n\n${appUrl()}/?reset=${token}\n\nIf you did not ask for this, you can ignore this message; your password has not changed.` });
            await logSecurityEvent({ userId: u.id, eventType: 'auth.reset_requested', ip, userAgent: req.headers.get('user-agent') });
        }
        return json(SAME, 202);
    }
    catch {
        return json(SAME, 202);
    }
}
