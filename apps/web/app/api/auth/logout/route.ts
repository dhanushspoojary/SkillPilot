import { clearSession, currentUser } from '../../../../lib/auth';
import { json, requireOrigin, logSecurityEvent } from '../../../../lib/server-security';
import { networkKey } from '../../../../lib/guard';

export const runtime = 'nodejs';

export async function POST(req: Request) {
    if (!requireOrigin(req))
        return json({ error: 'Origin not allowed' }, 403);

    const user = await currentUser().catch(() => null);
    if (user) {
        await logSecurityEvent({
            userId: user.id,
            eventType: 'auth.logout',
            ip: networkKey(req.headers, process.env.SKILLPILOT_TRUST_PROXY === 'true'),
            userAgent: req.headers.get('user-agent'),
        });
    }

    await clearSession();
    return json({ ok: true });
}

export async function GET() {
    return json({ error: 'Method not allowed. Use POST to log out.' }, 405);
}
