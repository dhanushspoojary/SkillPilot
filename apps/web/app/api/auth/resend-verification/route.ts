import { appUrl } from '../../../../lib/config';
import { one } from '../../../../lib/db';
import { createEmailToken } from '../../../../lib/email-tokens';
import { dbRateLimit, networkKey } from '../../../../lib/guard';
import { sendMailInBackground } from '../../../../lib/mailer';
import { hashInput, json, readJsonBody, requireOrigin, safeText } from '../../../../lib/server-security';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const SAME = { ok: true, message: 'If that address has an unconfirmed account, a new link is on its way.' };
export async function POST(req: Request) {
    if (!requireOrigin(req))
        return json({ error: 'Origin not allowed' }, 403);
    const ip = networkKey(req.headers, process.env.SKILLPILOT_TRUST_PROXY === 'true');
    if (!(await dbRateLimit(`resend:${ip}`, 10, 3600000)))
        return json({ error: 'Too many requests. Try again later.' }, 429);
    try {
        const b = await readJsonBody<any>(req, 2000);
        const email = safeText(b.email, 254)?.toLowerCase();
        if (!email)
            return json(SAME, 202);
        if (!(await dbRateLimit(`resend:email:${hashInput(email)}`, 3, 3600000)))
            return json(SAME, 202);
        const u = await one<{
            id: string;
            name: string;
            email: string;
        }>(`select id,name,email from users where email=$1 and status='active' and email_verified_at is null`, [email]);
        if (u) {
            const token = await createEmailToken(u.id, 'verify', 24 * 60);
            sendMailInBackground({ to: u.email, subject: 'Confirm your SkillPilot email', text: `Hi ${u.name},\n\nConfirm your email (valid for 24 hours):\n\n${appUrl()}/?verify=${token}\n\nIf you did not ask for this, ignore this message.` });
        }
        return json(SAME, 202);
    }
    catch {
        return json(SAME, 202);
    }
}
